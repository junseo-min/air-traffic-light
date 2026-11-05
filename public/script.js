// Vercel 서버리스 브이월드 중계 API 상대 경로입니다.
const API_ENDPOINT = '/api/data';

// DOM 요소 참조를 가져옵니다.
const sidoSelect = document.getElementById('sidoSelect');
const layerSelect = document.getElementById('layerSelect');
const selectedRegionTitle = document.getElementById('selectedRegionTitle');
const summaryBanner = document.getElementById('summaryBanner');
const bannerEmoji = document.getElementById('bannerEmoji');
const bannerMainText = document.getElementById('bannerMainText');
const bannerSubValue = document.getElementById('bannerSubValue');
const actionTip = document.getElementById('actionTip');
const updateTimeText = document.getElementById('updateTimeText');
const cardsGrid = document.getElementById('cardsGrid');
const chartCanvas = document.getElementById('dataChart');

// Chart.js 인스턴스 전역 변수입니다.
let chartInstance = null;

// 현재 시각을 'YYYY년 MM월 DD일 HH시 MM분 기준' 형식으로 포맷팅합니다.
function getCurrentKoreanTime() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const hours = now.getHours();
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}년 ${month}월 ${day}일 ${hours}시 ${minutes}분 기준`;
}

// 브이월드 국가공간정보 데이터를 비동기로 조회하는 메인 함수입니다.
async function fetchVWorldData() {
  const sido = sidoSelect.value;
  const layer = layerSelect.value;
  const sidoText = sidoSelect.options[sidoSelect.selectedIndex].text;
  const layerText = layerSelect.options[layerSelect.selectedIndex].text;

  // 상단 지역명 업데이트
  selectedRegionTitle.textContent = sidoText;

  // 로딩 상태 표시
  cardsGrid.innerHTML = '<div class="loading-message">브이월드 실시간 공간정보를 불러오는 중입니다...</div>';
  bannerEmoji.textContent = '⏳';
  bannerMainText.textContent = '조회 중...';
  bannerSubValue.textContent = '-';
  actionTip.textContent = `${sidoText}의 ${layerText}를 브이월드 서버에서 가져오고 있습니다.`;
  updateTimeText.textContent = '데이터 통신 중...';

  try {
    // API 엔드포인트로 요청을 전송합니다.
    const url = `${API_ENDPOINT}?sido=${encodeURIComponent(sido)}&data=${encodeURIComponent(layer)}&size=100`;
    const response = await fetch(url);
    const result = await response.json();

    // 서버 응답 에러 처리
    if (!response.ok || result.error) {
      throw new Error(result.error || `서버 에러 (${response.status})`);
    }

    // 피처 목록 추출
    const features = result?.response?.result?.featureCollection?.features || [];
    const totalCount = result?.response?.total || features.length;

    // 데이터가 없는 경우의 화면 처리
    if (features.length === 0) {
      cardsGrid.innerHTML = '<div class="empty-message">해당 조건에 일치하는 공간정보 데이터가 없습니다.</div>';
      bannerEmoji.textContent = '🔍';
      bannerMainText.textContent = '결과 없음';
      bannerSubValue.textContent = '0건';
      actionTip.textContent = '검색 조건이나 시도를 변경하여 다시 조회해보세요.';
      updateTimeText.textContent = getCurrentKoreanTime();
      renderChart([]);
      return;
    }

    // 정상 데이터 화면 렌더링
    renderDataView(features, totalCount, sidoText, layerText);
  } catch (err) {
    console.error('브이월드 데이터 조회 실패:', err);
    cardsGrid.innerHTML = `<div class="error-message">데이터를 불러오는 중 오류가 발생했습니다.<br>${err.message}</div>`;
    bannerEmoji.textContent = '⚠️';
    bannerMainText.textContent = '조회 오류';
    bannerSubValue.textContent = '확인 필요';
    actionTip.textContent = 'VWORLD_KEY 환경변수 설정 또는 네트워크 상태를 확인해주세요.';
    updateTimeText.textContent = getCurrentKoreanTime();
    renderChart([]);
  }
}

// 수신한 피처 데이터를 화면과 차트에 렌더링하는 함수입니다.
function renderDataView(features, totalCount, sidoText, layerText) {
  // 상단 요약 배너 갱신
  bannerEmoji.textContent = '🏛️';
  bannerMainText.textContent = `${features.length}개 구역`;
  bannerSubValue.textContent = `총 ${totalCount}건`;
  actionTip.textContent = `${sidoText} 지역의 ${layerText}가 정상적으로 수신되었습니다.`;
  updateTimeText.textContent = getCurrentKoreanTime();

  // 상세 카드 목록 HTML 생성
  let cardsHtml = '';
  const chartDataList = [];

  features.forEach((feature, index) => {
    const props = feature.properties || {};
    // 시군구명 또는 읍면동명 추출
    const name = props.sig_kor_nm || props.emd_kor_nm || props.kor_nm || `구역 ${index + 1}`;
    // 전체 주소 명칭
    const fullName = props.full_nm || '-';
    // 고유 코드 추출
    const code = props.sig_cd || props.emd_cd || props.code || '-';

    // 차트용 데이터 수집
    chartDataList.push({
      name: name,
      codeNum: Number(String(code).slice(-4)) || (index + 1) * 10
    });

    // 개별 카드 템플릿
    cardsHtml += `
      <article class="data-card">
        <div class="card-header">
          <h3 class="card-title">${name}</h3>
          <span class="card-badge">코드 ${code}</span>
        </div>
        <div class="card-body">
          <div class="card-info-row">
            <span class="info-label">행정구역 전체명</span>
            <span class="info-value">${fullName}</span>
          </div>
          <div class="card-info-row">
            <span class="info-label">식별 ID</span>
            <span class="info-value">${feature.id || '-'}</span>
          </div>
        </div>
        <div class="card-footer">국토교통부 브이월드 데이터</div>
      </article>
    `;
  });

  cardsGrid.innerHTML = cardsHtml;

  // 가로 막대그래프 렌더링
  renderChart(chartDataList);
}

// Chart.js 가로 막대그래프 생성 함수입니다.
function renderChart(items) {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  if (!items || items.length === 0) return;

  // 상위 10개만 슬라이스
  const top10 = items.slice(0, 10);
  const labels = top10.map(item => item.name);
  const values = top10.map(item => item.codeNum);

  // 차트 인스턴스 초기화
  chartInstance = new Chart(chartCanvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '행정구역 식별 번호',
        data: values,
        backgroundColor: '#3b82f6',
        borderRadius: 8,
        barThickness: 20
      }]
    },
    options: {
      indexAxis: 'y', // 가로 막대그래프 설정
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => ` 식별 코드값: ${ctx.parsed.x}`
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          ticks: { font: { family: 'Pretendard' } }
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

// 컨트롤 드롭다운 변경 이벤트 연결
sidoSelect.addEventListener('change', fetchVWorldData);
layerSelect.addEventListener('change', fetchVWorldData);

// 페이지 로드 시 초기 데이터 조회
window.addEventListener('DOMContentLoaded', fetchVWorldData);
