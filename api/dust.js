// Vercel 서버리스 함수: 클라이언트 대신 에어코리아 API를 호출하고 인증키를 보호합니다.
export default async function handler(req, res) {
  // CORS 및 캐시 관련 응답 헤더를 설정합니다.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // 요청 쿼리에서 sido 값을 가져오고, 없으면 기본값으로 '서울'을 지정합니다.
  const { sido = '서울' } = req.query;

  // 서버 환경변수에서 에어코리아 인증키를 안전하게 읽어옵니다.
  const serviceKey = process.env.AIRKOREA_KEY;

  // 환경변수에 인증키가 설정되어 있지 않은 경우 에러를 반환합니다.
  if (!serviceKey) {
    return res.status(500).json({
      error: '서버 환경변수(AIRKOREA_KEY)가 설정되지 않았습니다. Vercel 환경변수나 .env.local을 확인해주세요.'
    });
  }

  try {
    // 요구사항에 맞춰 환경변수의 인코딩 키를 encodeURIComponent로 감싸 URL을 구성합니다.
    const encodedKey = encodeURIComponent(serviceKey.trim());
    // 에어코리아 시도별 실시간 측정정보 조회 API의 전체 URL을 생성합니다.
    const apiUrl = `https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty?serviceKey=${encodedKey}&returnType=json&numOfRows=100&pageNo=1&sidoName=${encodeURIComponent(sido)}&ver=1.3`;

    // 에어코리아 공공데이터 API 서버로 GET 요청을 보냅니다.
    const apiResponse = await fetch(apiUrl);

    // 응답 본문을 텍스트 형태로 먼저 읽어옵니다 (XML 에러 대응).
    const responseText = await apiResponse.text();

    // 응답 본문이 정상 JSON 형식인지 파싱을 시도합니다.
    let jsonData;
    try {
      jsonData = JSON.parse(responseText);
    } catch (parseError) {
      // JSON 파싱 실패(XML 에러 메시지 반환 등) 시 한국어 안내 메시지를 응답합니다.
      return res.status(400).json({
        error: '인증키 또는 요청값을 확인해주세요.',
        raw: responseText
      });
    }

    // 응답 본문 안의 resultCode 값을 확인합니다.
    const resultCode = jsonData?.response?.header?.resultCode;
    const resultMsg = jsonData?.response?.header?.resultMsg;

    // resultCode가 성공('00')이 아닐 경우 한국어 에러 메시지를 반환합니다.
    if (resultCode && resultCode !== '00') {
      return res.status(400).json({
        error: `공공데이터 API 처리 실패: ${resultMsg || '알 수 없는 오류'} (응답코드: ${resultCode})`,
        data: jsonData
      });
    }

    // 모든 검증을 통과한 정상 대기오염 측정 데이터를 클라이언트로 전달합니다.
    return res.status(200).json(jsonData);
  } catch (error) {
    // 서버 통신 중 예상치 못한 예외가 발생한 경우 에러 메시지를 반환합니다.
    console.error('서버리스 함수 실행 오류:', error);
    return res.status(500).json({
      error: `서버 내부 오류가 발생했습니다: ${error.message}`
    });
  }
}
