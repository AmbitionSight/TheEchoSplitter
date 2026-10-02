import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { INLINE_CONTENT } from '../public/js/content-fallback.js';

test('内联兜底与磁盘 content/chapter1.json 完全一致', async () => {
  const disk = JSON.parse(await readFile(new URL('../content/chapter1.json', import.meta.url), 'utf8'));
  assert.deepEqual(INLINE_CONTENT, disk);
});
