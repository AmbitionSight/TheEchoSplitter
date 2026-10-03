import http from 'node:http';
import os from 'node:os';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp'
};

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const api = url.pathname.match(/^\/api\/chapter([1-9])$/);
      if (api) {
        const body = await readFile(join(ROOT, 'content', `chapter${api[1]}.json`));
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
  const PORT = Number(process.env.PORT || 3000);
  createServer().listen(PORT, '0.0.0.0', () => {
    console.log(`析声者  端口 ${PORT}`);
    for (const ip of lanIPs()) console.log(`  内网:   http://${ip}:${PORT}`);
  });
}
