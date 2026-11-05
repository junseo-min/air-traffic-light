import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import financeHandler from './api/finance.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// .env.local 파일에서 환경변수를 로드합니다.
try {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...values] = trimmed.split('=');
        if (key && values.length > 0) {
          process.env[key.trim()] = values.join('=').trim();
        }
      }
    });
  }
} catch (e) {
  console.warn('.env.local 로드 실패:', e.message);
}

const PORT = 3000;

// MIME 타입 매핑
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml'
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // 1. 금융위원회 기업 재무정보 API 요청 처리 (/api/finance)
  if (pathname === '/api/finance' || pathname === '/api/data') {
    const query = Object.fromEntries(parsedUrl.searchParams);
    const mockReq = { query };
    const mockRes = {
      statusCode: 200,
      headers: {},
      setHeader(name, value) {
        this.headers[name] = value;
      },
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        res.writeHead(this.statusCode, {
          'Content-Type': 'application/json; charset=utf-8',
          ...this.headers
        });
        res.end(JSON.stringify(data));
      }
    };
    try {
      await financeHandler(mockReq, mockRes);
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // 2. 정적 파일 서빙: public 폴더 우선, 그 다음 루트
  const reqFile = pathname === '/' ? 'index.html' : pathname;
  let filePath = path.join(__dirname, 'public', reqFile);
  
  if (!fs.existsSync(filePath)) {
    filePath = path.join(__dirname, reqFile);
  }

  if (!fs.existsSync(filePath)) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.writeHead(200, { 'Content-Type': contentType });
  fs.createReadStream(filePath).pipe(res);
});

server.listen(PORT, () => {
  console.log(`[기업 재무정보 대시보드 로컬 서버 실행] http://localhost:${PORT}`);
});
