import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rng, cavePlan, stalactitePlan, CAVE_SEEDS, CAVE_PAL } from '../public/js/ch3/cave.js';
import { contactShadow, drawCaveWall, drawCaveFloor, drawStalactites,
         createScene, initScene, drawScene, drawCrack, drawBoulder } from '../public/js/ch3/render.js';

// 宽松 canvas 桩（同 test/scene.bg.test.js）：任何方法可调、任何属性可写，只断言「不抛」
function mockCtx() {
  const grad = { addColorStop() {} };
  return new Proxy({}, {
    get(t, k) {
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
      if (typeof k !== 'string') return undefined;
      return k in t ? t[k] : () => undefined;
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

// 记录型 canvas 桩（同 test/art.test.js 风格）。
// __calls 计数；__pts 只记 moveTo/lineTo 的折点——椭圆/圆弧不入 __pts，
// 这样「物件包围盒」类断言不会被落地影干扰。
function recordingCtx() {
  const calls = { fill: 0, stroke: 0, ellipse: 0, arc: 0, moveTo: 0, lineTo: 0, fillRect: 0, quadraticCurveTo: 0 };
  const pts = [];
  const grad = { addColorStop() {} };
  return new Proxy({ __calls: calls, __pts: pts }, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
      if (k === 'moveTo' || k === 'lineTo') return (px, py) => { calls[k]++; pts.push([px, py]); };
      return () => { if (k in calls) calls[k]++; };
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

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

test('contactShadow：恰好一枚椭圆 + 一次填充，且不画圆弧', () => {
  const x = recordingCtx();
  contactShadow(x, 640, 590, 60);
  assert.equal(x.__calls.ellipse, 1);
  assert.equal(x.__calls.fill, 1);
  assert.equal(x.__calls.arc, 0);
});

test('drawCaveWall：每个岩面至少一次填充（逐块上色）', () => {
  const plan = cavePlan(41, 1280, 590, { cols: 4, rows: 3 });
  const x = recordingCtx();
  drawCaveWall(x, plan, { base: CAVE_PAL.rockA, moss: CAVE_PAL.moss, mossHi: CAVE_PAL.mossHi });
  assert.ok(x.__calls.fill >= plan.faces.length, `fill=${x.__calls.fill} 面数=${plan.faces.length}`);
});

test('drawCaveFloor：不抛错且至少一次填充', () => {
  const plan = cavePlan(41, 1280, 200, { cols: 4, rows: 2 });
  const x = recordingCtx();
  assert.doesNotThrow(() => drawCaveFloor(x, plan, { base: CAVE_PAL.floor }));
  assert.ok(x.__calls.fill >= 1);
});

test('drawStalactites：每根至少一次填充；空数组不抛错', () => {
  const x = recordingCtx();
  const plan = stalactitePlan(41, 1280, 0, 5);
  drawStalactites(x, plan, 0, CAVE_PAL.rockDark);
  assert.ok(x.__calls.fill >= plan.length);
  assert.doesNotThrow(() => drawStalactites(recordingCtx(), [], 0, CAVE_PAL.rockDark));
});

test('drawCaveWall：苔藓只画在湿面上（湿面苔藓绘制数远多于干面）', () => {
  // 苔藓与第一关 drawMasonry 同款，用 fillRect 画 2×2 抖动点，故这里数 fillRect 而非 fill。
  // 干面（wetRange [0,0]）的 wet 仍带 ±0.15 噪声，但密度阈值 0.30 之下不会落点。
  const dry = cavePlan(41, 1280, 590, { cols: 3, rows: 2, wetRange: [0, 0] });
  const wet = cavePlan(41, 1280, 590, { cols: 3, rows: 2, wetRange: [0.9, 0.9] });
  const xd = recordingCtx(), xw = recordingCtx();
  drawCaveWall(xd, dry, { base: CAVE_PAL.rockA, moss: CAVE_PAL.moss, mossHi: CAVE_PAL.mossHi });
  drawCaveWall(xw, wet, { base: CAVE_PAL.rockA, moss: CAVE_PAL.moss, mossHi: CAVE_PAL.mossHi });
  assert.ok(xw.__calls.fillRect > xd.__calls.fillRect * 10,
    `湿 ${xw.__calls.fillRect} 应远多于干 ${xd.__calls.fillRect}`);
});

// ---- 场景生命周期与预烘焙 ----

function roomWorld(room) {
  return {
    currentRoom: room,
    view: { t: 0 },
    geo: { bank: { groundY: 590, waterX: 760 }, crevice: { groundY: 590 }, deep: { groundY: 590 } }
  };
}

test('createScene：初始 baked 为空对象', () => {
  assert.deepEqual(createScene().baked, {});
});

test('initScene 在无 document 环境下不抛错，且不产生烘焙层', () => {
  const sc = createScene();
  assert.doesNotThrow(() => initScene(sc, null, { bank: { groundY: 590 } }));
  assert.equal(sc.baked.bank, undefined);
});

test('drawScene：无烘焙层时回退到旧路径且不抛错', () => {
  assert.doesNotThrow(() => drawScene(mockCtx(), createScene(), roomWorld('crevice')));
});

test('drawScene：三间房轮流绘制都不抛错（回退路径覆盖全房间）', () => {
  const sc = createScene();
  for (const room of ['bank', 'crevice', 'deep']) {
    assert.doesNotThrow(() => drawScene(mockCtx(), sc, roomWorld(room)), `${room} 抛错`);
  }
});

test('drawScene：重复绘制复用同一场景对象，不累积状态', () => {
  const sc = createScene();
  const w = roomWorld('crevice');
  drawScene(mockCtx(), sc, w);
  const snapshot = JSON.stringify(sc);
  drawScene(mockCtx(), sc, w);
  assert.equal(JSON.stringify(sc), snapshot, '场景对象在绘制后不应被改写');
});

// ---- 裂隙口 ----

test('drawCrack：不抛错，且至少一次填充 + 一次描边（唇口受光边）', () => {
  const x = recordingCtx();
  drawCrack(x, 650, 590, 41);
  assert.ok(x.__calls.fill >= 1);
  assert.ok(x.__calls.stroke >= 1);
});

test('drawCrack：同种子几何确定，异种子不同', () => {
  const a = recordingCtx(), b = recordingCtx(), c = recordingCtx();
  drawCrack(a, 650, 590, 41);
  drawCrack(b, 650, 590, 41);
  drawCrack(c, 650, 590, 42);
  assert.deepEqual(a.__pts, b.__pts);
  assert.notDeepEqual(a.__pts, c.__pts);
});

test('drawCrack：默认高 170、底半宽 35、顶半宽 12（包围盒）', () => {
  const x = recordingCtx();
  drawCrack(x, 650, 590, 41);
  const xs = x.__pts.map(p => p[0]), ys = x.__pts.map(p => p[1]);
  assert.ok(Math.abs(Math.min(...ys) - (590 - 170)) < 2, `顶部 y=${Math.min(...ys)}`);
  assert.ok(Math.abs(Math.min(...xs) - (650 - 35)) < 8, `左缘 x=${Math.min(...xs)}`);
  assert.ok(Math.abs(Math.max(...xs) - (650 + 35)) < 8, `右缘 x=${Math.max(...xs)}`);
});

test('drawCrack：自定义尺寸生效（h/halfBottom 可覆盖）', () => {
  const x = recordingCtx();
  drawCrack(x, 400, 300, 7, { h: 90, halfBottom: 20, halfTop: 6 });
  const xs = x.__pts.map(p => p[0]), ys = x.__pts.map(p => p[1]);
  assert.ok(Math.abs(Math.min(...ys) - 210) < 2, `顶部 y=${Math.min(...ys)}`);
  assert.ok(Math.abs(Math.min(...xs) - 380) < 8, `左缘 x=${Math.min(...xs)}`);
});

// ---- 洞穴巨石 ----

test('drawBoulder：不抛错，至少一次填充，且落影独立于石体（恰好一枚椭圆）', () => {
  const x = recordingCtx();
  drawBoulder(x, 515, 590, 41);
  assert.ok(x.__calls.fill >= 1);
  assert.equal(x.__calls.ellipse, 1, '恰好一枚落地影');
});

test('drawBoulder：同种子确定，异种子不同', () => {
  const a = recordingCtx(), b = recordingCtx(), c = recordingCtx();
  drawBoulder(a, 515, 590, 41);
  drawBoulder(b, 515, 590, 41);
  drawBoulder(c, 515, 590, 42);
  assert.deepEqual(a.__pts, b.__pts);
  assert.notDeepEqual(a.__pts, c.__pts);
});

test('drawBoulder：水平范围不越出 [cx-45, cx+45]', () => {
  const x = recordingCtx();
  drawBoulder(x, 515, 590, 41, 90);
  const xs = x.__pts.map(p => p[0]);
  assert.ok(Math.min(...xs) >= 515 - 45 - 1, `左 ${Math.min(...xs)}`);
  assert.ok(Math.max(...xs) <= 515 + 45 + 1, `右 ${Math.max(...xs)}`);
});
