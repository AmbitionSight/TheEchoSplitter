// —— 布局（规格 §6.1）——
export const LAYOUT = {
  W: 1280, H: 720, WALL_BOTTOM: 300,
  playerStart: { x: 560, y: 600 },
  obstacles: [
    { id: 'well', x: 210, y: 470, r: 46 },
    { id: 'brazier', x: 480, y: 480, r: 40 },
    { id: 'bench', x: 640, y: 560, r: 34 },
    { id: 'hatstand', x: 980, y: 520, r: 34 },
    { id: 'npc', x: 400, y: 430, r: 38 },
    { id: 'sprout', x: 330, y: 570, r: 28 },
    { id: 'cat', x: 505, y: 632, r: 24 }
  ],
  targets: {
    npc: { x: 400, y: 430, r: 60 }, well: { x: 210, y: 470, r: 56 },
    brazier: { x: 480, y: 480, r: 52 }, sprout: { x: 330, y: 570, r: 46 },
    cat: { x: 505, y: 632, r: 50 }, hatstand: { x: 980, y: 520, r: 52 },
    switch: { x: 660, y: 282, r: 120 }, bench: { x: 640, y: 556, r: 85 },
    door: { x: 1112, y: 245, r: 105 }
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
import { blit, tile } from './sprites.js';
import { drawMossyWall } from './sideview.js';

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

// 合成台石槽中心（v2.1：上移避开底部工具栏；拿石时由动态层点亮）
export const BENCH_SOCKETS = [[592, 541], [624, 541], [656, 541], [688, 541]];

function drawWallTextures(ctx, atlases) {
  drawMossyWall(ctx, atlases, LAYOUT.W, 284, 23);                      // 第一/二关共用的青苔墙砖
}

export function prerenderStatic(atlases) {
  const c = document.createElement('canvas');
  c.width = LAYOUT.W; c.height = LAYOUT.H;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  if (!atlases) {                                       // 素材加载失败兜底：纯色房间
    x.fillStyle = PAL.wallA; x.fillRect(0, 0, LAYOUT.W, 300);
    x.fillStyle = PAL.floorB; x.fillRect(0, 300, LAYOUT.W, LAYOUT.H - 300);
  }
  // —— 地板：第一关砖石地砖（4x 素材按 0.25x 平铺，砖块约 42px 宽）——
  tile(x, atlases, 'floor_brick', 0, 300, LAYOUT.W, LAYOUT.H - 300, 0.25);
  // —— 墙：青苔墙砖随机拼接 + 踢脚线 + 顶部渐暗 + 墙脚阴影 ——
  drawWallTextures(x, atlases);
  tile(x, atlases, 'wall_base', 0, 284, LAYOUT.W, 16);
  const wsh = x.createLinearGradient(0, 0, 0, 300);                  // 顶暗底亮的纵向渐变
  wsh.addColorStop(0, 'rgba(10,12,20,.42)'); wsh.addColorStop(0.6, 'rgba(10,12,20,0)');
  x.fillStyle = wsh; x.fillRect(0, 0, LAYOUT.W, 300);
  const fsh = x.createLinearGradient(0, 292, 0, 336);                // 墙脚落地阴影
  fsh.addColorStop(0, 'rgba(0,0,0,.30)'); fsh.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = fsh; x.fillRect(0, 292, LAYOUT.W, 44);
  // —— 月窗：MI 木框窗 + 玻璃区里画夜空/月亮/星星（窗 50x40，两格玻璃）——
  const WX = 305, WY = 140;
  blit(x, atlases, 'window', WX, WY);
  const rs = rng(7);
  for (const [px0, pw] of [[WX + 5, 19], [WX + 26, 19]]) {
    x.save();
    x.beginPath(); x.rect(px0, WY + 6, pw, 27); x.clip();
    x.fillStyle = PAL.night; x.fillRect(px0, WY + 6, pw, 27);
    x.fillStyle = 'rgba(244,240,216,.9)';
    for (let i = 0; i < 4; i++) x.fillRect(px0 + 1 + rs() * (pw - 3), WY + 7 + rs() * 25, 1.4, 1.4);
    x.restore();
  }
  x.save();
  x.beginPath(); x.arc(WX + 5 + 12, WY + 6 + 9, 6, 0, 7); x.clip();      // 左格月亮（裁进玻璃）
  x.fillStyle = PAL.moon; x.fillRect(WX + 5, WY + 6, 19, 27);
  x.fillStyle = 'rgba(0,0,0,.12)';
  x.beginPath(); x.arc(WX + 5 + 10, WY + 6 + 7, 1.8, 0, 7); x.fill();
  x.restore();
  // 月窗光池（洒在地板上）
  const pool = x.createRadialGradient(330, 352, 10, 330, 352, 120);
  pool.addColorStop(0, 'rgba(214,224,255,.10)'); pool.addColorStop(1, 'rgba(214,224,255,0)');
  x.fillStyle = pool;
  x.beginPath(); x.ellipse(330, 352, 120, 46, 0, 0, 7); x.fill();
  // —— 挂画（挂毯位：MI 橄榄挂画 + 金符文 ᛟ）——
  blit(x, atlases, 'painting', 130, 108);
  drawRune(x, 'ᛟ', 156, 136, 26, 'rgba(217,164,65,.8)', 3);
  // —— 火把托架（左墙两支背后的金属件）——
  x.fillStyle = '#4b4f5a';
  for (const [tx, ty] of [[140, 224], [300, 224]]) {
    x.beginPath(); x.moveTo(tx - 10, ty); x.lineTo(tx + 10, ty); x.lineTo(tx + 5, ty + 10); x.lineTo(tx - 5, ty + 10); x.closePath(); x.fill();
  }
  // —— 墙上符文刻痕 ——
  const glyphs = Object.values({ a: 'ᚱ', b: 'ᚹ', c: 'ᚦ', d: 'ᛟ', e: 'ᚷ', f: 'ᛞ', g: 'ᛚ', h: 'ᛝ' });
  glyphs.forEach((g, i) => drawRune(x, g, 520 + i * 52, 80, 26, 'rgba(44,80,74,.6)', 3));
  // —— 中央地毯：MI 红金地毯 ×2 拼成工坊毯 ——
  blit(x, atlases, 'rug', 520, 500);
  blit(x, atlases, 'rug', 640, 500);
  // —— 靠墙软装（书架/盆栽/小画；右半暗区里的开灯后才现）——
  blit(x, atlases, 'shelf', 28, 306);
  blit(x, atlases, 'plant', 104, 330);
  blit(x, atlases, 'cactus', 140, 350);
  blit(x, atlases, 'plant', 844, 330);
  blit(x, atlases, 'frame_sm', 930, 110);
  blit(x, atlases, 'frame_sm', 1030, 110);
  // —— 井（块状石圈 + 深井口 + 水光 + 木架）——
  x.fillStyle = PAL.stone;                                                     // 石圈（圆角块）
  x.beginPath();
  if (x.roundRect) x.roundRect(158, 452, 104, 52, 12); else x.rect(158, 452, 104, 52);
  x.fill(); thick(x, 5); x.stroke();
  x.fillStyle = shade(PAL.stone, -0.14);                                       // 石圈内斜面
  x.fillRect(166, 458, 88, 6);
  x.fillStyle = '#232a45';                                                     // 井口
  x.beginPath();
  if (x.roundRect) x.roundRect(172, 466, 76, 32, 8); else x.rect(172, 466, 76, 32);
  x.fill();
  x.fillStyle = PAL.waterD;                                                    // 水面
  x.fillRect(182, 472, 56, 20);
  x.fillStyle = PAL.water;                                                     // 水光横条
  x.fillRect(186, 474, 48, 4);
  x.fillStyle = 'rgba(255,255,255,.35)';
  x.fillRect(190, 482, 14, 2); x.fillRect(212, 486, 10, 2);
  thick(x, 6, PAL.wood2);
  x.beginPath(); x.moveTo(170, 470); x.lineTo(178, 380); x.lineTo(242, 380); x.lineTo(250, 470); x.stroke();
  x.beginPath(); x.moveTo(172, 396); x.lineTo(248, 396); x.stroke();
  x.strokeStyle = '#c9b18a'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(210, 382); x.lineTo(210, 428); x.stroke();
  x.strokeRect(200, 428, 20, 16);
  // —— 火盆（块状铁盆，三足，火苗动态画）——
  x.fillStyle = PAL.stoneD;                                                    // 盆身（圆角块）
  x.beginPath();
  if (x.roundRect) x.roundRect(436, 462, 88, 46, 12); else x.rect(436, 462, 88, 46);
  x.fill(); thick(x, 5); x.stroke();
  x.fillStyle = shade(PAL.stoneD, -0.18);
  x.fillRect(444, 468, 72, 5);
  x.fillStyle = '#3a3028';                                                     // 盆口炭
  x.beginPath();
  if (x.roundRect) x.roundRect(448, 474, 64, 26, 8); else x.rect(448, 474, 64, 26);
  x.fill();
  thick(x, 5, PAL.wood2);
  for (const dx of [-30, 0, 30]) {
    x.beginPath(); x.moveTo(480 + dx, 502); x.lineTo(480 + dx * 1.3, 524); x.stroke();
  }
  // —— 合成台：两张 MI 木桌拼成工作台 + 内嵌石槽 + 蜡烛座 ——
  x.fillStyle = 'rgba(0,0,0,.25)';
  x.beginPath(); x.ellipse(640, 600, 96, 17, 0, 0, 7); x.fill();              // 落地影
  blit(x, atlases, 'table', 564, 526);
  blit(x, atlases, 'table', 640, 526);
  drawRune(x, 'ᚹ', 640, 588, 12, 'rgba(217,164,65,.5)', 2);
  x.fillStyle = PAL.stone;                                                    // 内嵌石槽板（浅色石板）
  x.beginPath();
  if (x.roundRect) x.roundRect(572, 531, 136, 20, 6); else x.rect(572, 531, 136, 20);
  x.fill(); thick(x, 3, PAL.ink); x.stroke();
  for (const [sx, sy] of BENCH_SOCKETS) {                                     // 四个内凹圆槽
    x.fillStyle = 'rgba(20,22,34,.55)';
    x.beginPath(); x.arc(sx, sy, 8, 0, 7); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.28)'; x.lineWidth = 1.5;
    x.beginPath(); x.arc(sx, sy, 8, -2.2, 0.6); x.stroke();
  }
  // 蜡烛座（桌角，火苗由动态层画）
  x.fillStyle = '#d8d3c6';
  x.fillRect(698, 512, 8, 14);
  thick(x, 3, PAL.ink); x.strokeRect(698, 512, 8, 14);
  x.fillStyle = '#9a958a';
  x.fillRect(700, 520, 4, 6);
  // —— 右半吸顶灯（底盘 + 灯罩；光由动态层画）——
  x.fillStyle = PAL.stoneD;
  x.fillRect(930, 28, 40, 8);
  x.fillStyle = '#c9c2b2';
  x.beginPath(); x.moveTo(924, 36); x.lineTo(976, 36); x.lineTo(962, 56); x.lineTo(938, 56); x.closePath();
  x.fill(); thick(x, 4); x.stroke();
  // —— 枯苗陶盆：MI 陶盆（苗/花由动态层画）——
  blit(x, atlases, 'pot', 320, 566);
  // —— 北墙右端门洞：Props 石拱门框（关门门扇与开门金光由动态层画）——
  blit(x, atlases, 'door_open', 1064, 157, { w: 95, h: 143 });
  x.fillStyle = 'rgba(0,0,0,.3)';                                              // 门前落地影
  x.beginPath(); x.ellipse(1112, 303, 46, 8, 0, 0, 7); x.fill();
  // —— 黄昏底色：压暗全场，保像素纹理（火光/灯光由动态层加暖）——
  x.fillStyle = 'rgba(16,18,36,.30)';
  x.fillRect(0, 0, LAYOUT.W, LAYOUT.H);
  return c;
}

export function makeDarkness() {
  const c = document.createElement('canvas');
  c.width = LAYOUT.W; c.height = LAYOUT.H;
  const x = c.getContext('2d');
  // 右半近乎全黑：边界右收（610→740 渐入），暗区不再吃掉半个屏幕
  const g = x.createLinearGradient(610, 0, 740, 0);
  g.addColorStop(0, 'rgba(6,7,11,0)');
  g.addColorStop(1, 'rgba(6,7,11,.95)');
  x.fillStyle = g;
  x.fillRect(610, 0, 130, LAYOUT.H);
  x.fillStyle = 'rgba(6,7,11,.95)';
  x.fillRect(740, 0, LAYOUT.W - 740, LAYOUT.H);
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

export function initScene(sc, atlases) {  // boot 时调用（需要 document）
  sc.atlases = atlases;
  sc.static = prerenderStatic(atlases);
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
  if (lit) {
    x.fillStyle = PAL.fire1;
    x.beginPath(); x.ellipse(tx, ty, 9, 12, 0, 0, 7); x.fill(); thick(x, 4); x.stroke();
    flame(x, tx, ty - 4, 22, t, seed); glow(x, tx, ty - 6, 90, 'rgba(255,179,71,ALPHA)', 0.28);
  } else {
    x.fillStyle = '#3f3a34';                                                  // 熄灭火把头（炭束）
    x.beginPath(); x.ellipse(tx, ty, 8, 11, 0, 0, 7); x.fill(); thick(x, 3.5, PAL.ink); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.10)'; x.lineWidth = 2;
    x.beginPath();
    x.moveTo(tx - 4, ty - 4); x.lineTo(tx - 4, ty + 6);
    x.moveTo(tx + 3, ty - 5); x.lineTo(tx + 3, ty + 5);
    x.stroke();
  }
}

// view：{ t, lit, doorState, doorPulse(0..1), doorOpen(0..1), bloomed, hatOn }
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
  drawTorch(x, 1000, 190, false, 4);                                             // 挪位避开北墙门洞
  // 木门（Props 拱顶木门；绕左轴收窄开门，规格 §6.3）
  x.save();
  x.translate(1081, 0);
  x.scale(Math.max(0.06, 1 - view.doorOpen * 0.94), 1);
  x.translate(-1081, 0);
  x.globalAlpha *= 1 - Math.min(1, view.doorOpen * 1.5);
  blit(x, sc.atlases, 'door_closed', 1081, 174, { w: 61, h: 126 });
  drawRune(x, 'ᛟ', 1112, 242, 26, view.doorState === 'closed' ? 'rgba(30,32,44,.85)' : PAL.glowRune, view.doorState === 'closed' ? 4 : 5);
  x.restore();
  x.restore();
  // —— 门后金光（开门时，从墙上门洞溢出）——
  if (view.doorOpen > 0.05) {
    x.save();
    x.globalAlpha = view.doorOpen;
    const g = x.createLinearGradient(0, 176, 0, 300);
    g.addColorStop(0, 'rgba(255,211,107,0)'); g.addColorStop(0.5, 'rgba(255,225,150,.85)'); g.addColorStop(1, 'rgba(255,211,107,0)');
    x.fillStyle = g;
    x.beginPath();                                                             // 门洞形状（拱顶）
    x.moveTo(1078, 296);
    x.lineTo(1078, 192);
    x.quadraticCurveTo(1078, 176, 1096, 176);
    x.lineTo(1128, 176);
    x.quadraticCurveTo(1146, 176, 1146, 192);
    x.lineTo(1146, 296);
    x.closePath();
    x.fill();
    glow(x, 1112, 248, 60 + 70 * view.doorOpen, 'rgba(255,213,110,ALPHA)', 0.35);
    x.globalAlpha = view.doorOpen * 0.35;                                      // 金光洒到门前地上
    x.fillStyle = PAL.gold;
    x.beginPath(); x.ellipse(1112, 312, 64, 13, 0, 0, 7); x.fill();
    for (let i = 0; i < 12; i++) {
      const py = 292 - ((t * 40 + i * 37) % 112);
      x.globalAlpha = view.doorOpen * 0.8;
      x.fillStyle = PAL.gold;
      x.fillRect(1084 + (i * 37) % 54, py, 3, 3);
    }
    x.restore();
  }
  // —— 门符文脉动（仪式中）——
  if (view.doorState === 'ritual') {
    glow(x, 1112, 242, 60 + view.doorPulse * 26, 'rgba(84,224,200,ALPHA)', 0.22 + view.doorPulse * 0.2);
  }
  // —— 墙上摇杆开关（明暗分界；四角螺丝 + 大摇杆 + LED；未按时青光脉动）——
  {
    const on = view.switchOn, sx = 660, sy = 282;
    thick(x, 3, '#3a3f4d');
    x.fillStyle = '#e8e4d8';                                                  // 面板
    x.beginPath();
    if (x.roundRect) x.roundRect(sx - 17, sy - 26, 34, 52, 6); else x.rect(sx - 17, sy - 26, 34, 52);
    x.fill(); x.stroke();
    x.fillStyle = '#9a958a';                                                  // 四角螺丝
    for (const [dx, dy] of [[-11, -20], [11, -20], [-11, 20], [11, 20]]) {
      x.beginPath(); x.arc(sx + dx, sy + dy, 2, 0, 7); x.fill();
    }
    const ry = on ? sy - 8 : sy + 6;                                          // 摇杆（上=开）
    x.fillStyle = on ? '#7bd88f' : '#cfc9ba';
    x.beginPath();
    if (x.roundRect) x.roundRect(sx - 10, ry - 10, 20, 21, 7); else x.rect(sx - 10, ry - 10, 20, 21);
    x.fill(); x.stroke();
    x.fillStyle = on ? '#39d47f' : '#a08b4a';                                 // LED 指示点
    x.beginPath(); x.arc(sx, sy + 21, 2.5, 0, 7); x.fill();
    if (!on) glow(x, sx, sy, 46 + view.doorPulse * 16, 'rgba(123,216,143,ALPHA)', 0.28 + view.doorPulse * 0.22);
  }
  // —— 合成台石槽：手持音素石时只亮空槽 ——
  if (view.benchHot) {
    BENCH_SOCKETS.forEach(([sx, sy], i) => {
      if (!view.craftSlots?.[i]) glow(x, sx, sy, 18, 'rgba(84,224,200,ALPHA)', 0.35);
    });
  }
  // —— 火光们 ——
  flame(x, 480, 470, 30, t, 1); glow(x, 480, 472, 130, 'rgba(255,140,60,ALPHA)', 0.3);   // 火盆
  flame(x, 702, 508, 9, t, 7); glow(x, 702, 510, 48, 'rgba(255,190,90,ALPHA)', 0.22);    // 合成台蜡烛
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
