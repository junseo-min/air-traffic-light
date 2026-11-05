# 🗺️ VWorld 공간정보 대시보드

국토교통부 브이월드(api.vworld.kr/req/data) 2D 데이터 오픈API를 활용하여 시도별 행정구역 공간정보(시군구, 읍면동 등)를 실시간으로 조회하고 시각화하는 반응형 웹 대시보드입니다.

## ✨ 주요 기능
- **공간정보 요약 배너**: 선택 지역의 총 구역 수, 대표 지표 및 실시간 조회 시각 안내
- **Chart.js 가로 막대그래프**: 지역 내 행정단위별 식별 코드 분포 상위 10개 시각화
- **상세 공간정보 카드 그리드**: 구/동별 명칭, 고유 행정코드, 전체 행정구역명 상세 카드 렌더링
- **Vercel 서버리스 아키텍처**: `/api/data` 서버리스 함수로 브이월드 API Key와 Domain 파라미터 안전 은닉
- **반응형 디자인 & Pretendard 폰트**: 모바일 및 PC 환경 최적화

## 🛠 기술 스택
- **프론트엔드**: HTML5, CSS3, JavaScript (Vanilla ES6+), Chart.js, Pretendard
- **백엔드**: Vercel Serverless Function (Node.js)
- **데이터 출처**: 국토교통부 브이월드 국가공간정보 오픈플랫폼 (Data API / GetFeature)

## 🚀 로컬 실행 방법
1. `.env.local` 파일에 브이월드 인증키를 입력합니다:
   ```env
   VWORLD_KEY=발급받은_브이월드_인증키
   VWORLD_DOMAIN=localhost
   ```
2. 로컬 서버를 실행합니다:
   ```bash
   node server.js
   ```
3. 브라우저에서 `http://localhost:3000`으로 접속합니다.
