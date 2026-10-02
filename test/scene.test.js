import { test } from 'node:test';
import assert from 'node:assert';
import { LAYOUT, rng, resolveCollisions, screenToLogical, moveToward, stepStone, magnetStep } from '../public/js/scene.js';

test('rng 同种子序列确定', () => {
  const a = rng(7), b = rng(7);
  assert.equal(a(), b()); assert.equal(a(), b());
});

test('碰撞：被推离障碍圆并夹在房间边界内', () => {
  const p = { x: 210, y: 470 };                       // 井心
  resolveCollisions(p);
  const well = LAYOUT.obstacles.find(o => o.id === 'well');
  assert.ok(Math.hypot(p.x - well.x, p.y - well.y) >= well.r + 16 - 0.01);
  const q = { x: 0, y: 100 };
  resolveCollisions(q);
  assert.equal(q.x, 40); assert.equal(q.y, 340);
});

test('screenToLogical：整档与缩放档都换算正确，出界标记', () => {
  let r = screenToLogical(640, 360, { left: 0, top: 0, width: 1280, height: 720 });
  assert.deepEqual([r.x, r.y], [640, 360]); assert.ok(r.inside);
  r = screenToLogical(320, 180, { left: 0, top: 0, width: 640, height: 360 });
  assert.deepEqual([Math.round(r.x), Math.round(r.y)], [640, 360]);
  r = screenToLogical(5, 5, { left: 0, top: 0, width: 640, height: 360 });
  assert.equal(r.inside, false);
});

test('moveToward：按速度推进并在到达时返回 true', () => {
  const p = { x: 0, y: 0 };
  assert.equal(moveToward(p, { x: 30, y: 0 }, 100, 0.1), false);
  assert.equal(p.x, 10);
  assert.equal(moveToward(p, { x: 30, y: 0 }, 100, 0.5), true);
  assert.equal(p.x, 30);
});

test('石物理：上抛→重力→弹跳衰减×0.45→落定 idle', () => {
  const s = { ipa: 'l', x: 100, y: 100, vx: 0, vy: 0, state: 'fly', t: 0 };
  for (let i = 0; i < 400 && s.state !== 'idle'; i++) stepStone(s, 0.016, 500);
  assert.equal(s.state, 'idle');
  assert.ok(Math.abs(s.y - 500) < 1);
});

test('石物理：单次弹跳能量精确衰减', () => {
  const s = { ipa: 'l', x: 100, y: 500, vx: 0, vy: 200, state: 'fly', t: 0 };
  stepStone(s, 0.016, 500);
  assert.ok(s.vy > -110 && s.vy < -90, `vy=${s.vy}`);
  assert.equal(s.y, 500);
});

test('磁吸：46px 内进入磁吸态并最终判定拾取', () => {
  const s = { ipa: 'l', x: 30, y: 0, vx: 0, vy: 0, state: 'idle', t: 0 };
  const player = { x: 0, y: 0 };
  let picked = false;
  for (let i = 0; i < 60 && !picked; i++) picked = magnetStep(s, player, 0.016);
  assert.ok(picked);
});
