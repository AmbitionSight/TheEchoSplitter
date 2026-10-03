// —— 析声者 · 第三关渲染层：自 ch3.js 绘制段原样迁入（房间/岸边/裂隙/深水/木筏/气泡）——
import { SIDE, drawBenchSide, shade } from '../sideview.js';
import { drawBenchStones } from '../workbench.js';
import { PAL, drawCross } from '../art.js';

export function currentGround(w) {
  return w.currentRoom === 'crevice' ? w.geo.crevice.groundY : w.currentRoom === 'deep' ? w.geo.deep.groundY : w.geo.bank.groundY;
}

export function drawRoom(w, x) {
  const room = w.currentRoom;
  const ground = currentGround(w);
  const g = x.createLinearGradient(0, 0, 0, SIDE.H);
  g.addColorStop(0, room === 'deep' ? '#142b3a' : room === 'crevice' ? '#20242d' : '#1d2834');
  g.addColorStop(1, '#090c12');
  x.fillStyle = g;
  x.fillRect(0, 0, SIDE.W, SIDE.H);
  x.fillStyle = room === 'deep' ? '#17445c' : '#3c4650';
  x.fillRect(0, ground, SIDE.W, SIDE.H - ground);
  x.fillStyle = 'rgba(255,255,255,.09)';
  x.fillRect(0, ground, SIDE.W, 3);
  x.strokeStyle = 'rgba(255,255,255,.08)';
  x.lineWidth = 2;
  for (let i = 0; i < 18; i++) {
    const px = (i * 97 + 31) % SIDE.W;
    x.beginPath(); x.moveTo(px, 70 + (i % 5) * 72); x.lineTo(px + 40, 86 + (i % 5) * 72); x.stroke();
  }
  if (room === 'bank') {
    x.fillStyle = '#27343c'; x.fillRect(760, ground - 2, SIDE.W - 760, SIDE.H - ground + 2);
    x.strokeStyle = 'rgba(130,220,240,.45)';
    for (let i = 0; i < 9; i++) { x.beginPath(); x.moveTo(770, ground + 28 + i * 24); x.quadraticCurveTo(930, ground + 12 + i * 24, 1120, ground + 30 + i * 24); x.stroke(); }
  }
}

export function drawBankObjects(w, x) {
  const geo = w.geo.bank;
  drawBenchSide(x, w.atlases, geo.benchX, geo.groundY, true, w.view.craftSlots);
  x.fillStyle = '#67727d'; x.strokeStyle = PAL.ink; x.lineWidth = 5;
  x.beginPath(); x.roundRect ? x.roundRect(565, geo.groundY - 100, 150, 90, 12) : x.rect(565, geo.groundY - 100, 150, 90); x.fill(); x.stroke();
  x.fillStyle = '#b28a58'; x.fillRect(590, geo.groundY - 70, 100, 12);
  x.fillStyle = '#6b7078';
  x.beginPath(); x.moveTo(geo.doorX - 55, geo.groundY); x.lineTo(geo.doorX - 35, geo.groundY - 130); x.lineTo(geo.doorX + 35, geo.groundY - 130); x.lineTo(geo.doorX + 55, geo.groundY); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#10151b';
  x.beginPath(); x.moveTo(geo.doorX - 24, geo.groundY); x.lineTo(geo.doorX - 18, geo.groundY - 110); x.lineTo(geo.doorX + 18, geo.groundY - 110); x.lineTo(geo.doorX + 24, geo.groundY); x.closePath(); x.fill();
  if (!w.game.raftAssembled) {              // 并排的原木：组筏后三根并入木筏，只画筏
    const ROTS = [-0.08, 0.06, -0.04];
    for (let k = 0; k < w.game.logsPlaced; k++) drawLog(x, geo.waterX - 20 + k * 44, geo.groundY - 16, ROTS[k % ROTS.length]);
  }
  if (w.game.raftAssembled) drawRaft(x, w.raft.x, w.raft.y, w.view.t);
  x.fillStyle = '#2d3941'; x.fillRect(geo.waterX - 4, geo.groundY - 4, 8, 8);
}

export function drawCreviceObjects(w, x) {
  const geo = w.geo.crevice;
  drawBenchSide(x, w.atlases, geo.benchX, geo.groundY, true, w.view.craftSlots);
  x.fillStyle = '#10151c'; x.strokeStyle = '#75808b'; x.lineWidth = 8;
  x.beginPath(); x.moveTo(500, 0); x.lineTo(560, 160); x.lineTo(520, 310); x.lineTo(610, 455); x.lineTo(560, geo.groundY); x.lineTo(820, geo.groundY); x.lineTo(760, 430); x.lineTo(820, 280); x.lineTo(750, 120); x.lineTo(790, 0); x.closePath(); x.fill(); x.stroke();
  drawLog(x, geo.logX, geo.groundY - 16);
  x.strokeStyle = '#c1a76b'; x.lineWidth = 4;
  x.beginPath(); x.moveTo(810, 180); x.lineTo(900, 240); x.lineTo(980, 180); x.lineTo(1040, 250); x.stroke();
  x.beginPath(); x.moveTo(830, 180); x.lineTo(850, 300); x.moveTo(940, 210); x.lineTo(940, 320); x.stroke();
  x.fillStyle = '#c1a76b'; x.font = '18px system-ui'; x.fillText('◼  ◼  ◼', 820, 365);
  drawCreviceDoor(x, geo.spawnX, geo.groundY);   // 左壁回程门（进来的门）
}

// 裂隙回程门：石拱 + 暗洞（与岸边门同族，略小）
function drawCreviceDoor(x, cx, gy) {
  x.fillStyle = '#5f6a74'; x.strokeStyle = PAL.ink; x.lineWidth = 5;
  x.beginPath(); x.moveTo(cx - 42, gy); x.lineTo(cx - 28, gy - 108); x.lineTo(cx + 28, gy - 108); x.lineTo(cx + 42, gy); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#0d1219';
  x.beginPath(); x.moveTo(cx - 19, gy); x.lineTo(cx - 13, gy - 90); x.lineTo(cx + 13, gy - 90); x.lineTo(cx + 19, gy); x.closePath(); x.fill();
}

// —— 深水段合成位：石壁上凿出四个圆孔凹槽（不再把合成台摆在河上）——
// 槽位几何与横版合成台一致（bx-33 + i*22, gy-62），槽内石头复用 drawBenchStones
function drawWallSockets(x, bx, gy, hot, slots) {
  const sockets = [];
  for (let i = 0; i < 4; i++) sockets.push([bx - 33 + i * 22, gy - 160]);
  x.save();
  x.fillStyle = 'rgba(8,11,17,.6)';                                   // 凿刻的凹入石板（抬到壁面上部）
  x.beginPath();
  if (x.roundRect) x.roundRect(bx - 54, gy - 182, 108, 46, 10); else x.rect(bx - 54, gy - 182, 108, 46);
  x.fill();
  x.strokeStyle = 'rgba(0,0,0,.55)'; x.lineWidth = 2;                 // 上缘沉影
  x.beginPath(); x.moveTo(bx - 50, gy - 182); x.lineTo(bx + 50, gy - 182); x.stroke();
  x.strokeStyle = 'rgba(255,255,255,.14)';                            // 下缘受光
  x.beginPath(); x.moveTo(bx - 50, gy - 136); x.lineTo(bx + 50, gy - 136); x.stroke();
  sockets.forEach(([sx, sy], i) => {
    x.fillStyle = '#070a10';                                          // 圆孔
    x.beginPath(); x.arc(sx, sy, 10, 0, 7); x.fill();
    const hole = x.createRadialGradient(sx, sy - 3, 2, sx, sy, 10);   // 洞感：内阴影
    hole.addColorStop(0, 'rgba(0,0,0,.7)'); hole.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = hole; x.beginPath(); x.arc(sx, sy, 10, 0, 7); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.22)'; x.lineWidth = 1.5;       // 孔下缘受光边
    x.beginPath(); x.arc(sx, sy, 10, 0.4, 2.6); x.stroke();
    if (hot && !slots?.[i]) {                                         // 手持音素石：空孔亮起
      x.fillStyle = 'rgba(84,224,200,.28)';
      x.beginPath(); x.arc(sx, sy, 13, 0, 7); x.fill();
    }
  });
  if (slots) drawBenchStones(x, slots, sockets);                      // 已嵌入的音素石
  x.restore();
}

export function drawDeepObjects(w, x) {
  const geo = w.geo.deep;
  if (w.game.stalled) drawWallSockets(x, geo.benchX, geo.groundY, w.game.hand?.kind === 'stone', w.view.craftSlots);
  x.fillStyle = 'rgba(120,205,230,.10)'; x.fillRect(0, geo.groundY - 80, SIDE.W, 80);
  x.strokeStyle = '#c1a76b'; x.lineWidth = 5;
  x.beginPath(); x.moveTo(geo.muralX - 120, 190); x.lineTo(geo.muralX, 100); x.lineTo(geo.muralX + 110, 190); x.stroke();
  x.beginPath(); x.moveTo(geo.muralX - 65, 150); x.lineTo(geo.muralX - 20, 270); x.lineTo(geo.muralX + 30, 150); x.stroke();
  x.beginPath(); x.moveTo(geo.muralX - 80, 230); x.lineTo(geo.muralX + 85, 230); x.stroke();
  if (w.game.raftAssembled) drawRaft(x, w.raft.x, w.raft.y, w.view.t);
  x.fillStyle = 'rgba(255,221,140,.5)'; x.font = '18px system-ui'; x.fillText('石壁上的撑篙图', geo.muralX - 88, 310);
}

function drawLog(x, cx, cy, rot = -0.08) {
  x.save(); x.translate(cx, cy); x.rotate(rot);
  x.fillStyle = '#9a6536'; x.strokeStyle = PAL.ink; x.lineWidth = 5;
  x.beginPath(); x.roundRect ? x.roundRect(-78, -18, 156, 36, 16) : x.rect(-78, -18, 156, 36); x.fill(); x.stroke();
  x.fillStyle = '#d0a064'; x.beginPath(); x.ellipse(-78, 0, 16, 18, 0, 0, 7); x.fill(); x.stroke();
  x.strokeStyle = '#6f4327'; x.lineWidth = 3; x.beginPath(); x.ellipse(-78, 0, 8, 11, 0, 0, 7); x.stroke();
  x.restore();
}

function drawRaft(x, cx, cy, t) {
  const bob = Math.sin(t * 2.2) * 4;
  x.save(); x.translate(cx, cy + bob);
  x.fillStyle = '#8e5e33'; x.strokeStyle = PAL.ink; x.lineWidth = 5;
  for (let i = -2; i <= 2; i++) { x.beginPath(); x.roundRect ? x.roundRect(i * 28 - 72, -14, 144, 22, 8) : x.rect(i * 28 - 72, -14, 144, 22); x.fill(); x.stroke(); }
  x.strokeStyle = '#d5b56b'; x.lineWidth = 5;
  x.beginPath(); x.moveTo(-68, -20); x.lineTo(68, 10); x.moveTo(-68, 10); x.lineTo(68, -20); x.stroke();
  x.restore();
}

export function drawBubble(x, p, t) {
  const a = Math.min(1, t / 0.4);
  const bx = p.x + 12, by = p.y - 110;
  x.save(); x.globalAlpha = a; x.fillStyle = 'rgba(247,244,234,.96)'; x.strokeStyle = PAL.ink; x.lineWidth = 3;
  x.beginPath(); x.roundRect ? x.roundRect(bx - 52, by - 32, 104, 58, 14) : x.rect(bx - 52, by - 32, 104, 58); x.fill(); x.stroke();
  x.beginPath(); x.moveTo(bx - 8, by + 26); x.lineTo(bx + 2, by + 40); x.lineTo(bx + 12, by + 26); x.closePath(); x.fill(); x.stroke();
  drawCross(x, bx + 12, by - 2, 26);
  x.restore();
}

// ================= 洞穴岩面（本轮只服务岸边；裂隙/深水两轮复用） =================

// 与 ch1 暗海/砌石同一套像素语言
const BAYER = [[0, 2], [3, 1]];

function polyPath(x, pts) {
  x.beginPath();
  x.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
  x.closePath();
}

function planExtent(plan) {
  let W = 0, H = 0;
  for (const v of plan.verts ?? []) { if (v[0] > W) W = v[0]; if (v[1] > H) H = v[1]; }
  return { W, H };
}

// 环境遮蔽式落地影：无光源就没有方向，所以是一枚居中的柔和椭圆，不做偏移投影
export function contactShadow(x, cx, cy, rx, ry = rx * 0.28) {
  x.fillStyle = 'rgba(0,0,0,.25)';
  x.beginPath(); x.ellipse(cx, cy, rx, ry, 0, 0, 7); x.fill();
}

// 岩壁：逐面上色 + 上缘受光 / 下缘沉影 + 裂缝 + 拜耳抖动苔藓 + 洞顶沉暗
export function drawCaveWall(x, plan, opts) {
  const faces = plan.faces ?? [];
  if (!faces.length) return;
  const { base, moss, mossHi } = opts;
  const { W, H } = planExtent(plan);

  x.fillStyle = shade(base, -0.35);                       // 岩缝底色
  x.fillRect(0, 0, W, H);

  for (const f of faces) {
    const p = f.pts;
    const xs = p.map(q => q[0]), ys = p.map(q => q[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs);
    const y0 = Math.min(...ys), yb = Math.max(...ys);

    x.fillStyle = shade(base, f.t - 1);                   // 面体（逐块明度差 ±10%）
    polyPath(x, p); x.fill();

    x.lineWidth = 2;                                      // 上缘受光
    x.strokeStyle = shade(base, f.t - 1 + 0.16);
    x.beginPath(); x.moveTo(p[0][0], p[0][1]); x.lineTo(p[1][0], p[1][1]); x.stroke();
    x.strokeStyle = shade(base, f.t - 1 - 0.22);          // 下缘沉影
    x.beginPath(); x.moveTo(p[3][0], p[3][1]); x.lineTo(p[2][0], p[2][1]); x.stroke();

    if (f.crack) {                                        // 斜裂一道
      const cx0 = (p[0][0] + p[3][0]) / 2;
      x.strokeStyle = 'rgba(30,28,34,.55)'; x.lineWidth = 2; x.lineCap = 'round';
      x.beginPath();
      x.moveTo(cx0 - 6, y0 + 4);
      x.lineTo(cx0 + 3, y0 + (yb - y0) * 0.45);
      x.lineTo(cx0 - 4, yb - 4);
      x.stroke();
    }

    if (f.wet > 0) {                                      // 苔藓：下缘向上抖动生长
      const mh = Math.round(6 + f.wet * 16);
      for (let k = 0; k < mh; k += 2) {
        const dens = f.wet * (1 - k / mh) * 0.95;
        for (let px = x0 + 1; px < x1 - 1; px += 2) {
          const th = BAYER[((px / 2) | 0) & 1][(((yb - k) / 2) | 0) & 1] / 4;
          if (dens * (0.3 + th * 0.9) > 0.30) {
            x.fillStyle = (k < 4 && th > 0.4) ? mossHi : moss;
            x.fillRect(px, yb - k, 2, 2);
          }
        }
      }
    }

    for (let i = 0; i < f.speck; i++) {                   // 岩屑亮点（确定性，不用随机）
      const sx = x0 + ((i * 37 + f.c * 17) % Math.max(1, x1 - x0));
      const sy = y0 + ((i * 53 + f.r * 29) % Math.max(1, yb - y0));
      x.fillStyle = shade(base, f.t - 1 + 0.25);
      x.fillRect(sx, sy, 1, 1);
    }
  }

  const g = x.createLinearGradient(0, 0, 0, H);           // 洞顶沉暗
  g.addColorStop(0, 'rgba(6,8,14,.45)');
  g.addColorStop(0.55, 'rgba(6,8,14,0)');
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
}

// 岩床：顶缘受光 / 底缘沉影，并叠墙脚落地阴影
export function drawCaveFloor(x, plan, opts) {
  const faces = plan.faces ?? [];
  if (!faces.length) return;
  const { base } = opts;
  const { W, H } = planExtent(plan);

  x.fillStyle = shade(base, -0.35);
  x.fillRect(0, 0, W, H);

  for (const f of faces) {
    const p = f.pts;
    x.fillStyle = shade(base, f.t - 1);
    polyPath(x, p); x.fill();

    x.lineWidth = 2;
    x.strokeStyle = shade(base, f.t - 1 + 0.13);          // 顶缘受光
    x.beginPath(); x.moveTo(p[0][0], p[0][1]); x.lineTo(p[1][0], p[1][1]); x.stroke();
    x.strokeStyle = shade(base, f.t - 1 - 0.2);           // 底缘沉影
    x.beginPath(); x.moveTo(p[3][0], p[3][1]); x.lineTo(p[2][0], p[2][1]); x.stroke();

    if (f.crack) {
      const cx0 = (p[0][0] + p[3][0]) / 2;
      x.strokeStyle = 'rgba(30,28,34,.5)'; x.lineWidth = 3; x.lineCap = 'round';
      x.beginPath();
      x.moveTo(cx0 - 8, p[0][1] + 6);
      x.lineTo(cx0 + 5, p[0][1] + (p[3][1] - p[0][1]) * 0.5);
      x.lineTo(cx0 - 3, p[3][1] - 6);
      x.stroke();
    }
  }

  const fsh = x.createLinearGradient(0, 0, 0, Math.min(40, H));   // 墙脚落地阴影
  fsh.addColorStop(0, 'rgba(0,0,0,.30)');
  fsh.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = fsh;
  x.fillRect(0, 0, W, Math.min(40, H));
}

// 洞顶钟乳石：闭合锥形 + 左缘提亮 / 右缘压暗
export function drawStalactites(x, plan, topY, base) {
  for (const s of plan) {
    const y0 = s.y ?? topY;
    const tipX = s.x + s.lean * s.h * 0.3;
    const tipY = y0 + s.h;

    x.fillStyle = base;
    x.beginPath();
    x.moveTo(s.x - s.w, y0);
    x.lineTo(tipX - 1, tipY);
    x.lineTo(tipX + 1, tipY);
    x.lineTo(s.x + s.w, y0);
    x.closePath(); x.fill();

    x.lineWidth = 2;
    x.strokeStyle = shade(base, 0.22);
    x.beginPath(); x.moveTo(s.x - s.w, y0); x.lineTo(tipX - 1, tipY); x.stroke();
    x.strokeStyle = shade(base, -0.25);
    x.beginPath(); x.moveTo(s.x + s.w, y0); x.lineTo(tipX + 1, tipY); x.stroke();
  }
}
