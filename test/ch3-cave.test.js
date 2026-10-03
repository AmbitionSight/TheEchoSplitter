import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rng, cavePlan, stalactitePlan, CAVE_SEEDS, CAVE_PAL } from '../public/js/ch3/cave.js';

test('rng：同种子同序列，值域 [0,1)，异种子序列不同', () => {
  const a = rng(41), b = rng(41), c = rng(42);
  const sa = Array.from({ length: 8 }, () => a());
  const sb = Array.from({ length: 8 }, () => b());
  const sc = Array.from({ length: 8 }, () => c());
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  for (const v of sa) assert.ok(v >= 0 && v < 1, `越界 ${v}`);
});

test('cavePlan：同种子输出全等，异种子布局不同', () => {
  assert.deepEqual(cavePlan(41, 1280, 590), cavePlan(41, 1280, 590));
  assert.notDeepEqual(cavePlan(41, 1280, 590), cavePlan(42, 1280, 590));
});

test('cavePlan 结构：顶点数/面数正确，面四角取自共享顶点', () => {
  const p = cavePlan(41, 1280, 590, { cols: 7, rows: 5 });
  assert.equal(p.verts.length, (7 + 1) * (5 + 1));
  assert.equal(p.faces.length, 7 * 5);
  const key = ([x, y]) => `${x},${y}`;
  const vset = new Set(p.verts.map(key));
  for (const f of p.faces) {
    assert.equal(f.pts.length, 4);
    for (const pt of f.pts) assert.ok(vset.has(key(pt)), `面角不在共享顶点表里：${key(pt)}`);
  }
});

test('cavePlan 无缝隙：每个网格单元的四个角都被某个面引用', () => {
  const cols = 7, rows = 5;
  const p = cavePlan(41, 1280, 590, { cols, rows });
  const used = new Set(p.faces.flatMap(f => f.pts.map(([x, y]) => `${x},${y}`)));
  assert.equal(used.size, p.verts.length, '每个共享顶点都必须被至少一个面用到');
});

test('cavePlan 面属性：t ∈ (0.9,1.1)、wet ∈ [0,1]、crack 为布尔、speck 为非负整数', () => {
  for (const f of cavePlan(41, 1280, 590).faces) {
    assert.ok(f.t > 0.9 && f.t < 1.1, `t=${f.t}`);
    assert.ok(f.wet >= 0 && f.wet <= 1, `wet=${f.wet}`);
    assert.equal(typeof f.crack, 'boolean');
    assert.ok(Number.isInteger(f.speck) && f.speck >= 0, `speck=${f.speck}`);
  }
});

test('cavePlan 边界：W=0 / H=0 / cols=1 都不抛错', () => {
  assert.doesNotThrow(() => cavePlan(41, 0, 590));
  assert.doesNotThrow(() => cavePlan(41, 1280, 0));
  assert.doesNotThrow(() => cavePlan(41, 1280, 590, { cols: 1, rows: 1 }));
});

test('stalactitePlan：数量正确、同种子全等、全部落在 [0,W] 内', () => {
  const a = stalactitePlan(41, 1280, 0, 9);
  assert.equal(a.length, 9);
  assert.deepEqual(a, stalactitePlan(41, 1280, 0, 9));
  assert.notDeepEqual(a, stalactitePlan(42, 1280, 0, 9));
  for (const s of a) {
    assert.ok(s.x >= 0 && s.x <= 1280, `x=${s.x}`);
    assert.ok(s.h > 0, `h=${s.h}`);
    assert.ok(s.w > 0, `w=${s.w}`);
    assert.ok(s.lean >= -1 && s.lean <= 1, `lean=${s.lean}`);
  }
});

test('stalactitePlan：count=0 返回空数组，不抛错', () => {
  assert.deepEqual(stalactitePlan(41, 1280, 0, 0), []);
});

test('CAVE_SEEDS：三间房各有一个不同种子；CAVE_PAL 全是合法十六进制色', () => {
  const seeds = Object.values(CAVE_SEEDS);
  assert.equal(new Set(seeds).size, seeds.length);
  for (const v of Object.values(CAVE_PAL)) assert.match(v, /^#[0-9a-f]{6}$/i);
});

test('湿度梯度：wetRange 左低右高时，右半面平均 wet 高于左半面', () => {
  const p = cavePlan(41, 1280, 590, { cols: 8, rows: 2, wetRange: [0.05, 0.75] });
  const mid = 1280 / 2;
  const left = p.faces.filter(f => f.pts[0][0] < mid);
  const right = p.faces.filter(f => f.pts[0][0] >= mid);
  const avg = a => a.reduce((s, f) => s + f.wet, 0) / a.length;
  assert.ok(avg(right) > avg(left), `左 ${avg(left)} 右 ${avg(right)}`);
});
