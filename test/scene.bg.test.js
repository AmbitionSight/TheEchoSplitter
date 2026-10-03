import { test } from 'node:test';
import assert from 'node:assert';
import { WALL_SEAM, LIGHTS, LAYOUT, masonryPlan, slabPlan, resolveCollisions, drawScene, drawOverlay } from '../public/js/scene.js';

// 模拟 2D context：任何方法调用皆安全、任何属性可写（只断言"不抛"，不断言像素）
function mockCtx() {
  const grad = { addColorStop() {} };
  const bag = {};
  return new Proxy(bag, {
    get(t, k) {
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
      if (typeof k !== 'string') return undefined;
      return k in t ? t[k] : () => undefined;
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

test('WALL_SEAM 带高一致：面<基线<=可行走线，碰撞下界引用同一常量', () => {
  assert.ok(WALL_SEAM.face < WALL_SEAM.base);
  assert.ok(WALL_SEAM.base <= WALL_SEAM.walk);
  const p = resolveCollisions({ x: 640, y: 100 });
  assert.ok(p.y >= WALL_SEAM.walk);
});

test('masonryPlan 同种子确定、错缝覆盖全宽、含苔藓与裂纹标记', () => {
  const a = masonryPlan(23, 1280, 284), b = masonryPlan(23, 1280, 284);
  assert.deepEqual(a, b);
  for (const row of a) {
    let end = row.x0;
    for (const blk of row.blocks) {
      assert.ok(blk.w >= 60 && blk.w <= 160, `块宽 ${blk.w} 越界`);
      assert.equal(blk.x, end);            // 无缝 contiguous
      end = blk.x + blk.w;
      assert.ok(blk.t > 0.85 && blk.t < 1.15);
      assert.ok(blk.moss >= 0 && blk.moss <= 1);
    }
    assert.ok(Math.abs(end - (row.x0 + row.width)) < 1);
  }
  assert.ok(a.length >= 5);                // 284/行高42 → 6~7 行
  assert.ok(a.some(r => r.blocks.some(b => b.crack)));
  assert.ok(a.some(r => r.blocks.some(b => b.moss > 0.3)));
});

test('masonryPlan 异种子布局不同（非壁纸）', () => {
  const a = masonryPlan(23, 1280, 284), c = masonryPlan(24, 1280, 284);
  assert.notDeepEqual(a, c);
});

test('井区（x<300）苔藓密度均值高于远端（x>700）', () => {
  const rows = masonryPlan(23, 1280, 284);
  const near = [], far = [];
  for (const r of rows) for (const b of r.blocks) (b.x < 300 ? near : b.x > 700 ? far : []).push(b.moss);
  const avg = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
  assert.ok(avg(near) > avg(far));
});

test('slabPlan 同种子确定、板宽 150–220（末块收口≤380）、覆盖全宽', () => {
  const a = slabPlan(31, 1280, 300, 420), b = slabPlan(31, 1280, 300, 420);
  assert.deepEqual(a, b);
  for (const row of a) {
    let end = row.x0;
    row.blocks.forEach((s, i) => {
      assert.ok(s.w >= 150 && s.w <= 380, `板宽 ${s.w} 越界`);
      if (i < row.blocks.length - 1) assert.ok(s.w <= 220, `非末板 ${s.w} 过宽`);
      end = s.x + s.w;
    });
    assert.ok(Math.abs(end - (row.x0 + row.width)) < 1);
  }
});

test('LIGHTS 光锚点与视觉光源对齐（窗心=330,160；火盆≈障碍圆心）', () => {
  assert.equal(LIGHTS.window.x, 330);
  assert.ok(Math.abs(LIGHTS.window.y - 160) <= 2);
  const bz = LAYOUT.obstacles.find(o => o.id === 'brazier');
  assert.ok(Math.hypot(LIGHTS.brazier.x - bz.x, LIGHTS.brazier.y - bz.y) <= 10);
  for (const k of ['window', 'brazier', 'candle', 'switch']) {
    assert.ok(LIGHTS[k].r > 0 && LIGHTS[k].s > 0 && LIGHTS[k].s <= 1);
  }
});

test('drawScene/drawOverlay 冒烟：lit 全程与门开态不抛（模拟 ctx，防 glow 参数错位类死机）', () => {
  const sc = { static: { width: 1280, height: 720 }, darkness: {}, dust: [], atlases: null, lit: 1 };
  for (const lit of [0, 0.03, 0.5, 1]) {
    const views = [
      { t: 1, lit, doorState: 'closed', doorPulse: 0, doorOpen: 0, bloomed: false, hatOn: false },
      { t: 1, lit, doorState: 'opened', doorPulse: 0.4, doorOpen: 1, bloomed: true, hatOn: true, benchHot: true, craftSlots: [null, null, null, null], switchOn: true }
    ];
    for (const view of views) {
      assert.doesNotThrow(() => drawScene(mockCtx(), sc, view), `drawScene lit=${lit}`);
      assert.doesNotThrow(() => drawOverlay(mockCtx(), sc, view), `drawOverlay lit=${lit}`);
    }
  }
});
