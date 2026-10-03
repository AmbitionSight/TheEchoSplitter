import { LAYOUT, clamp, WALL_SEAM } from './planners.js';

// —— 碰撞：房间边界 + 圆形障碍（规格 §11.5）——
export function resolveCollisions(p, pr = 16) {
  p.x = clamp(p.x, 40, LAYOUT.W - 40);
  p.y = clamp(p.y, WALL_SEAM.walk, LAYOUT.H - 20);
  for (const o of LAYOUT.obstacles) {
    const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy), min = o.r + pr;
    if (d < min) {
      if (d > 0.001) { p.x = o.x + (dx / d) * min; p.y = o.y + (dy / d) * min; }
      else { p.x = o.x + min; p.y = o.y; }  // 与圆心重合的退化情况：沿 +x 方向推出
    }
  }
  return p;
}

// —— 屏幕→逻辑坐标（DPR/等比缩放，规格 §12）——
export function screenToLogical(px, py, rect) {
  const scale = Math.min(rect.width / LAYOUT.W, rect.height / LAYOUT.H);
  const ox = rect.left + (rect.width - LAYOUT.W * scale) / 2;
  const oy = rect.top + (rect.height - LAYOUT.H * scale) / 2;
  const x = (px - ox) / scale, y = (py - oy) / scale;
  return { x, y, inside: x >= 0 && x <= LAYOUT.W && y >= 0 && y <= LAYOUT.H };
}

// —— 行走 ——
export function moveToward(p, target, speed, dt) {
  const dx = target.x - p.x, dy = target.y - p.y, d = Math.hypot(dx, dy);
  if (d <= speed * dt) { p.x = target.x; p.y = target.y; return true; }
  p.x += (dx / d) * speed * dt;
  p.y += (dy / d) * speed * dt;
  return false;
}

// —— 音素石物理：上抛→重力→弹跳(×0.45)→静止浮动（规格 §11.5）——
export function makeStone(ipa, x, y, delay = 0, rand = Math.random) {
  return {
    ipa, x, y,
    vx: (rand() * 2 - 1) * 60,
    vy: -260 - rand() * 60,
    state: 'wait', t: -delay, settleT: 0, restY: 0, magnet: false, phase: rand() * 6.28
  };
}

export function stepStone(s, dt, floorY) {
  if (s.state === 'wait') { s.t += dt; if (s.t >= 0) s.state = 'fly'; else return s; }
  if (s.state === 'fly') {
    s.vy += 1400 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.y >= floorY && s.vy > 0) {
      s.y = floorY;
      s.vy = -s.vy * 0.45;
      if (Math.abs(s.vy) < 70) { s.state = 'settle'; s.settleT = 0; s.restY = floorY; }
    }
    s.x = clamp(s.x, 30, LAYOUT.W - 30);
  } else if (s.state === 'settle') {
    s.settleT += dt;
    if (s.settleT > 0.5) s.state = 'idle';
  }
  return s;
}

// —— 磁吸：46px 内加速飞向玩家，<14px 判定拾取 ——
export function magnetStep(s, player, dt) {
  if (s.state !== 'settle' && s.state !== 'idle') return false;
  const dx = player.x - s.x, dy = player.y - s.y, d = Math.hypot(dx, dy);
  if (!s.magnet && d > LAYOUT.MAGNET_R) return false;
  s.magnet = true;
  const sp = 900 * dt;
  const step = Math.min(sp, d);              // 不越过玩家：至多走完剩余距离，杜绝大 dt 下的两侧振荡死循环
  s.x += (dx / (d || 1)) * step;
  s.y += (dy / (d || 1)) * step;
  return d < 14;
}
