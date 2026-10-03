// —— 直接单测 ch1 分层模块：planners（绕过 scene.js 兼容入口，锁死层边界）——
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LAYOUT, WALL_SEAM, masonryPlan, slabPlan } from '../public/js/ch1/planners.js';

const W = LAYOUT.W;

test('常量事实源：W/H、可行走线、磁吸半径直接来自 planners 模块', () => {
  assert.equal(LAYOUT.W, 1280);
  assert.equal(LAYOUT.H, 720);
  assert.equal(WALL_SEAM.walk, 340);
  assert.equal(LAYOUT.MAGNET_R, 46);
  assert.ok(WALL_SEAM.face < WALL_SEAM.base && WALL_SEAM.base <= WALL_SEAM.walk);
});

test('masonryPlan：同种子输出全等，异种子布局不同（直接模块）', () => {
  assert.deepEqual(masonryPlan(23, W, WALL_SEAM.face), masonryPlan(23, W, WALL_SEAM.face));
  assert.notDeepEqual(masonryPlan(23, W, WALL_SEAM.face), masonryPlan(24, W, WALL_SEAM.face));
});

test('masonryPlan 结构：行高 42 递增、奇偶错缝、块连续且末块收口到 W', () => {
  const rows = masonryPlan(23, W, WALL_SEAM.face);
  assert.ok(rows.length >= 5, `行数 ${rows.length}`);
  rows.forEach((row, i) => {
    assert.equal(row.y, i * 42, '行 y 按 42 单调递增');
    assert.equal(row.x0, i % 2 ? -30 : 0, '奇偶行错缝');
    assert.equal(row.width, W - row.x0);
    assert.ok(row.blocks.length >= 1, 'faceH 足够时每行至少一块');
    let end = row.x0;
    row.blocks.forEach((b, j) => {
      assert.equal(b.x, end, '块必须无缝连续');
      const last = j === row.blocks.length - 1;
      if (last) assert.ok(Math.abs(b.x + b.w - W) < 1e-9, `末块收口到 W，实为 ${b.x + b.w}`);
      else assert.ok(b.w >= 60 && b.w <= 96, `非末块宽 60..96，实为 ${b.w}`);
      assert.equal(b.y, row.y);
      assert.ok(b.t > 0.9 && b.t < 1.1, `明度 ${b.t}`);
      assert.ok(b.moss === 0 || (b.moss >= 0.35 && b.moss < 0.95), `苔藓 ${b.moss}`);
      assert.equal(typeof b.crack, 'boolean');
      end = b.x + b.w;
    });
  });
});

test('slabPlan：同种子输出全等，异种子布局不同（直接模块）', () => {
  assert.deepEqual(slabPlan(31, W, WALL_SEAM.base, LAYOUT.H - WALL_SEAM.base), slabPlan(31, W, WALL_SEAM.base, LAYOUT.H - WALL_SEAM.base));
  assert.notDeepEqual(slabPlan(31, W, WALL_SEAM.base, LAYOUT.H - WALL_SEAM.base), slabPlan(32, W, WALL_SEAM.base, LAYOUT.H - WALL_SEAM.base));
});

test('slabPlan 结构：行高 96..125、无缝隙覆盖 [y0,y0+H)、块连续且末块收口到 W', () => {
  const y0 = WALL_SEAM.base, H = LAYOUT.H - WALL_SEAM.base, rows = slabPlan(31, W, y0, H);
  assert.ok(rows.length >= 3, `行数 ${rows.length}`);
  assert.equal(rows[0].y, y0);
  let prevEnd = y0;
  rows.forEach((row, i) => {
    assert.equal(row.y, prevEnd, '行首尾相接无缝隙');
    assert.equal(row.x0, i % 2 ? -80 : 0, '奇偶行错缝');
    const h = row.blocks[0].h;
    if (i < rows.length - 1) assert.ok(h >= 96 && h <= 125, `行高 96..125，实为 ${h}`);
    prevEnd = row.y + h;
    let end = row.x0;
    row.blocks.forEach((b, j) => {
      assert.equal(b.x, end, '板必须无缝连续');
      const last = j === row.blocks.length - 1;
      if (last) assert.ok(Math.abs(b.x + b.w - W) < 1e-9, `末板收口到 W，实为 ${b.x + b.w}`);
      else assert.ok(b.w >= 150 && b.w <= 220, `非末板宽 150..220，实为 ${b.w}`);
      assert.equal(b.h, h, '同一行板高一致');
      assert.ok(b.t > 0.92 && b.t < 1.08, `明度 ${b.t}`);
      assert.equal(typeof b.crack, 'boolean');
      end = b.x + b.w;
    });
  });
  assert.ok(Math.abs(prevEnd - (y0 + H)) < 1e-9, `行覆盖到 y0+H，实为 ${prevEnd}`);
});

test('planners 边界：W=0、faceH/H=0 与极小面高都不抛错', () => {
  // W=0：奇数行会得到一个余块，偶数行为空；只要求返回合法结构，不要求非空
  const m0 = masonryPlan(23, 0, WALL_SEAM.face);
  assert.ok(Array.isArray(m0) && m0.every(r => Array.isArray(r.blocks)));
  assert.deepEqual(masonryPlan(23, W, 0), []);

  const s0 = slabPlan(31, 0, WALL_SEAM.base, LAYOUT.H - WALL_SEAM.base);
  assert.ok(Array.isArray(s0) && s0.every(r => Array.isArray(r.blocks)));
  assert.deepEqual(slabPlan(31, W, WALL_SEAM.base, 0), []);

  assert.doesNotThrow(() => masonryPlan(23, W, 5), 'faceH 极小不抛');
  assert.equal(masonryPlan(23, W, 5).length, 1, 'faceH=5 只产生一行');
  assert.doesNotThrow(() => slabPlan(31, W, WALL_SEAM.base, 10), 'H 极小不抛');
});
