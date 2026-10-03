import { test } from 'node:test';
import assert from 'node:assert';
import { createServer } from '../server.js';

const get = url => fetch(url);

async function listen() {
  const server = createServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { server, base };
}

test('GET /api/chapter1 返回 JSON 且双词齐全', async t => {
  const { server, base } = await listen();
  t.after(() => server.close());
  const res = await get(base + '/api/chapter1');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
  const data = await res.json();
  assert.deepEqual(Object.keys(data.words).sort(), ['hello', 'open']);
});

test('GET / 返回 index.html', async t => {
  const { server, base } = await listen();
  t.after(() => server.close());
  const res = await get(base + '/');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const body = await res.text();
  assert.ok(body.includes('析声者'));
});

test('静态 js 文件返回正确 MIME，越权路径 403/404', async t => {
  const { server, base } = await listen();
  t.after(() => server.close());
  const res = await get(base + '/js/main.js');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/javascript/);
  const bad = await get(base + '/../server.js');
  assert.ok([403, 404].includes(bad.status));
  const missing = await get(base + '/nope.xyz');
  assert.equal(missing.status, 404);
});
