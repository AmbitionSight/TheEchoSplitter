import http from 'node:http';
import crypto from 'node:crypto';
import os from 'node:os';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

// —— HTTP Basic 认证（内网部署：用户名 PanPan / 密码 LeLe）——
const AUTH_EXPECTED = Buffer.from('PanPan:LeLe').toString('base64');
function authorized(req) {
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const a = Buffer.from(h.slice(6).trim());
  const b = Buffer.from(AUTH_EXPECTED);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function createServer({ auth = true } = {}) {
  return http.createServer(async (req, res) => {
    try {
      if (auth && !authorized(req)) {
        res.writeHead(401, {
          'WWW-Authenticate': 'Basic realm="EchoStone", charset="UTF-8"',
          'Content-Type': 'text/plain; charset=utf-8'
        });
        return res.end('401');
      }
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/chapter1') {
        const body = await readFile(join(ROOT, 'content', 'chapter1.json'));
        res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
        return res.end(body);
      }
      let path = decodeURIComponent(url.pathname);
      if (path === '/') path = '/index.html';
      const file = normalize(join(ROOT, 'public', path));
      if (!file.startsWith(normalize(join(ROOT, 'public')))) { res.writeHead(403); return res.end('Forbidden'); }
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
    }
  });
}

function lanIPs() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter(n => n && n.family === 'IPv4' && !n.internal)
    .map(n => n.address);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const PORT = Number(process.env.PORT || 3001);
  const AUTH = process.env.AUTH !== '0';                    // AUTH=0 关闭认证（本机 3000 用）
  createServer({ auth: AUTH }).listen(PORT, '0.0.0.0', () => {
    console.log(`回响之石  端口 ${PORT}  认证: ${AUTH ? '开（PanPan）' : '关'}`);
    for (const ip of lanIPs()) console.log(`  内网:   http://${ip}:${PORT}`);
  });
}
