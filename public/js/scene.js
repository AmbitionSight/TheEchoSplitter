// —— 布局（规格 §6.1）——
export const LAYOUT = {
  W: 1280, H: 720, WALL_BOTTOM: 300,
  playerStart: { x: 560, y: 600 },
  obstacles: [
    { id: 'well', x: 210, y: 470, r: 46 },
    { id: 'brazier', x: 480, y: 480, r: 40 },
    { id: 'bench', x: 640, y: 616, r: 36 },
    { id: 'hatstand', x: 980, y: 520, r: 34 },
    { id: 'npc', x: 400, y: 430, r: 38 },
    { id: 'sprout', x: 330, y: 570, r: 28 },
    { id: 'cat', x: 560, y: 560, r: 24 }
  ],
  targets: {
    npc: { x: 400, y: 430, r: 60 }, well: { x: 210, y: 470, r: 56 },
    brazier: { x: 480, y: 480, r: 52 }, sprout: { x: 330, y: 570, r: 46 },
    cat: { x: 560, y: 560, r: 50 }, hatstand: { x: 980, y: 520, r: 52 },
    switch: { x: 660, y: 282, r: 120 }, bench: { x: 640, y: 616, r: 85 },
    door: { x: 1145, y: 430, r: 95 }
  },
  INTERACT_R: 170, MAGNET_R: 46
};

// —— 确定性随机（裂缝/星星布局用，测试可复现）——
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

// —— 碰撞：房间边界 + 圆形障碍（规格 §11.5）——
export function resolveCollisions(p, pr = 16) {
  p.x = clamp(p.x, 40, LAYOUT.W - 40);
  p.y = clamp(p.y, 340, LAYOUT.H - 20);
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

// ================= 渲染层（DOM 只在函数内） =================
import { PAL, drawRune } from './art.js';

const LIGHT_CENTER = { x: 950, y: 110 };   // 右半吸顶灯

function thick(ctx, w = 5, color = PAL.ink) {
  ctx.lineWidth = w; ctx.strokeStyle = color; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
}

// 十六进制色明度微调（每砖扰动用）
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const cl = v => Math.max(0, Math.min(255, Math.round(v)));
  const r0 = cl(((n >> 16) & 255) * (1 + f)), g0 = cl(((n >> 8) & 255) * (1 + f)), b0 = cl((n & 255) * (1 + f));
  return `rgb(${r0},${g0},${b0})`;
}

// 合成台石槽中心（v2：厚木板工桌 + 四个内凹石槽；拿石时由动态层点亮）
export const BENCH_SOCKETS = [[602, 597], [631, 597], [660, 597], [689, 597]];

export function prerenderStatic() {
  const c = document.createElement('canvas');
  c.width = LAYOUT.W; c.height = LAYOUT.H;
  const x = c.getContext('2d');
  // —— 地板：64px 石砖 + 每砖明度扰动 + 倒角缝 + 裂缝 ——
  const r = rng(42);
  for (let gy = 0; gy * 64 < LAYOUT.H; gy++) {
    for (let gx = 0; gx * 64 < LAYOUT.W; gx++) {
      const px = gx * 64, py = Math.max(300, gy * 64);
      const base = (gx + gy) % 2 ? PAL.floorA : PAL.floorB;
      x.fillStyle = shade(base, (r() - 0.5) * 0.14);
      x.fillRect(px, py, 64, 64);
      x.fillStyle = 'rgba(255,236,200,.055)';                    // 上/左亮棱
      x.fillRect(px, py, 64, 2); x.fillRect(px, py, 2, 64);
      x.fillStyle = 'rgba(0,0,0,.16)';                            // 下/右暗棱
      x.fillRect(px, py + 62, 64, 2); x.fillRect(px + 62, py, 2, 64);
    }
  }
  x.strokeStyle = PAL.crack; x.lineWidth = 1.4;
  for (let i = 0; i < 44; i++) {                                 // 裂缝（带分叉）
    const px = r() * LAYOUT.W, py = 308 + r() * (LAYOUT.H - 330), a = r() * 6.28, len = 16 + r() * 30;
    x.beginPath(); x.moveTo(px, py);
    const mx = px + Math.cos(a) * len * 0.6, my = py + Math.sin(a) * len * 0.24;
    x.lineTo(mx, my); x.lineTo(mx + Math.cos(a + 0.5) * len * 0.4, my + Math.sin(a + 0.5) * len * 0.16);
    x.stroke();
  }
  // —— 墙：300px 砖墙（每砖扰动 + 顶部渐暗 + 踢脚线）——
  for (let ry = 0; ry < 300; ry += 50) {
    for (let bx = ((ry / 50) % 2) * 55 - 55; bx < LAYOUT.W; bx += 110) {
      x.fillStyle = shade(PAL.wallA, (r() - 0.5) * 0.10);
      x.fillRect(bx + 1, ry + 1, 108, 48);
    }
  }
  x.strokeStyle = PAL.wallB; x.lineWidth = 2;
  for (let ry = 50; ry < 300; ry += 50) {
    x.beginPath(); x.moveTo(0, ry); x.lineTo(LAYOUT.W, ry); x.stroke();
    for (let bx = ((ry / 50) % 2) * 55; bx < LAYOUT.W; bx += 110) {
      x.beginPath(); x.moveTo(bx, ry); x.lineTo(bx, ry + 50); x.stroke();
    }
  }
  const wsh = x.createLinearGradient(0, 0, 0, 300);                  // 顶暗底亮的纵向渐变
  wsh.addColorStop(0, 'rgba(10,12,20,.42)'); wsh.addColorStop(0.6, 'rgba(10,12,20,0)');
  x.fillStyle = wsh; x.fillRect(0, 0, LAYOUT.W, 300);
  x.fillStyle = PAL.wallDark; x.fillRect(0, 272, LAYOUT.W, 28);      // 墙脚阴影
  x.fillStyle = 'rgba(255,236,200,.08)'; x.fillRect(0, 272, LAYOUT.W, 3);
  x.fillStyle = 'rgba(0,0,0,.25)'; x.fillRect(0, 297, LAYOUT.W, 3);
  // —— 月窗（拱形 + 夜空 + 月亮星星）——
  x.save();
  x.beginPath();
  x.moveTo(270, 210); x.arc(330, 165, 60, Math.PI, 0); x.lineTo(390, 210); x.closePath();
  x.fillStyle = PAL.night; x.fill();
  thick(x, 8, PAL.stoneD); x.stroke();
  x.beginPath(); x.arc(352, 150, 22, 0, 7); x.fillStyle = PAL.moon; x.fill();
  x.fillStyle = 'rgba(0,0,0,.12)';
  x.beginPath(); x.arc(345, 145, 5, 0, 7); x.fill();
  x.beginPath(); x.arc(358, 156, 3.5, 0, 7); x.fill();
  const rs = rng(7);
  x.fillStyle = 'rgba(244,240,216,.9)';
  for (let i = 0; i < 7; i++) { x.fillRect(284 + rs() * 88, 128 + rs() * 66, 2.5, 2.5); }
  x.restore();
  // 月窗光池（洒在地板上）
  const pool = x.createRadialGradient(330, 352, 10, 330, 352, 120);
  pool.addColorStop(0, 'rgba(214,224,255,.10)'); pool.addColorStop(1, 'rgba(214,224,255,0)');
  x.fillStyle = pool;
  x.beginPath(); x.ellipse(330, 352, 120, 46, 0, 0, 7); x.fill();
  // —— 挂毯（暗红 + 金边 + 大符文 ᛟ）——
  thick(x, 4, PAL.ink);
  x.fillStyle = '#6d2f28';
  x.beginPath();
  x.moveTo(116, 62); x.lineTo(196, 62); x.lineTo(196, 236); x.lineTo(176, 218); x.lineTo(156, 240); x.lineTo(136, 218); x.lineTo(116, 236); x.closePath();
  x.fill(); x.stroke();
  x.strokeStyle = PAL.rugGold; x.lineWidth = 2.5;
  x.strokeRect(126, 74, 60, 140);
  drawRune(x, 'ᛟ', 156, 140, 34, 'rgba(217,164,65,.75)', 4);
  x.strokeStyle = PAL.wood2; x.lineWidth = 5;
  x.beginPath(); x.moveTo(108, 58); x.lineTo(204, 58); x.stroke();
  // —— 火把托架（左墙两支背后的金属件）——
  x.fillStyle = '#4b4f5a';
  for (const [tx, ty] of [[140, 224], [300, 224]]) {
    x.beginPath(); x.moveTo(tx - 10, ty); x.lineTo(tx + 10, ty); x.lineTo(tx + 5, ty + 10); x.lineTo(tx - 5, ty + 10); x.closePath(); x.fill();
  }
  // —— 墙上符文刻痕 ——
  const glyphs = Object.values({ a: 'ᚱ', b: 'ᚹ', c: 'ᚦ', d: 'ᛟ', e: 'ᚷ', f: 'ᛞ', g: 'ᛚ', h: 'ᛝ' });
  glyphs.forEach((g, i) => drawRune(x, g, 520 + i * 52, 80, 26, 'rgba(44,80,74,.6)', 3));
  // —— 中央红地毯（金边双环）——
  x.beginPath(); x.ellipse(640, 545, 175, 82, 0, 0, 7); x.fillStyle = PAL.rug; x.fill();
  thick(x, 5, PAL.rugGold); x.stroke();
  x.beginPath(); x.ellipse(640, 545, 158, 70, 0, 0, 7); x.strokeStyle = PAL.rugGold; x.lineWidth = 3; x.stroke();
  x.beginPath(); x.ellipse(640, 545, 146, 62, 0, 0, 7); x.fillStyle = PAL.rugDark; x.fill();
  // —— 井（石圈+木架+绳桶+水光）——
  x.beginPath(); x.ellipse(210, 480, 52, 30, 0, 0, 7); x.fillStyle = PAL.stone; x.fill(); thick(x, 5); x.stroke();
  x.beginPath(); x.ellipse(210, 480, 36, 20, 0, 0, 7); x.fillStyle = PAL.night; x.fill();
  x.beginPath(); x.ellipse(210, 481, 24, 12, 0, 0, 7); x.fillStyle = PAL.waterD; x.fill();
  thick(x, 6, PAL.wood2);
  x.beginPath(); x.moveTo(170, 470); x.lineTo(178, 380); x.lineTo(242, 380); x.lineTo(250, 470); x.stroke();
  x.beginPath(); x.moveTo(172, 396); x.lineTo(248, 396); x.stroke();
  x.strokeStyle = '#c9b18a'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(210, 382); x.lineTo(210, 428); x.stroke();
  x.strokeRect(200, 428, 20, 16);
  // —— 火盆（三足铁盆，火苗动态画）——
  x.beginPath(); x.ellipse(480, 486, 44, 26, 0, 0, 7); x.fillStyle = PAL.stoneD; x.fill(); thick(x, 5); x.stroke();
  x.beginPath(); x.ellipse(480, 478, 30, 16, 0, 0, 7); x.fillStyle = '#3a3028'; x.fill();
  thick(x, 5, PAL.wood2);
  for (const dx of [-30, 0, 30]) {
    x.beginPath(); x.moveTo(480 + dx, 500); x.lineTo(480 + dx * 1.3, 522); x.stroke();
  }
  // —— 合成台 v2（MC 风工桌：厚板面 + 裙边 + 粗腿 + 内嵌石槽板）——
  x.fillStyle = 'rgba(0,0,0,.25)';
  x.beginPath(); x.ellipse(640, 662, 96, 18, 0, 0, 7); x.fill();              // 落地影
  for (const lx of [578, 702]) {                                              // 粗腿（梯形）
    x.fillStyle = shade(PAL.wood2, lx < 640 ? -0.06 : 0.06);
    x.beginPath();
    x.moveTo(lx - 11, 606); x.lineTo(lx + 11, 606); x.lineTo(lx + 8, 660); x.lineTo(lx - 8, 660); x.closePath();
    x.fill(); thick(x, 5, PAL.ink); x.stroke();
  }
  x.fillStyle = PAL.wood2;                                                    // 横撑
  x.fillRect(585, 636, 110, 9);
  thick(x, 4, PAL.ink); x.strokeRect(585, 636, 110, 9);
  x.fillStyle = PAL.wood;                                                     // 桌面大厚板
  x.beginPath();
  if (x.roundRect) x.roundRect(556, 580, 168, 30, 7); else x.rect(556, 580, 168, 30);
  x.fill(); thick(x, 6, PAL.ink); x.stroke();
  x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 2;
  for (const sy of [590, 600]) { x.beginPath(); x.moveTo(562, sy); x.lineTo(718, sy); x.stroke(); }
  x.fillStyle = 'rgba(255,236,200,.14)';
  x.fillRect(560, 583, 160, 3);                                               // 顶面亮线
  x.fillStyle = shade(PAL.wood2, -0.12);                                      // 裙边
  x.fillRect(564, 610, 152, 12);
  thick(x, 4, PAL.ink); x.strokeRect(564, 610, 152, 12);
  drawRune(x, 'ᚹ', 640, 616, 14, 'rgba(217,164,65,.5)', 2);
  x.fillStyle = shade(PAL.stoneD, -0.25);                                     // 内嵌石槽板
  x.beginPath();
  if (x.roundRect) x.roundRect(574, 584, 132, 22, 8); else x.rect(574, 584, 132, 22);
  x.fill(); thick(x, 3.5, PAL.ink); x.stroke();
  for (const [sx, sy] of BENCH_SOCKETS) {                                     // 四个内凹圆槽
    x.fillStyle = 'rgba(0,0,0,.4)';
    x.beginPath(); x.arc(sx, sy, 8, 0, 7); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.10)'; x.lineWidth = 1.5;
    x.beginPath(); x.arc(sx, sy, 8, -2.2, 0.6); x.stroke();
  }
  // —— 右半吸顶灯（底盘 + 灯罩；光由动态层画）——
  x.fillStyle = PAL.stoneD;
  x.fillRect(930, 28, 40, 8);
  x.fillStyle = '#c9c2b2';
  x.beginPath(); x.moveTo(924, 36); x.lineTo(976, 36); x.lineTo(962, 56); x.lineTo(938, 56); x.closePath();
  x.fill(); thick(x, 4); x.stroke();
  // —— 枯苗陶盆（花动态画）——
  x.fillStyle = '#b06a3f';
  x.beginPath();
  x.moveTo(312, 566); x.lineTo(348, 566); x.lineTo(342, 590); x.lineTo(318, 590); x.closePath();
  x.fill(); thick(x, 4); x.stroke();
  // —— 右墙拱门石框（木门动态画：开门动画）——
  x.fillStyle = PAL.stone;
  x.beginPath();
  x.moveTo(1090, 500); x.lineTo(1090, 430); x.arc(1145, 430, 55, Math.PI, 0); x.lineTo(1200, 500); x.closePath();
  x.fill(); thick(x, 6, PAL.stoneD); x.stroke();
  return c;
}

export function makeDarkness() {
  const c = document.createElement('canvas');
  c.width = LAYOUT.W; c.height = LAYOUT.H;
  const x = c.getContext('2d');
  // 右半近乎全黑：自边界向右快速压到 0.97（未开灯时灯位无光，不做亮晕）
  const g = x.createLinearGradient(545, 0, 680, 0);
  g.addColorStop(0, 'rgba(6,7,11,0)');
  g.addColorStop(1, 'rgba(6,7,11,.97)');
  x.fillStyle = g;
  x.fillRect(545, 0, 135, LAYOUT.H);
  x.fillStyle = 'rgba(6,7,11,.97)';
  x.fillRect(680, 0, LAYOUT.W - 680, LAYOUT.H);
  const fade = x.createLinearGradient(430, 0, 560, 0);               // 左半不受暗角
  fade.addColorStop(0, 'rgba(6,7,11,1)'); fade.addColorStop(1, 'rgba(6,7,11,0)');
  x.globalCompositeOperation = 'destination-out';
  x.fillStyle = fade;
  x.fillRect(0, 0, 560, LAYOUT.H);
  x.globalCompositeOperation = 'source-over';
  return c;
}

// —— 场景对象（游戏持有）——
export function createScene() {
  const dust = [];
  const r = rng(99);
  for (let i = 0; i < 34; i++) dust.push({ x: r() * LAYOUT.W, y: 200 + r() * 480, v: 6 + r() * 14, ph: r() * 6.28 });
  return { static: null, darkness: null, dust, lit: 0, doorOpen: 0 };
}

export function initScene(sc) {           // boot 时调用（需要 document）
  sc.static = prerenderStatic();
  sc.darkness = makeDarkness();
}

export function updateScene(sc, dt, litTarget) {
  sc.lit += clamp(litTarget - sc.lit, -dt / 1.2, dt / 1.2);          // 1.2s 光潮（规格 §6.2）
  for (const d of sc.dust) {
    d.y -= d.v * dt; d.x += Math.sin(d.ph + d.y / 40) * 0.2;
    if (d.y < 180) { d.y = 690; d.x = Math.random() * LAYOUT.W; }
  }
}

function flame(x, cx, cy, size, t, seed) {
  const f = Math.sin(t * 13 + seed) * 0.12 + 1;
  x.beginPath();
  x.moveTo(cx, cy - size * f);
  x.bezierCurveTo(cx + size * 0.55, cy - size * 0.25, cx + size * 0.42, cy + size * 0.3, cx, cy + size * 0.34);
  x.bezierCurveTo(cx - size * 0.42, cy + size * 0.3, cx - size * 0.55, cy - size * 0.25, cx, cy - size * f);
  x.closePath();
  x.fillStyle = PAL.fire2; x.fill();
  x.beginPath();
  x.moveTo(cx, cy - size * 0.3 * f);
  x.bezierCurveTo(cx + size * 0.24, cy, cx + size * 0.2, cy + size * 0.26, cx, cy + size * 0.3);
  x.bezierCurveTo(cx - size * 0.2, cy + size * 0.26, cx - size * 0.24, cy, cx, cy - size * 0.3 * f);
  x.closePath();
  x.fillStyle = PAL.fireCore; x.fill();
}

function glow(x, cx, cy, r, color, alpha) {
  const g = x.createRadialGradient(cx, cy, 2, cx, cy, r);
  g.addColorStop(0, color.replace('ALPHA', String(alpha)));
  g.addColorStop(1, color.replace('ALPHA', '0'));
  x.fillStyle = g;
  x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
}

function drawTorch(x, tx, ty, lit, t, seed) {
  thick(x, 5, PAL.wood2);
  x.beginPath(); x.moveTo(tx, ty + 34); x.lineTo(tx, ty + 6); x.stroke();     // 柄
  x.fillStyle = lit ? PAL.fire1 : PAL.stoneD;
  x.beginPath(); x.ellipse(tx, ty, 9, 12, 0, 0, 7); x.fill(); thick(x, 4); x.stroke();
  if (lit) { flame(x, tx, ty - 4, 22, t, seed); glow(x, tx, ty - 6, 90, 'rgba(255,179,71,ALPHA)', 0.28); }
}

// view：{ t, lit, doorState, doorPulse(0..1), doorOpen(0..1), torchesLit, bloomed, hatOn }
export function drawScene(x, sc, view) {
  const { t } = view;
  x.drawImage(sc.static, 0, 0);
  const dim = 0.05 + view.lit * 0.95;                                       // 剪影 5% → 全亮
  // —— 暗区物件（帽架/右墙火把/木门）：按 lit 淡入 ——
  x.save();
  x.globalAlpha = dim;
  // 帽架
  thick(x, 6, PAL.wood2);
  x.beginPath(); x.moveTo(980, 570); x.lineTo(980, 470); x.stroke();
  x.beginPath(); x.moveTo(980, 478); x.lineTo(950, 466); x.stroke();
  if (!view.hatOn) {                                                        // 草帽还在架上
    x.fillStyle = PAL.hat;
    x.beginPath(); x.ellipse(980, 462, 34, 10, 0, 0, 7); x.fill(); thick(x, 4); x.stroke();
    x.beginPath(); x.moveTo(958, 462); x.quadraticCurveTo(980, 424, 1002, 462); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = PAL.hatD; x.fillRect(960, 458, 40, 6);
  }
  drawTorch(x, 900, 190, false, t, 3);                                           // 右墙火把：纯装饰（v2 不点燃）
  drawTorch(x, 1060, 190, false, t, 4);
  // 木门（绕左轴收窄，规格 §6.3）
  x.save();
  x.translate(1096, 0);
  x.scale(Math.max(0.06, 1 - view.doorOpen * 0.94), 1);
  x.translate(-1096, 0);
  x.fillStyle = PAL.wood;
  x.fillRect(1096, 442, 96, 58);
  x.strokeStyle = PAL.wood2; x.lineWidth = 3;
  for (const bx of [1096, 1120, 1144, 1168]) { x.beginPath(); x.moveTo(bx, 442); x.lineTo(bx, 500); x.stroke(); }
  x.fillStyle = PAL.wood3;
  x.beginPath(); x.moveTo(1096, 442); x.arc(1144, 442, 48, Math.PI, 0); x.lineTo(1192, 442); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#565b63';
  x.fillRect(1096, 452, 96, 8); x.fillRect(1096, 480, 96, 8);               // 铁箍
  drawRune(x, 'ᛟ', 1144, 462, 40, view.doorState === 'closed' ? 'rgba(30,32,44,.8)' : PAL.glowRune, view.doorState === 'closed' ? 5 : 6);
  x.restore();
  x.restore();
  // —— 门后金光（开门时）——
  if (view.doorOpen > 0.05) {
    x.save();
    x.globalAlpha = view.doorOpen;
    const g = x.createLinearGradient(1090, 300, 1090, 520);
    g.addColorStop(0, 'rgba(255,211,107,0)'); g.addColorStop(0.5, 'rgba(255,225,150,.85)'); g.addColorStop(1, 'rgba(255,211,107,0)');
    x.fillStyle = g;
    x.fillRect(1096, 405, 96, 100);
    for (let i = 0; i < 12; i++) {
      const py = 500 - ((t * 40 + i * 37) % 110);
      x.globalAlpha = view.doorOpen * 0.8;
      x.fillStyle = PAL.gold;
      x.fillRect(1102 + (i * 37) % 84, py, 3, 3);
    }
    x.restore();
  }
  // —— 门符文脉动（仪式中）——
  if (view.doorState === 'ritual') {
    glow(x, 1144, 462, 60 + view.doorPulse * 26, 'rgba(84,224,200,ALPHA)', 0.22 + view.doorPulse * 0.2);
  }
  // —— 墙上开关面板（明暗分界；未按时青光脉动 beckoning）——
  {
    const on = view.switchOn;
    thick(x, 3, PAL.stoneD);
    x.fillStyle = '#d8d3c6';
    x.fillRect(650, 268, 22, 32); x.strokeRect(650, 268, 22, 32);
    x.fillStyle = on ? '#7bd88f' : '#8a8375';
    x.fillRect(655, on ? 284 : 274, 12, 10);
    if (!on) glow(x, 661, 284, 40 + view.doorPulse * 14, 'rgba(123,216,143,ALPHA)', 0.3 + view.doorPulse * 0.25);
  }
  // —— 合成台石槽：手持音素石时亮起招手 ——
  if (view.benchHot) {
    for (const [sx, sy] of BENCH_SOCKETS) glow(x, sx, sy, 18, 'rgba(84,224,200,ALPHA)', 0.35);
  }
  // —— 火光们 ——
  flame(x, 480, 470, 30, t, 1); glow(x, 480, 472, 130, 'rgba(255,140,60,ALPHA)', 0.3);   // 火盆
  drawTorch(x, 140, 190, true, t, 5); drawTorch(x, 300, 190, true, t, 6);                // 左墙火把恒亮
  if (view.lit > 0.02) {                                                                  // 吸顶灯亮起
    x.save(); x.globalAlpha = view.lit;
    glow(x, 950, 58, 340, 'rgba(255,224,150,ALPHA)', 0.4);
    glow(x, 950, 54, 62, 'rgba(255,240,200,ALPHA)', 0.75);
    x.restore();
  }
  // —— 枯苗/花 ——
  if (view.bloomed) {
    for (const [fx, fy, s] of [[320, 556, 1], [336, 548, 0.8], [350, 558, 0.9]]) {
      x.strokeStyle = PAL.leaf; x.lineWidth = 3;
      x.beginPath(); x.moveTo(fx, 566); x.quadraticCurveTo(fx - 4 * s, 560, fx, 550 * s + 560 * (1 - s)); x.stroke();
      x.fillStyle = PAL.petal;
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * 6.28 + Math.sin(t + fx) * 0.06;
        x.beginPath(); x.ellipse(fx + Math.cos(a) * 6 * s, (550 * s + 560 * (1 - s)) + Math.sin(a) * 6 * s, 5 * s, 5 * s, 0, 0, 7); x.fill();
      }
      x.fillStyle = PAL.gold;
      x.beginPath(); x.arc(fx, 550 * s + 560 * (1 - s), 4 * s, 0, 7); x.fill();
    }
  } else {
    x.strokeStyle = PAL.leafD; x.lineWidth = 3;
    x.beginPath(); x.moveTo(324, 566); x.quadraticCurveTo(318, 548, 306, 544); x.stroke();
    x.beginPath(); x.moveTo(336, 566); x.quadraticCurveTo(342, 552, 352, 548); x.stroke();
  }
}

// —— 覆盖层：黑暗遮罩/浮尘/暗角（必须画在角色与掉落物之后，暗区才会正确变暗）——
export function drawOverlay(x, sc, view) {
  const { t } = view;
  const dark = (1 - sc.lit) * 0.92;                                    // 两档透明度缓动（规格 §6.2）
  if (dark > 0.01) {
    x.save();
    x.globalAlpha = dark;
    x.drawImage(sc.darkness, 0, 0);
    x.restore();
  }
  x.fillStyle = 'rgba(255,233,168,.5)';
  for (const d of sc.dust) {
    const localLight = d.x < 480 ? 1 : sc.lit;
    x.globalAlpha = 0.18 + Math.abs(Math.sin(d.ph + t)) * 0.3 * localLight;
    x.fillRect(d.x, d.y, 2.4, 2.4);
  }
  x.globalAlpha = 1;
  const v = x.createRadialGradient(640, 360, 380, 640, 360, 780);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.42)');
  x.fillStyle = v;
  x.fillRect(0, 0, LAYOUT.W, LAYOUT.H);
}
