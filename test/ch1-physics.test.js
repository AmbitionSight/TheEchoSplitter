// —— 直接单测 ch1 分层模块：physics（绕过 scene.js 兼容入口，锁死层边界）——
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveCollisions, moveToward, makeStone, stepStone, magnetStep } from '../public/js/ch1/physics.js';
import { LAYOUT, WALL_SEAM } from '../public/js/ch1/planners.js';

test('resolveCollisions：把点夹进房间边界 [40,W-40] × [walk,H-20]', () => {
  const low = { x: -500, y: 700 };
  resolveCollisions(low);
  assert.equal(low.x, 40);
  assert.equal(low.y, 700);

  const high = { x: 5000, y: 5000 };
  resolveCollisions(high);
  assert.equal(high.x, LAYOUT.W - 40);
  assert.equal(high.y, LAYOUT.H - 20);

  const top = { x: 5000, y: -500 };
  resolveCollisions(top);
  assert.equal(top.x, LAYOUT.W - 40);
  assert.equal(top.y, WALL_SEAM.walk);
});

test('resolveCollisions：把点推出障碍圆到恰好 r+pr，并返回同一对象', () => {
  const p = { x: 200, y: 450 };                     // 井心右 30px，井 r=46
  const ret = resolveCollisions(p);                 // 默认 pr=16 → min=62
  assert.strictEqual(ret, p);
  const well = LAYOUT.obstacles.find(o => o.id === 'well');
  assert.ok(Math.abs(Math.hypot(p.x - well.x, p.y - well.y) - (well.r + 16)) < 1e-9);

  const q = { x: 170, y: 450 };                     // 井心（退化），默认 pr
  resolveCollisions(q);
  assert.equal(q.x, well.x + well.r + 16);
  assert.equal(q.y, well.y);

  const r = { x: 520, y: 395 };                     // 火盆圆心（退化），自定义 pr=10
  const bz = LAYOUT.obstacles.find(o => o.id === 'brazier');
  resolveCollisions(r, 10);
  assert.equal(r.x, bz.x + bz.r + 10);
  assert.equal(r.y, bz.y);
});

test('moveToward：恰好/超过剩余距离时钳制到目标并返回 true', () => {
  const p = { x: 0, y: 0 };
  assert.equal(moveToward(p, { x: 10, y: 0 }, 100, 0.1), true);   // d == speed*dt
  assert.equal(p.x, 10);
  assert.equal(p.y, 0);

  const q = { x: 0, y: 0 };
  assert.equal(moveToward(q, { x: 3, y: 4 }, 100, 0.1), true);    // d=5 < 10
  assert.equal(q.x, 3);
  assert.equal(q.y, 4);
});

test('moveToward：未到达时沿单位方向精确推进 speed*dt 并返回 false', () => {
  const p = { x: 0, y: 0 };
  assert.equal(moveToward(p, { x: 30, y: 40 }, 100, 0.1), false); // d=50 > 10
  assert.ok(Math.abs(p.x - 6) < 1e-9);
  assert.ok(Math.abs(p.y - 8) < 1e-9);
  assert.ok(Math.abs(Math.hypot(p.x, p.y) - 10) < 1e-9, '位移恰为 speed*dt');
});

test('makeStone：注入 rand 后完全确定（不依赖 Math.random）', () => {
  const stub = () => 0.5;
  const a = makeStone('l', 10, 20, 0.5, stub);
  const b = makeStone('l', 10, 20, 0.5, stub);
  assert.deepEqual(a, b);
  assert.equal(a.vx, 0);            // (0.5*2-1)*60
  assert.equal(a.vy, -290);         // -260 - 0.5*60
  assert.equal(a.phase, 3.14);      // 0.5*6.28
  assert.equal(a.state, 'wait');
  assert.equal(a.t, -0.5);
  assert.equal(a.magnet, false);

  const low = makeStone('l', 0, 0, 0, () => 0);
  assert.equal(low.vx, -60);
  assert.equal(low.vy, -260);
  assert.equal(low.phase, 0);
});

test('stepStone：wait 态累加 t，t>=0 翻到 fly', () => {
  const s = makeStone('l', 0, 0, 0.5, () => 0.5);
  stepStone(s, 0.4, 500);
  assert.equal(s.state, 'wait');
  assert.ok(Math.abs(s.t - (-0.1)) < 1e-9);
  stepStone(s, 0.2, 500);
  assert.equal(s.state, 'fly');
});

test('stepStone：fly 态重力 1400 与落地下弹衰减 ×0.45', () => {
  const s = { ipa: 'l', x: 100, y: 500, vx: 0, vy: 200, state: 'fly', t: 0, settleT: 0 };
  stepStone(s, 0.016, 500);
  assert.equal(s.y, 500, '落回地面');
  assert.equal(s.state, 'fly', '弹速仍 >70 不 settle');
  // 锁死重力常数 1400：容差必须 < 0.0072，否则 1400→1401 的单行改动仍会通过
  assert.ok(Math.abs(s.vy - -(200 + 1400 * 0.016) * 0.45) < 1e-9, `vy=${s.vy}`);
});

test('stepStone：|vy|<70 进入 settle，0.5s 后转 idle', () => {
  const s = { ipa: 'l', x: 100, y: 500, vx: 0, vy: 100, state: 'fly', t: 0, settleT: 0 };
  stepStone(s, 0.016, 500);
  assert.equal(s.state, 'settle');
  assert.equal(s.restY, 500);
  assert.equal(s.y, 500);
  stepStone(s, 0.3, 500);
  assert.equal(s.state, 'settle', '0.3s 未满 0.5s');
  stepStone(s, 0.25, 500);
  assert.equal(s.state, 'idle');
});

test('stepStone：fly 态 x 钳制到 [30, W-30]', () => {
  const right = { ipa: 'l', x: 2000, y: 100, vx: 500, vy: 0, state: 'fly', t: 0 };
  stepStone(right, 0.016, 500);
  assert.equal(right.x, LAYOUT.W - 30);
  assert.equal(right.state, 'fly');

  const left = { ipa: 'l', x: -100, y: 100, vx: -500, vy: 0, state: 'fly', t: 0 };
  stepStone(left, 0.016, 500);
  assert.equal(left.x, 30);
});

test('magnetStep：非 settle/idle 直接返回 false 且不吸附', () => {
  for (const state of ['fly', 'wait']) {
    const s = { ipa: 'l', x: 0, y: 0, state, magnet: false };
    assert.equal(magnetStep(s, { x: 0, y: 0 }, 0.016), false, state);
    assert.equal(s.magnet, false);
  }
});

test('magnetStep：46px 外不吸附、不移动', () => {
  const s = { ipa: 'l', x: 100, y: 0, state: 'idle', magnet: false };
  assert.equal(magnetStep(s, { x: 0, y: 0 }, 0.016), false);
  assert.equal(s.x, 100);
  assert.equal(s.magnet, false);
});

test('magnetStep：进入 46px 半径即置磁吸并以 min(900*dt,d) 逼近', () => {
  const s = { ipa: 'l', x: LAYOUT.MAGNET_R, y: 0, state: 'idle', magnet: false };
  const ret = magnetStep(s, { x: 0, y: 0 }, 0.016);   // d=MAGNET_R，恰好进入半径
  assert.equal(s.magnet, true);
  assert.ok(Math.abs(s.x - (LAYOUT.MAGNET_R - 900 * 0.016)) < 1e-9, `x=${s.x}`);
  assert.equal(ret, false, '距离 46 未达拾取阈值');
});

test('magnetStep：大 dt 不越过玩家（步长被 d 钳制）', () => {
  const s = { ipa: 'l', x: 30, y: 0, state: 'idle', magnet: true };
  assert.equal(magnetStep(s, { x: 0, y: 0 }, 0.1), false);  // 900*0.1=90 > d=30
  assert.equal(s.x, 0, '至多走完剩余距离，不越到负侧');
});

test('magnetStep：距离 <14px 判定拾取返回 true；多步逼近最终拾取', () => {
  const near = { ipa: 'l', x: 13, y: 0, state: 'idle', magnet: true };
  assert.equal(magnetStep(near, { x: 0, y: 0 }, 0.016), true);

  const s = { ipa: 'l', x: 45, y: 0, state: 'idle', magnet: false };
  let picked = false;
  for (let i = 0; i < 60 && !picked; i++) {
    picked = magnetStep(s, { x: 0, y: 0 }, 0.016);
    assert.ok(s.x >= 0, '永不越过玩家');
  }
  assert.equal(picked, true);
});
