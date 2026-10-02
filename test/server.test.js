import { test } from 'node:test';
import assert from 'node:assert';
import { createServer } from '../server.js';

async function listen() {
  const server = createServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { server, base };
}

test('GET /api/chapter1 返回 JSON 且六词齐全', async () => {
  const { server, base } = await listen();
  const res = await fetch(base + '/api/chapter1');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
  const data = await res.json();
  assert.deepEqual(Object.keys(data.words).sort(),
    ['fire','hat','hello','light','open','water']);
  server.close();
});

test('GET / 返回 index.html（后续任务创建后才会通过）', async () => {
  const { server, base } = await listen();
  const res = await fetch(base + '/');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const body = await res.text();
  assert.ok(body.includes('回响之石'));
  server.close();
});

test('静态 js 文件返回正确 MIME，越权路径 403/404', async () => {
  const { server, base } = await listen();
  const res = await fetch(base + '/js/main.js'); // Task 2 创建
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/javascript/);
  const bad = await fetch(base + '/../server.js');
  assert.ok([403, 404].includes(bad.status));
  const missing = await fetch(base + '/nope.xyz');
  assert.equal(missing.status, 404);
  server.close();
});
