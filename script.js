// Vercel 서버리스 기업 재무정보 API 상대 경로입니다.
const API_ENDPOINT = '/api/finance';

// DOM 요소 참조를 가져옵니다.
const corpSelect = document.getElementById('corpSelect');
const customCrnoGroup = document.getElementById('customCrnoGroup');
const customCrno = document.getElementById('customCrno');
const searchCustomBtn = document.getElementById('searchCustomBtn');
const yearSelect = document.getElementById('yearSelect');
const typeSelect = document.getElementById('typeSelect');

const financeBanner = document.getElementById('financeBanner');
const bannerCorpName = document.getElementById('bannerCorpName');
const bannerBizYear = document.getElementById('bannerBizYear');
const bannerEmoji = document.getElementById('bannerEmoji');
const bannerGradeText = document.getElementById('bannerGradeText');
const bannerMainValue = document.getElementById('bannerMainValue');
const actionTip = document.getElementById('actionTip');
const updateTimeText = document.getElementById('updateTimeText');
const cardsGrid = document.getElementById('cardsGrid');
const chartCanvas = document.getElementById('financeChart');

// Chart.js 인스턴스 전역 변수입니다.
let chartInstance = null;

// 금액(원)을 한국어 단위(조, 억, 만 원)로 변환하는 포맷팅 헬퍼 함수입니다.
function formatKoreanWon(amount) {
  if (amount === null || amount === undefined || isNaN(amount) || String(amount).trim() === '' || String(amount).trim() === '-') {
    return '정보 없음';
  }

  const num = Number(amount);
  if (num === 0) return '0원';

  const sign = num < 0 ? '-' : '';
  const absNum = Math.abs(num);

  const jo = Math.floor(absNum / 1000000000000); // 1조
  const eok = Math.floor((absNum % 1000000000000) / 100000000); // 1억
  const man = Math.floor((absNum % 100000000) / 10000); // 1만

  let result = '';
  if (jo > 0) result += `${jo.toLocaleString()}조 `;
  if (eok > 0) result += `${eok.toLocaleString()}억 `;
  if (jo === 0 && eok === 0 && man > 0) result += `${man.toLocaleString()}만 `;
  if (!result.trim()) result = `${absNum.toLocaleString()}`;

  return `${sign}${result.trim()}원`;
}

// 현재 시각을 한국어 형식으로 포맷팅합니다.
function getCurrentKoreanTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}년 ${month}월 ${day}일 ${hours}시 ${minutes}분 기준`;
}

// 금융위원회 기업 재무정보 API를 비동기 호출하는 함수입니다.
async function fetchFinanceData() {
  let crno = corpSelect.value;
  let corpName = corpSelect.options[corpSelect.selectedIndex].text;

  // 직접 입력 모드일 경우 입력된 법인번호를 사용합니다.
  if (crno === 'custom') {
    crno = customCrno.value.trim();
    corpName = `법인번호(${crno})`;
    if (!crno) {
      alert('13자리 법인등록번호를 입력해주세요.');
      return;
    }
  }

  const bizYear = yearSelect.value;
  const type = typeSelect.value;

  // 상단 타이틀 업데이트
  bannerCorpName.textContent = corpName;
  bannerBizYear.textContent = bizYear;

  // 로딩 화면 설정
  cardsGrid.innerHTML = '<div class="loading-message">금융위원회 공공데이터 서버에서 재무정보를 불러오는 중입니다...</div>';
  financeBanner.className = 'finance-banner grade-none';
  bannerEmoji.textContent = '⏳';
  bannerGradeText.textContent = '조회 중...';
  bannerMainValue.textContent = '데이터 확인 중';
  actionTip.textContent = `${corpName}의 ${bizYear}년도 재무제표를 분석하고 있습니다.`;
  updateTimeText.textContent = '조회 중...';

  try {
    const url = `${API_ENDPOINT}?crno=${encodeURIComponent(crno)}&bizYear=${encodeURIComponent(bizYear)}&type=${encodeURIComponent(type)}`;
    const response = await fetch(url);
    const result = await response.json();

    if (!response.ok || result.error) {
      throw new Error(result.error || `서버 에러 (${response.status})`);
    }

    // 아이템 목록 추출 (배열 또는 단일 객체)
    let items = result?.response?.body?.items?.item;
    if (!items) {
      items = [];
    } else if (!Array.isArray(items)) {
      items = [items];
    }

    if (items.length === 0) {
      cardsGrid.innerHTML = '<div class="empty-message">해당 연도의 공시된 재무제표 데이터가 없습니다. 다른 사업연도를 선택해보세요.</div>';
      bannerEmoji.textContent = '🔍';
      bannerGradeText.textContent = '데이터 없음';
      bannerMainValue.textContent = '-';
      actionTip.textContent = '공시 보고서 미제출 또는 조회 조건에 부합하는 자료가 없습니다.';
      updateTimeText.textContent = getCurrentKoreanTime();
      renderChart([]);
      return;
    }

    // 첫 번째 가장 최신 레코드로 대시보드 렌더링
    renderFinanceView(items[0], corpName, bizYear);
  } catch (err) {
    console.error('재무정보 조회 실패:', err);
    cardsGrid.innerHTML = `<div class="error-message">데이터를 불러오는 중 문제가 발생했습니다.<br>${err.message}</div>`;
    bannerEmoji.textContent = '⚠️';
    bannerGradeText.textContent = '조회 오류';
    bannerMainValue.textContent = '확인 필요';
    actionTip.textContent = 'FINANCE_KEY 환경변수 설정 또는 공공데이터포털 승인 상태를 확인해주세요.';
    updateTimeText.textContent = getCurrentKoreanTime();
    renderChart([]);
  }
}

// 수신한 재무제표 데이터를 바탕으로 신호등 배너, 차트, 카드를 렌더링합니다.
function renderFinanceView(item, corpName, bizYear) {
  // 실제 법인명이 들어있으면 상단 표시명 업데이트
  if (item.corpNm) {
    bannerCorpName.textContent = item.corpNm;
  }

  // 핵심 재무 수치 추출
  const sales = item.enpSaleAmt ? Number(item.enpSaleAmt) : null;      // 매출액
  const opProfit = item.enpBzopPfit ? Number(item.enpBzopPfit) : null; // 영업이익
  const netProfit = item.enpCrtmNpf ? Number(item.enpCrtmNpf) : null;  // 당기순이익
  const totalAssets = item.enpTastAmt ? Number(item.enpTastAmt) : null;// 자산총계
  const totalDebt = item.enpTdbtAmt ? Number(item.enpTdbtAmt) : null;  // 부채총계
  const totalEquity = item.enpTcpaAmt ? Number(item.enpTcpaAmt) : null;// 자본총계

  // 상단 메인 금액: 매출액 우선 표시
  if (sales !== null) {
    bannerMainValue.textContent = `매출 ${formatKoreanWon(sales)}`;
  } else if (opProfit !== null) {
    bannerMainValue.textContent = `영업익 ${formatKoreanWon(opProfit)}`;
  } else {
    bannerMainValue.textContent = '실적 확인';
  }

  // 흑자/적자 신호등 등급 및 코멘트 판별
  if (opProfit !== null) {
    if (opProfit >= 1000000000000) { // 1조 원 이상
      financeBanner.className = 'finance-banner grade-blue';
      bannerEmoji.textContent = '🔵';
      bannerGradeText.textContent = '대규모 흑자';
      actionTip.textContent = `영업이익 ${formatKoreanWon(opProfit)}을 달성하며 매우 견조한 수익성을 기록했습니다.`;
    } else if (opProfit > 0) {
      financeBanner.className = 'finance-banner grade-green';
      bannerEmoji.textContent = '🟢';
      bannerGradeText.textContent = '안정적 흑자';
      actionTip.textContent = `영업이익 ${formatKoreanWon(opProfit)}으로 안정적인 영업 활동을 이어가고 있습니다.`;
    } else {
      financeBanner.className = 'finance-banner grade-red';
      bannerEmoji.textContent = '🔴';
      bannerGradeText.textContent = '영업손실(적자)';
      actionTip.textContent = `영업손실 ${formatKoreanWon(opProfit)}이 발생했습니다. 수익성 개선 추이를 확인할 필요가 있습니다.`;
    }
  } else {
    financeBanner.className = 'finance-banner grade-none';
    bannerEmoji.textContent = '⚪';
    bannerGradeText.textContent = '실적 공시';
    actionTip.textContent = '공식 공시된 기업 재무제표 요약 정보입니다.';
  }

  updateTimeText.textContent = getCurrentKoreanTime();

  // 차트 데이터 항목 정의 (단위: 억 원)
  const chartItems = [
    { label: '매출액', raw: sales },
    { label: '영업이익', raw: opProfit },
    { label: '당기순이익', raw: netProfit },
    { label: '자산총계', raw: totalAssets },
    { label: '부채총계', raw: totalDebt },
    { label: '자본총계', raw: totalEquity }
  ].filter(it => it.raw !== null && !isNaN(it.raw));

  renderChart(chartItems);

  // 상세 카드 그리드 생성
  const cardDefinitions = [
    { title: '매출액 (Sales)', value: sales, badge: '수익 지표' },
    { title: '영업이익 (Operating Profit)', value: opProfit, badge: opProfit >= 0 ? '흑자' : '적자' },
    { title: '당기순이익 (Net Income)', value: netProfit, badge: netProfit >= 0 ? '순이익' : '순손실' },
    { title: '자산총계 (Total Assets)', value: totalAssets, badge: '재무상태' },
    { title: '부채총계 (Total Debt)', value: totalDebt, badge: '재무상태' },
    { title: '자본총계 (Total Equity)', value: totalEquity, badge: '재무상태' }
  ];

  let cardsHtml = '';
  cardDefinitions.forEach(card => {
    const wonText = formatKoreanWon(card.value);
    const rawText = card.value !== null ? `${Number(card.value).toLocaleString()} 원` : '-';

    cardsHtml += `
      <article class="finance-card">
        <div class="card-header">
          <h3 class="card-title">${card.title}</h3>
          <span class="card-badge">${card.badge}</span>
        </div>
        <div class="card-body">
          <div class="card-amount">${wonText}</div>
          <div class="card-raw-amount">원문 수치: ${rawText}</div>
        </div>
        <div class="card-footer">사업연도: ${bizYear}년 기준</div>
      </article>
    `;
  });

  cardsGrid.innerHTML = cardsHtml;
}

// Chart.js 가로 막대그래프 렌더링 함수입니다.
function renderChart(items) {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  if (!items || items.length === 0) return;

  const labels = items.map(it => it.label);
  // 원 단위를 '억 원' 단위(소수점 1자리)로 환산
  const values = items.map(it => Math.round((it.raw / 100000000) * 10) / 10);
  
  // 막대 색상: 영업이익/순이익 적자 시 빨강, 그 외 파랑/녹색
  const backgroundColors = items.map(it => {
    if (it.raw < 0) return '#ef4444'; // 적자: 빨강
    if (it.label.includes('영업이익') || it.label.includes('매출액')) return '#3b82f6'; // 파랑
    return '#10b981'; // 녹색
  });

  chartInstance = new Chart(chartCanvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '금액 (억 원)',
        data: values,
        backgroundColor: backgroundColors,
        borderRadius: 8,
        barThickness: 22
      }]
    },
    options: {
      indexAxis: 'y', // 가로 막대그래프
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` 금액: ${ctx.parsed.x.toLocaleString()} 억 원`
          }
        }
      },
      scales: {
        x: {
          grid: { color: '#f1f5f9' },
          ticks: {
            font: { family: 'Pretendard' },
            callback: (val) => `${val.toLocaleString()}억`
          }
        },
        y: {
          grid: { display: false },
          ticks: {
            font: { family: 'Pretendard', weight: 'bold', size: 13 },
            color: '#334155'
          }
        }
      }
    }
  });
}

// 기업 드롭다운 변경 이벤트
corpSelect.addEventListener('change', () => {
  if (corpSelect.value === 'custom') {
    customCrnoGroup.classList.remove('hidden');
    customCrno.focus();
  } else {
    customCrnoGroup.classList.add('hidden');
    fetchFinanceData();
  }
});

// 직접 입력 조회 버튼 이벤트
searchCustomBtn.addEventListener('click', fetchFinanceData);
customCrno.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') fetchFinanceData();
});

// 사업연도 및 재무제표 구분 변경 이벤트
yearSelect.addEventListener('change', fetchFinanceData);
typeSelect.addEventListener('change', fetchFinanceData);

// 페이지 로드 시 초기 조회 (기본: 삼성전자, 2023년)
window.addEventListener('DOMContentLoaded', fetchFinanceData);
