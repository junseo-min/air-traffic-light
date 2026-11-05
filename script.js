// Vercel 서버리스 함수 엔드포인트 상대 경로를 지정합니다.
const API_ENDPOINT = '/api/dust';

// DOM 요소들을 불러옵니다.
const sidoSelect = document.getElementById('sidoSelect');
const selectedRegionName = document.getElementById('selectedRegionName');
const trafficLightBanner = document.getElementById('trafficLightBanner');
const statusEmoji = document.getElementById('statusEmoji');
const statusGradeText = document.getElementById('statusGradeText');
const averagePm10Element = document.getElementById('averagePm10');
const actionTip = document.getElementById('actionTip');
const updateTimeText = document.getElementById('updateTimeText');
const cardsGrid = document.getElementById('cardsGrid');
const chartCanvas = document.getElementById('pm10Chart');

// Chart.js 인스턴스를 저장해둘 전역 변수입니다.
let pm10ChartInstance = null;

// 미세먼지 등급별 이모지, 라벨, 색상, 행동요령 팁 매핑 객체입니다.
const GRADE_CONFIG = {
  '1': {
    emoji: '🔵',
    label: '좋음',
    className: 'grade-1',
    color: '#2563eb',
    tip: '공기가 맑고 쾌적해요! 기분 좋은 야외활동을 즐겨보세요.'
  },
  '2': {
    emoji: '🟢',
    label: '보통',
    className: 'grade-2',
    color: '#16a34a',
    tip: '무난한 공기 상태입니다. 일상적인 야외활동이 가능해요.'
  },
  '3': {
    emoji: '🟠',
    label: '나쁨',
    className: 'grade-3',
    color: '#ea580c',
    tip: '외출 시 마스크를 챙기세요! 무리한 실외 활동은 줄이세요.'
  },
  '4': {
    emoji: '🔴',
    label: '매우나쁨',
    className: 'grade-4',
    color: '#dc2626',
    tip: '외출 시 마스크를 챙기세요! 가급적 실내에 머무르는 것을 권장합니다.'
  },
  'default': {
    emoji: '⚪',
    label: '측정 안 됨',
    className: 'grade-none',
    color: '#94a3b8',
    tip: '실시간 측정 데이터를 확인하고 있습니다.'
  }
};

// 미세먼지 수치(PM10)에 따라 등급 객체를 반환하는 함수입니다.
function getGradeByValue(value) {
  // 숫자가 아니거나 유효하지 않은 경우 기본값을 반환합니다.
  if (value === null || value === undefined || isNaN(value)) return GRADE_CONFIG['default'];
  // 한국환경공단 기준: 30 이하 좋음, 80 이하 보통, 150 이하 나쁨, 그 이상 매우나쁨
  if (value <= 30) return GRADE_CONFIG['1'];
  if (value <= 80) return GRADE_CONFIG['2'];
  if (value <= 150) return GRADE_CONFIG['3'];
  return GRADE_CONFIG['4'];
}

// 등급 문자열(1~4)을 확인하여 안전하게 등급 설정 객체를 반환합니다.
function resolveGrade(gradeCode) {
  // 등급 코드가 존재하고 설정에 매핑되어 있으면 해당 등급을 반환합니다.
  if (gradeCode && GRADE_CONFIG[String(gradeCode).trim()]) {
    return GRADE_CONFIG[String(gradeCode).trim()];
  }
  // 그 외 비어있거나 올바르지 않은 값이면 회색(기본값)을 반환합니다.
  return GRADE_CONFIG['default'];
}

// 에어코리아 시간 문자열('2026-11-05 09:00')을 '2026년 11월 5일 9시 기준' 형식으로 변환합니다.
function formatKoreanDateTime(dataTime) {
  // 시간 데이터가 없거나 '-'일 경우 처리합니다.
  if (!dataTime || dataTime === '-') return '측정 시각 정보 없음';
  
  // 정규식을 사용해 연, 월, 일, 시를 추출합니다.
  const match = dataTime.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{1,2}):\d{2}/);
  if (match) {
    const year = match[1];
    const month = parseInt(match[2], 10);
    const day = parseInt(match[3], 10);
    const hour = parseInt(match[4], 10);
    return `${year}년 ${month}월 ${day}일 ${hour}시 기준`;
  }
  // 매칭되지 않을 경우 원본 문자열 뒤에 '기준'을 붙여 반환합니다.
  return `${dataTime} 기준`;
}

// 수치가 '-' 이거나 없을 때 '측정 안 됨'으로 표시하고, 유효하면 단위(µg/m³)를 붙입니다.
function formatValue(value) {
  // 값이 없거나 공백을 제거했을 때 '-' 또는 빈 문자열이면 '측정 안 됨'을 반환합니다.
  if (!value || String(value).trim() === '-' || String(value).trim() === '') {
    return '측정 안 됨';
  }
  // 유효한 수치인 경우 단위와 함께 반환합니다.
  return `${value} µg/m³`;
}

// 에어코리아 서버리스 API를 호출하여 시도별 대기오염 정보를 조회하는 함수입니다.
async function fetchAirQualityData(sidoName = '서울') {
  // 데이터를 불러오는 동안 화면 각 영역에 로딩 문구를 설정합니다.
  cardsGrid.innerHTML = '<div class="loading-message">데이터를 불러오는 중...</div>';
  trafficLightBanner.className = 'traffic-light-banner grade-none';
  statusEmoji.textContent = '⏳';
  statusGradeText.textContent = '불러오는 중...';
  averagePm10Element.textContent = '-';
  actionTip.textContent = '최신 대기오염 측정 데이터를 조회하고 있습니다...';
  updateTimeText.textContent = '불러오는 중...';

  try {
    // 서버리스 API 주소로 시도 데이터를 비동기 요청합니다.
    const response = await fetch(`${API_ENDPOINT}?sido=${encodeURIComponent(sidoName)}`);
    // 응답 본문을 JSON 객체로 변환합니다.
    const result = await response.json();

    // 서버 오류 또는 에러 응답이 수신된 경우 예외를 발생시킵니다.
    if (!response.ok || result.error) {
      throw new Error(result.error || `서버 응답 오류 (상태: ${response.status})`);
    }

    // 측정소 목록 배열을 추출합니다.
    const items = result?.response?.body?.items;

    // 측정 데이터가 없거나 비어있는 경우 안내 문구를 출력합니다.
    if (!items || !Array.isArray(items) || items.length === 0) {
      cardsGrid.innerHTML = '<div class="empty-message">해당 지역의 실시간 측정 데이터가 없습니다.</div>';
      statusEmoji.textContent = '⚪';
      statusGradeText.textContent = '데이터 없음';
      averagePm10Element.textContent = '측정 안 됨';
      actionTip.textContent = '측정소에서 전달된 데이터가 없습니다.';
      updateTimeText.textContent = '-';
      renderChart([]);
      return;
    }

    // 정상 데이터를 바탕으로 공기 신호등, 차트, 카드를 렌더링합니다.
    renderAirQuality(items);
  } catch (error) {
    // 통신 오류 또는 파싱 에러 발생 시 사용자에게 한국어 에러 메시지를 표시합니다.
    console.error('대기오염정보 조회 실패:', error);
    cardsGrid.innerHTML = `<div class="error-message">데이터를 불러오는 중 오류가 발생했습니다.<br>${error.message}</div>`;
    statusEmoji.textContent = '⚠️';
    statusGradeText.textContent = '조회 오류';
    averagePm10Element.textContent = '오류';
    actionTip.textContent = '네트워크 연결 또는 서버 설정을 확인해주세요.';
    updateTimeText.textContent = '확인 필요';
    renderChart([]);
  }
}

// 수신한 측정소 데이터를 바탕으로 전체 화면을 렌더링하는 함수입니다.
function renderAirQuality(items) {
  // 평균 계산용 변수들입니다.
  let validPm10Sum = 0;
  let validCount = 0;
  let cardsHtml = '';
  let latestDataTime = '-';

  // 가로 막대그래프 생성을 위해 유효한 수치만 모을 배열입니다.
  const chartItems = [];

  // 측정소 목록을 순회하며 데이터를 처리합니다.
  items.forEach(item => {
    const stationName = item.stationName || '측정소명 없음';
    const pm10Raw = item.pm10Value;
    const pm25Raw = item.pm25Value;
    const dataTime = item.dataTime || '-';
    const pm10Grade = item.pm10Grade;

    // 가장 최근 측정 시각을 기록합니다.
    if (dataTime !== '-' && latestDataTime === '-') {
      latestDataTime = dataTime;
    }

    // 미세먼지 수치가 '-'가 아니고 유효한 숫자인지 검사합니다.
    const isPm10Valid = pm10Raw && pm10Raw.trim() !== '-' && !isNaN(Number(pm10Raw));
    if (isPm10Valid) {
      const pm10Num = Number(pm10Raw);
      validPm10Sum += pm10Num;
      validCount += 1;
      
      // 차트에 표시할 측정소 정보(이름, 수치, 등급)를 배열에 추가합니다.
      chartItems.push({
        stationName,
        pm10Value: pm10Num,
        gradeCode: pm10Grade
      });
    }

    // 카드에 표시할 포맷 텍스트와 등급 정보를 구성합니다.
    const displayPm10 = formatValue(pm10Raw);
    const displayPm25 = formatValue(pm25Raw);
    const gradeInfo = resolveGrade(pm10Grade);
    const koreanCardTime = formatKoreanDateTime(dataTime);

    // 측정소 카드 HTML을 생성합니다 (테두리와 배경에 은은한 등급색 반영).
    cardsHtml += `
      <article class="station-card ${gradeInfo.className}">
        <div class="card-header">
          <h3 class="station-name">${stationName}</h3>
          <span class="card-grade-badge ${gradeInfo.className}">${gradeInfo.label}</span>
        </div>
        <div class="card-body">
          <div class="card-info-row">
            <span class="info-label">미세먼지 (PM10)</span>
            <span class="info-value">${displayPm10}</span>
          </div>
          <div class="card-info-row">
            <span class="info-label">초미세먼지 (PM2.5)</span>
            <span class="info-value">${displayPm25}</span>
          </div>
        </div>
        <div class="card-time">${koreanCardTime}</div>
      </article>
    `;
  });

  // 측정소 카드 그리드에 HTML을 주입합니다.
  cardsGrid.innerHTML = cardsHtml;

  // 상단 '공기 신호등' 배너 업데이트
  if (validCount > 0) {
    // 평균 미세먼지 수치를 정수로 계산합니다.
    const averageValue = Math.round(validPm10Sum / validCount);
    // 평균 수치 기반 등급 정보를 가져옵니다.
    const avgGrade = getGradeByValue(averageValue);

    // 신호등 배너의 스타일 클래스를 등급에 맞게 변경합니다.
    trafficLightBanner.className = `traffic-light-banner ${avgGrade.className}`;
    // 대표 이모지(🔵🟢🟠🔴)를 크게 표시합니다.
    statusEmoji.textContent = avgGrade.emoji;
    // 상태 텍스트(좋음/보통/나쁨/매우나쁨)를 크게 표시합니다.
    statusGradeText.textContent = avgGrade.label;
    // 평균 수치를 표시합니다.
    averagePm10Element.textContent = `${averageValue} µg/m³`;
    // 한 줄 안내 문구를 등급에 맞게 표시합니다.
    actionTip.textContent = avgGrade.tip;
  } else {
    // 유효한 측정 데이터가 없는 경우
    trafficLightBanner.className = 'traffic-light-banner grade-none';
    statusEmoji.textContent = '⚪';
    statusGradeText.textContent = '측정 안 됨';
    averagePm10Element.textContent = '측정 안 됨';
    actionTip.textContent = '현재 해당 지역의 유효한 측정 정보가 없습니다.';
  }

  // 상단 한국어 측정 시각 표시를 갱신합니다.
  updateTimeText.textContent = formatKoreanDateTime(latestDataTime);

  // 가로 막대그래프를 렌더링합니다.
  renderChart(chartItems);
}

// Chart.js를 사용해 상위 10개 측정소 가로 막대그래프를 그리는 함수입니다.
function renderChart(validItems) {
  // 기존에 그려진 차트가 있다면 메모리 및 중복 방지를 위해 파괴(destroy)합니다.
  if (pm10ChartInstance) {
    pm10ChartInstance.destroy();
    pm10ChartInstance = null;
  }

  // 유효한 측정소가 없을 경우 차트 그리기를 건너뜁니다.
  if (!validItems || validItems.length === 0) {
    return;
  }

  // 미세먼지 수치가 높은 순(내림차순)으로 정렬하고 상위 10개만 추출합니다.
  const top10Items = [...validItems]
    .sort((a, b) => b.pm10Value - a.pm10Value)
    .slice(0, 10);

  // 차트에 사용할 라벨(측정소명), 수치(데이터), 막대 색상 배열을 생성합니다.
  const labels = top10Items.map(item => item.stationName);
  const dataValues = top10Items.map(item => item.pm10Value);
  const barColors = top10Items.map(item => {
    // 등급 코드가 있으면 해당 색상, 없으면 수치 기준 등급 색상을 적용합니다.
    const grade = item.gradeCode ? resolveGrade(item.gradeCode) : getGradeByValue(item.pm10Value);
    return grade.color;
  });

  // Chart.js 가로 막대그래프 인스턴스를 생성합니다.
  pm10ChartInstance = new Chart(chartCanvas, {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: '미세먼지 (PM10 µg/m³)',
        data: dataValues,
        backgroundColor: barColors,
        borderRadius: 8,
        borderSkipped: false,
        barThickness: 20
      }]
    },
    options: {
      indexAxis: 'y', // 가로 막대그래프로 설정합니다.
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false // 범례 숨김
        },
        tooltip: {
          callbacks: {
            label: function(context) {
              return ` 미세먼지: ${context.parsed.x} µg/m³`;
            }
          }
        }
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: {
            color: '#f1f5f9'
          },
          title: {
            display: true,
            text: '농도 (µg/m³)',
            font: {
              family: 'Pretendard',
              size: 12,
              weight: 'bold'
            },
            color: '#64748b'
          }
        },
        y: {
          grid: {
            display: false
          },
          ticks: {
            font: {
              family: 'Pretendard',
              size: 13,
              weight: 'bold'
            },
            color: '#334155'
          }
        }
      }
    }
  });
}

// 시도 선택 드롭다운의 값이 변경될 때마다 데이터를 다시 조회하는 이벤트 리스너를 등록합니다.
sidoSelect.addEventListener('change', (event) => {
  const selectedSido = event.target.value;
  selectedRegionName.textContent = selectedSido;
  fetchAirQualityData(selectedSido);
});

// 페이지가 처음 로드되었을 때 초기 선택값(서울)으로 데이터를 자동 조회합니다.
window.addEventListener('DOMContentLoaded', () => {
  fetchAirQualityData(sidoSelect.value || '서울');
});