import { test } from 'node:test';
import assert from 'node:assert';
import { waveSegments } from '../public/js/journal.js';

test('waveSegments：按时长比例铺满宽度，段间 4px', () => {
  const segs = waveSegments([['h', 70], ['ə', 90], ['l', 80], ['əʊ', 200]], 404);
  assert.equal(segs.length, 4);
  assert.ok(Math.abs(segs.reduce((s, x) => s + x.w, 0) - (404 - 12)) < 0.001); // Node20 无 assert.closeTo，同语义改写（同 scene.test.js 惯例）
  assert.ok(segs[3].w > segs[2].w && segs[3].w > segs[0].w);       // əʊ 最长
  assert.equal(segs[1].x, segs[0].x + segs[0].w + 4);
});
