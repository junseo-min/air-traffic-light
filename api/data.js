// Vercel 서버리스 함수: 브이월드(VWorld) 국가공간정보 Data API를 안전하게 중계 호출합니다.
export default async function handler(req, res) {
  // CORS 및 응답 헤더를 설정합니다.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  // 요청 쿼리에서 sido(시도명)와 data(레이어ID)를 가져옵니다.
  const { sido = '서울', data: layer = 'LT_C_ADSIGG_INFO', size = '100', page = '1' } = req.query;

  // 서버 환경변수에서 브이월드 인증키와 도메인을 읽어옵니다.
  const apiKey = process.env.VWORLD_KEY;
  const domain = process.env.VWORLD_DOMAIN || 'localhost';

  // 인증키가 환경변수에 등록되어 있지 않은 경우의 안내입니다.
  if (!apiKey || apiKey === '여기에_브이월드_인증키_입력') {
    return res.status(500).json({
      error: 'VWorld API 인증키(VWORLD_KEY)가 설정되지 않았습니다. .env.local 또는 Vercel 환경변수를 설정해주세요.'
    });
  }

  try {
    // 브이월드 Data API 기본 URL입니다.
    const baseUrl = 'https://api.vworld.kr/req/data';

    // 요청 파라미터들을 설정합니다.
    const params = new URLSearchParams({
      service: 'data',
      request: 'GetFeature',
      data: layer,
      key: apiKey.trim(),
      domain: domain.trim(),
      format: 'json',
      errorformat: 'json',
      size: String(size),
      page: String(page),
      geometry: 'false' // 속성 정보 중심 조회를 위해 지오메트리는 false로 설정합니다.
    });

    // 시도명이 '전국'이 아닌 경우 속성 필터(attrFilter)를 적용합니다.
    if (sido && sido !== '전국') {
      params.append('attrFilter', `full_nm:like:${sido}`);
    }

    // 브이월드 Data API 엔드포인트로 GET 요청을 보냅니다.
    const apiResponse = await fetch(`${baseUrl}?${params.toString()}`);
    // 응답 텍스트를 읽어옵니다.
    const responseText = await apiResponse.text();

    // JSON 형식인지 파싱을 시도합니다.
    let jsonData;
    try {
      jsonData = JSON.parse(responseText);
    } catch (parseErr) {
      return res.status(400).json({
        error: '브이월드 API 응답을 JSON으로 변환할 수 없습니다. 인증키나 도메인을 확인해주세요.',
        raw: responseText
      });
    }

    // 브이월드 응답 상태 코드를 확인합니다 (OK / ERROR).
    const status = jsonData?.response?.status;
    if (status === 'ERROR') {
      const errText = jsonData?.response?.error?.text || '알 수 없는 브이월드 오류';
      const errCode = jsonData?.response?.error?.code || 'ERROR';
      return res.status(400).json({
        error: `브이월드 API 오류 [${errCode}]: ${errText}`,
        data: jsonData
      });
    }

    // 정상 데이터를 클라이언트로 반환합니다.
    return res.status(200).json(jsonData);
  } catch (err) {
    console.error('브이월드 API 호출 에러:', err);
    return res.status(500).json({
      error: `서버 통신 실패: ${err.message}`
    });
  }
}

