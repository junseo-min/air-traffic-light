// Vercel 서버리스 함수: 금융위원회 기업 재무정보 API를 안전하게 중계 호출합니다.
export default async function handler(req, res) {
  // CORS 및 응답 헤더를 설정합니다.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // 요청 쿼리 파라미터를 추출합니다 (법인등록번호, 사업연도, 오퍼레이션 종류 등).
  const {
    crno = '1101110004380', // 기본값: 삼성전자 법인번호
    bizYear = '2023',       // 기본값: 2023년 사업연도
    type = 'getSummFinaStat_V2', // 기본 오퍼레이션: 요약재무제표
    numOfRows = '50',
    pageNo = '1'
  } = req.query;

  // 서버 환경변수에서 공공데이터포털 인증키를 읽어옵니다.
  const serviceKey = process.env.FINANCE_KEY || process.env.AIRKOREA_KEY;

  // 인증키 미등록 시 안내 메시지를 반환합니다.
  if (!serviceKey || serviceKey.startsWith('여기에')) {
    return res.status(500).json({
      error: '금융위원회 API 인증키(FINANCE_KEY)가 설정되지 않았습니다. .env.local 또는 Vercel 환경변수를 설정해주세요.'
    });
  }

  try {
    // 금융위원회 기업 재무정보 API 기본 엔드포인트 URL을 구성합니다.
    const baseUrl = `https://apis.data.go.kr/1160100/service/GetFinaStatInfoService_V2/${type}`;

    // 인증키 인코딩 문제를 방지하기 위해 디코딩 후 안전하게 인코딩합니다.
    const safeKey = encodeURIComponent(decodeURIComponent(serviceKey.trim()));

    // 요청 URL을 조합합니다.
    const apiUrl = `${baseUrl}?serviceKey=${safeKey}&resultType=json&numOfRows=${numOfRows}&pageNo=${pageNo}&bizYear=${bizYear}&crno=${crno}`;

    // 공공데이터 API 서버로 비동기 GET 요청을 전송합니다.
    const apiResponse = await fetch(apiUrl);
    const responseText = await apiResponse.text();

    // 응답 결과가 JSON인지 검사합니다 (XML 에러 메시지 대응).
    let jsonData;
    try {
      jsonData = JSON.parse(responseText);
    } catch (parseError) {
      return res.status(400).json({
        error: '공공데이터포털 API 응답이 JSON 형식이 아닙니다. 인증키가 등록되었는지 확인해주세요.',
        raw: responseText
      });
    }

    // 응답 헤더의 resultCode 검증
    const resultCode = jsonData?.response?.header?.resultCode;
    const resultMsg = jsonData?.response?.header?.resultMsg;

    if (resultCode && resultCode !== '00' && resultCode !== '0') {
      return res.status(400).json({
        error: `금융위원회 API 오류 [${resultCode}]: ${resultMsg || '조회 실패'}`,
        data: jsonData
      });
    }

    // 정상 재무정보 응답을 클라이언트로 반환합니다.
    return res.status(200).json(jsonData);
  } catch (err) {
    console.error('기업 재무정보 API 호출 에러:', err);
    return res.status(500).json({
      error: `서버 내부 오류가 발생했습니다: ${err.message}`
    });
  }
}

