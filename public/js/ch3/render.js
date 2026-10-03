// —— 析声者 · 第三关渲染层：自 ch3.js 绘制段原样迁入（房间/岸边/裂隙/深水/木筏/气泡）——
import { SIDE, drawBenchSide, shade } from '../sideview.js';
import { drawBenchStones } from '../workbench.js';
import { PAL, drawCross } from '../art.js';
import { rng, cavePlan, stalactitePlan, CAVE_SEEDS, CAVE_PAL } from './cave.js';

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
  // 岸边的水面已抽到 drawWater（逐帧动画，不能进烘焙层），由 drawScene 调用
}

export function drawBankObjects(w, x) {
  const geo = w.geo.bank;
  drawBenchSide(x, w.atlases, geo.benchX, geo.groundY, true, w.view.craftSlots);
  drawBoulder(x, 515, geo.groundY, CAVE_SEEDS.bank + 4);       // 洞穴巨石（原石墩，向左挪开给裂隙口让位）
  drawCrack(x, geo.doorX, geo.groundY, CAVE_SEEDS.bank + 3);   // 裂隙口（原石拱门）
  if (!w.game.raftAssembled) {              // 并排的原木：组筏后三根并入木筏，只画筏
    const ROTS = [-0.08, 0.06, -0.04];
    for (let k = 0; k < w.game.logsPlaced; k++) drawLog(x, geo.waterX - 20 + k * 44, geo.groundY - 16, ROTS[k % ROTS.length]);
  }
  if (w.game.raftAssembled) drawRaft(x, w.raft.x, w.raft.y, w.view.t);
  drawMooring(x, geo.waterX - 4, geo.groundY);                 // 系泊石桩（原 8×8 裸方块）
}

export function drawCreviceObjects(w, x) {
  const geo = w.geo.crevice;
  drawBenchSide(x, w.atlases, geo.benchX, geo.groundY, true, w.view.craftSlots);

  drawBigFissure(x, 660, geo.groundY);                 // 贯穿全屏的大裂缝

  // 卡在缝里的原木：横七竖八。第一根必须在 logX（creviceLog 目标锚点），其余是陈设
  drawLog(x, geo.logX, geo.groundY - 16);
  drawLog(x, geo.logX + 96, geo.groundY - 74, 0.46);
  drawLog(x, geo.logX + 178, geo.groundY - 40, -0.58);
  drawLog(x, geo.logX + 244, geo.groundY - 96, 0.22);

  drawRockArt(x, 905, 215);                            // 岩画刻痕（原为 fillText 占位）

  drawCrack(x, geo.spawnX, geo.groundY, CAVE_SEEDS.crevice + 3);   // 回程口（原石拱门）
}

// 贯穿全屏的锯齿大裂缝：左右两缘各一串折点，中间近黑，唇口受光/沉影
function drawBigFissure(x, cx, gy) {
  const rand = rng(CAVE_SEEDS.crevice + 4);
  const N = 17;
  const edge = (sign) => {
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const k = i / N;                                   // 0 = 洞顶, 1 = 地面
      // 不规则出刀：正弦会得到一个圆润的大黑团，固定交替又会变成机械锯齿
      const half = 96 + Math.abs(rand() * 2 - 1) * 108;
      pts.push([cx + sign * half, k * gy]);
    }
    return pts;
  };
  const L = edge(-1), R = edge(1);

  x.beginPath();
  x.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < L.length; i++) x.lineTo(L[i][0], L[i][1]);
  for (let i = R.length - 1; i >= 0; i--) x.lineTo(R[i][0], R[i][1]);
  x.closePath();
  x.fillStyle = '#0a0d12';
  x.fill();

  x.save();                                              // 纵深：纯黑会读成一块板，压一层竖向渐变
  x.clip();
  const dg = x.createLinearGradient(0, 0, 0, gy);
  dg.addColorStop(0, 'rgba(0,0,0,.55)');
  dg.addColorStop(1, 'rgba(26,34,44,.30)');
  x.fillStyle = dg;
  x.fillRect(cx - 260, 0, 520, gy);
  x.restore();

  x.lineWidth = 6; x.lineCap = 'round';                  // 唇口：左缘受光、右缘沉影
  x.strokeStyle = shade(CAVE_PAL.rockB, 0.26);
  x.beginPath();
  x.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < L.length; i++) x.lineTo(L[i][0], L[i][1]);
  x.stroke();
  x.strokeStyle = shade(CAVE_PAL.rockDark, -0.1);
  x.beginPath();
  x.moveTo(R[0][0], R[0][1]);
  for (let i = 1; i < R.length; i++) x.lineTo(R[i][0], R[i][1]);
  x.stroke();
}

// 岩画刻痕：原先是 fillText('◼  ◼  ◼') 的文字占位，改为画出来的凿刻
function drawRockArt(x, cx, cy) {
  x.strokeStyle = '#c1a76b'; x.lineWidth = 4; x.lineCap = 'round';
  x.beginPath();
  x.moveTo(cx - 95, cy + 25); x.lineTo(cx - 5, cy - 35); x.lineTo(cx + 75, cy + 25);
  x.stroke();
  x.beginPath();
  x.moveTo(cx - 40, cy - 5); x.lineTo(cx + 5, cy + 115); x.lineTo(cx + 45, cy - 5);
  x.stroke();
  x.beginPath();
  x.moveTo(cx - 55, cy + 80); x.lineTo(cx + 60, cy + 80);
  x.stroke();
  x.fillStyle = '#c1a76b';
  for (let i = 0; i < 3; i++) {                          // 凿点
    x.beginPath(); x.arc(cx - 60 + i * 60, cy + 155, 5, 0, 7); x.fill();
  }
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
  drawPoleMural(x, geo.muralX, 210);                   // 撑篙岩画（原为金线 + 中文标签占位）
  if (w.game.raftAssembled) drawRaft(x, w.raft.x, w.raft.y, w.view.t);
}

// 撑篙岩画：原先是三条金线配一句「石壁上的撑篙图」中文标签——用文字解释画面。
// 改为把画面本身画出来：一条水线、一只木筏、一个撑篙的人。
function drawPoleMural(x, cx, cy) {
  x.strokeStyle = '#c1a76b'; x.lineWidth = 5; x.lineCap = 'round'; x.lineJoin = 'round';

  x.beginPath();                                        // 水线
  x.moveTo(cx - 120, cy + 78);
  x.quadraticCurveTo(cx - 40, cy + 68, cx + 20, cy + 78);
  x.quadraticCurveTo(cx + 70, cy + 86, cx + 118, cy + 76);
  x.stroke();

  x.beginPath();                                        // 木筏
  x.moveTo(cx - 58, cy + 70); x.lineTo(cx + 42, cy + 70);
  x.moveTo(cx - 58, cy + 82); x.lineTo(cx + 42, cy + 82);
  x.stroke();

  x.beginPath();                                        // 撑篙的人：头 + 身 + 腿
  x.arc(cx - 12, cy + 6, 11, 0, 7); x.stroke();
  x.beginPath(); x.moveTo(cx - 12, cy + 17); x.lineTo(cx - 8, cy + 56); x.stroke();
  x.beginPath(); x.moveTo(cx - 8, cy + 56); x.lineTo(cx - 22, cy + 70); x.stroke();
  x.beginPath(); x.moveTo(cx - 8, cy + 56); x.lineTo(cx + 4, cy + 70); x.stroke();

  x.beginPath();                                        // 篙：从手里斜插进水里
  x.moveTo(cx + 22, cy - 6); x.lineTo(cx - 46, cy + 92);
  x.stroke();
  x.beginPath(); x.moveTo(cx - 14, cy + 24); x.lineTo(cx + 6, cy + 12); x.stroke();

  x.fillStyle = 'rgba(193,167,107,.55)';                // 凿刻毛面
  for (let i = 0; i < 5; i++) x.fillRect(cx - 118 + i * 58, cy + 118, 10, 4);
}

export function drawLog(x, cx, cy, rot = -0.08) {
  x.save(); x.translate(cx, cy); x.rotate(rot);
  x.strokeStyle = PAL.ink; x.lineWidth = 5;

  x.fillStyle = '#9a6536';                                // 树身
  x.beginPath(); x.roundRect ? x.roundRect(-78, -18, 156, 36, 16) : x.rect(-78, -18, 156, 36);
  x.fill(); x.stroke();

  x.fillStyle = '#7d5029';                                // 树皮暗边（下缘）
  x.beginPath();
  x.moveTo(-70, 10); x.quadraticCurveTo(0, 22, 70, 10);
  x.lineTo(70, 16); x.quadraticCurveTo(0, 28, -70, 16);
  x.closePath(); x.fill();

  x.fillStyle = '#b07a44';                                // 上缘受光
  x.beginPath(); x.roundRect ? x.roundRect(-70, -16, 140, 7, 4) : x.rect(-70, -16, 140, 7); x.fill();

  x.strokeStyle = '#6f4327'; x.lineWidth = 3;             // 木纹
  for (const dy of [-6, 2]) {
    x.beginPath();
    x.moveTo(-58, dy); x.quadraticCurveTo(0, dy + 3, 58, dy - 1);
    x.stroke();
  }

  x.fillStyle = '#d0a064'; x.strokeStyle = PAL.ink; x.lineWidth = 5;   // 左端年轮
  x.beginPath(); x.ellipse(-78, 0, 16, 18, 0, 0, 7); x.fill(); x.stroke();
  x.strokeStyle = '#6f4327'; x.lineWidth = 3;
  x.beginPath(); x.ellipse(-78, 0, 8, 11, 0, 0, 7); x.stroke();
  x.beginPath(); x.ellipse(-78, 0, 3, 4, 0, 0, 7); x.stroke();
  x.restore();
}

// 甲板顶面在 raft.y 之上的高度。kit 摆放玩家（站位、落点、可跳平台 topY）也引用它，
// 两边同源，避免木筏外形一改玩家就陷进木板里（终审 Important 抓到的正是这个漂移）。
export const RAFT_DECK = 14;

// 木筏：侧视——三根横放的原木微错开捆成一束，各带端面年轮，绳索绑扎。
// 不是俯视的平铺甲板：侧看只该看到原木的侧面轮廓与捆扎。
// state 本轮只有 'parked'（岸边停泊）；'riding'/'poling' 随深水轮实现，
// 签名留了默认值，drawDeepObjects 的四参调用因此不受影响。
export function drawRaft(x, cx, cy, t, state = 'parked') {
  const bob = Math.sin(t * 2.2) * (state === 'parked' ? 2 : 4);
  contactShadow(x, cx, cy + RAFT_DECK + 6, 74, 10);
  x.save(); x.translate(cx, cy + bob);

  const LOGS = [-RAFT_DECK, -RAFT_DECK + 14, -RAFT_DECK + 28];   // 三根原木，上下错开半根
  LOGS.forEach((py, i) => {
    x.fillStyle = '#9a6536'; x.strokeStyle = PAL.ink; x.lineWidth = 4;
    x.beginPath(); x.roundRect ? x.roundRect(-72, py, 144, 26, 12) : x.rect(-72, py, 144, 26);
    x.fill(); x.stroke();

    x.fillStyle = '#b07a44';                              // 上缘受光
    x.beginPath();
    if (x.roundRect) x.roundRect(-64, py + 3, 128, 6, 3); else x.rect(-64, py + 3, 128, 6);
    x.fill();

    x.strokeStyle = '#6f4327'; x.lineWidth = 2;           // 木纹
    x.beginPath();
    x.moveTo(-52, py + 15); x.lineTo(-6, py + 17); x.lineTo(44, py + 14); x.lineTo(62, py + 15);
    x.stroke();

    x.fillStyle = '#d0a064'; x.strokeStyle = PAL.ink; x.lineWidth = 4;   // 左端年轮
    x.beginPath(); x.ellipse(-72, py + 13, 8, 13, 0, 0, 7); x.fill(); x.stroke();
    x.strokeStyle = '#6f4327'; x.lineWidth = 2;
    x.beginPath(); x.ellipse(-72, py + 13, 4, 7, 0, 0, 7); x.stroke();
  });

  x.fillStyle = '#6b4423'; x.strokeStyle = PAL.ink; x.lineWidth = 4;   // 2 根压条（捆在木束上）
  for (const bx of [-42, 30]) {
    x.beginPath();
    if (x.roundRect) x.roundRect(bx, -RAFT_DECK, 10, 5, 2); else x.rect(bx, -RAFT_DECK, 10, 5);
    x.fill(); x.stroke();
  }

  x.strokeStyle = '#d5b56b'; x.lineWidth = 3;             // 绳索 X 形缠绕 + 绳结
  const ropeTop = -RAFT_DECK, ropeBot = -RAFT_DECK + 54;
  for (const bx of [-36, 36]) {
    x.beginPath();
    x.moveTo(bx - 9, ropeTop); x.lineTo(bx + 9, ropeBot);
    x.moveTo(bx + 9, ropeTop); x.lineTo(bx - 9, ropeBot);
    x.stroke();
    x.fillStyle = '#d5b56b';
    x.beginPath(); x.arc(bx, (ropeTop + ropeBot) / 2, 3.5, 0, 7); x.fill();
  }
  x.restore();
}

// 系泊石桩：原先是 8×8 的裸方块，太小、也没有落地影
export function drawMooring(x, cx, gy) {
  contactShadow(x, cx, gy + 2, 14, 5);

  x.fillStyle = shade(CAVE_PAL.rockA, -0.12);             // 桩身（侧面沉影）
  x.beginPath();
  x.moveTo(cx - 7, gy); x.lineTo(cx - 6, gy - 22);
  x.lineTo(cx + 6, gy - 22); x.lineTo(cx + 7, gy);
  x.closePath(); x.fill();

  x.fillStyle = shade(CAVE_PAL.rockA, 0.22);              // 顶面受光
  x.beginPath(); x.ellipse(cx, gy - 22, 7, 3, 0, 0, 7); x.fill();

  x.fillStyle = 'rgba(120,180,200,.28)';                  // 入水湿痕
  x.fillRect(cx - 8, gy - 6, 16, 6);
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
      // 高度随岩面高度缩放——第一关砖块只有 42px 高，这里的岩面近 120px，
      // 照搬 ch1 的固定 8..22px 只会得到一条贴边绿线，读不出苔藓
      const mh = Math.round((yb - y0) * (0.10 + f.wet * 0.45));
      for (let k = 0; k < mh; k += 2) {
        const dens = f.wet * (1 - 0.7 * k / mh) * 0.95;
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

// 裂隙口：墙上的一道天然裂缝（人高），替代原来的石拱门。
// 与裂隙房那道贯穿全屏的大裂缝同源——同一函数、不同尺寸与种子。
export function drawCrack(x, cx, gy, seed, opts = {}) {
  const { h = 170, halfBottom = 35, halfTop = 12 } = opts;
  const rand = rng(seed);
  const N = 12;                                          // 折点够密才有锯齿感，否则是个黑锥

  // 两缘折点：底宽顶窄；抖动只向内收，包围盒因此恒为 ±halfBottom
  const edge = (sign) => {
    const pts = [];
    for (let i = 0; i <= N; i++) {
      const k = i / N;
      const half = halfBottom + (halfTop - halfBottom) * k;
      const jag = (i === 0 || i === N) ? 0 : (0.10 + Math.abs(rand() * 2 - 1) * 0.38) * half;
      pts.push([cx + sign * (half - jag), gy - h * k]);   // 减 = 向内收，包围盒恒为 ±halfBottom
    }
    return pts;
  };
  const L = edge(-1), R = edge(1);

  x.beginPath();                                          // 洞口本体
  x.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < L.length; i++) x.lineTo(L[i][0], L[i][1]);
  for (let i = R.length - 1; i >= 0; i--) x.lineTo(R[i][0], R[i][1]);
  x.closePath();
  x.fillStyle = '#0a0d12';
  x.fill();

  const dg = x.createLinearGradient(0, gy - h, 0, gy);    // 纵深：上端更暗
  dg.addColorStop(0, 'rgba(0,0,0,.65)');
  dg.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = dg;
  x.fill();

  x.lineWidth = 3; x.lineCap = 'round';                   // 唇口：左缘受光、右缘沉影
  x.strokeStyle = shade(CAVE_PAL.rockB, 0.28);
  x.beginPath();
  x.moveTo(L[0][0], L[0][1]);
  for (let i = 1; i < L.length; i++) x.lineTo(L[i][0], L[i][1]);
  x.stroke();
  x.strokeStyle = shade(CAVE_PAL.rockDark, -0.15);
  x.beginPath();
  x.moveTo(R[0][0], R[0][1]);
  for (let i = 1; i < R.length; i++) x.lineTo(R[i][0], R[i][1]);
  x.stroke();

  const n = 3 + Math.floor(rand() * 3);                   // 崩口碎石（落在缝口内，不撑破包围盒）
  for (let i = 0; i < n; i++) {
    const side = i % 2 ? 1 : -1;
    const bx = cx + side * (halfBottom - 12 + rand() * 5);
    const by = gy - rand() * 14;
    const s = 4 + rand() * 5;
    contactShadow(x, bx, gy + 2, s * 1.4, s * 0.5);
    x.fillStyle = CAVE_PAL.rockB;
    x.beginPath();
    x.moveTo(bx - s, by);
    x.lineTo(bx + s * 0.6, by - s * 0.8);
    x.lineTo(bx + s, by);
    x.closePath(); x.fill();
  }
}

// 洞穴巨石：一块从岩壁上崩落的大石，底部贴地、顶部起伏、棱面明暗。
// 无碰撞、无交互、纯陈设——只为把岸边从「空荡」里拉回来，并给裂隙口让位。
// 轮廓自建：cavePlan 的边界顶点只做切向抖动、恒在边界上（墙地无缝要靠这个），
// 画不出独立巨石的起伏剪影，所以这里不用它做外形。
export function drawBoulder(x, cx, gy, seed, w = 90) {
  const h = w;
  const rand = rng(seed);
  const ox = cx - w / 2, oy = gy - h;

  contactShadow(x, cx, gy + 4, w * 0.55);

  const pts = [[ox + 5, gy], [ox, gy - h * 0.46]];
  const N = 6;
  for (let i = 0; i <= N; i++) {                          // 顶缘起伏（底缘贴地是平的）
    const k = i / N;
    pts.push([
      ox + w * (0.06 + 0.88 * k),
      oy + h * (0.10 + (i % 2 ? 0.20 : 0.04) * (0.55 + rand() * 0.9))
    ]);
  }
  pts.push([ox + w, gy - h * 0.46], [ox + w - 5, gy]);

  const outline = () => {
    x.beginPath();
    x.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) x.lineTo(pts[i][0], pts[i][1]);
    x.closePath();
  };

  // 比岩壁亮一档：与背景同色系会糊成一片，读不出是块独立的石头
  outline();
  x.fillStyle = shade(CAVE_PAL.rockA, 0.18);
  x.fill();
  x.lineWidth = 5; x.lineJoin = 'round';                  // 墨线描边——本作矢量道具的统一语言
  x.strokeStyle = PAL.ink;
  x.stroke();

  x.save();
  outline(); x.clip();
  x.fillStyle = shade(CAVE_PAL.rockA, -0.08);             // 右棱面（背光）
  x.beginPath();
  x.moveTo(ox + w * 0.52, oy);
  x.lineTo(ox + w, oy + h * 0.55);
  x.lineTo(ox + w, gy);
  x.lineTo(ox + w * 0.30, gy);
  x.closePath(); x.fill();
  x.fillStyle = shade(CAVE_PAL.rockA, 0.32);              // 左棱面（受光）
  x.beginPath();
  x.moveTo(ox + w * 0.30, oy);
  x.lineTo(ox + w * 0.52, oy + h * 0.42);
  x.lineTo(ox + w * 0.22, gy);
  x.lineTo(ox, gy);
  x.closePath(); x.fill();
  x.restore();
}

// ================= 场景生命周期与岸边预烘焙 =================

// 流动水面（岸边 + 深水房）。水是本关唯一「亮」的元素，承担了原光照层的一部分职责——
// 但它是材质处理（高光/倒影），不是光源。
// 岸边：水从 waterX 到右缘，有岸线；深水：整条暗河，水铺满全宽、没有岸。
export function drawWater(x, w, t) {
  const room = w.currentRoom;
  if (room !== 'bank' && room !== 'deep') return;
  const groundY = w.geo[room].groundY;
  const waterX = room === 'bank' ? w.geo.bank.waterX : 0;
  const wW = SIDE.W - waterX;
  const wH = SIDE.H - groundY;

  const g = x.createLinearGradient(waterX, 0, SIDE.W, 0);   // 底：近岸浅 → 河心深
  g.addColorStop(0, '#2a3a44');
  g.addColorStop(1, '#16232c');
  x.fillStyle = g;
  x.fillRect(waterX, groundY, wW, wH);

  x.fillStyle = 'rgba(120,160,180,.06)';                    // 倒影：洞顶与裂隙口的竖向拖影
  x.fillRect(waterX + 40, groundY, 90, wH);
  x.fillRect(waterX + 220, groundY, 60, wH);

  const SPEED = [0.6, 1.1, 0.35, 1.6];                      // 中：4 层不同速率的流动波
  const AMP = [3, 2, 5, 1.5];
  const BASE = [0.22, 0.45, 0.68, 0.86];
  x.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const phase = t * SPEED[i];
    x.strokeStyle = `rgba(130,190,215,${0.10 + i * 0.045})`;
    x.beginPath();
    let first = true;
    for (let px = waterX; px <= SIDE.W; px += 40) {
      const py = groundY + wH * BASE[i] + Math.sin(px * 0.012 + phase) * AMP[i];
      if (first) { x.moveTo(px, py); first = false; } else x.lineTo(px, py);
    }
    x.stroke();
  }

  if (room === 'bank') {                                    // 表：岸线泡沫（暗河没有岸）
    for (let i = 0; i < 8; i++) {
      const py = groundY + 6 + i * (wH / 9);
      x.fillStyle = `rgba(200,230,240,${0.10 + Math.abs(Math.sin(t * 1.4 + i)) * 0.10})`;
      x.beginPath();
      x.ellipse(waterX + 3 + Math.sin(t * 0.8 + i) * 4, py, 5, 2, 0, 0, 7);
      x.fill();
    }
  }

  const rand = rng(CAVE_SEEDS.bank + 5);                    // 表：高光碎点（种子固定，随时间闪烁）
  for (let i = 0; i < 26; i++) {
    const px = waterX + rand() * wW;
    const py = groundY + rand() * wH;
    const ph = rand() * 6.28;
    x.fillStyle = `rgba(220,245,255,${0.08 + Math.abs(Math.sin(t * 2.2 + ph)) * 0.22})`;
    x.fillRect(px, py, 2, 2);
  }
}

export function createScene() {
  return { baked: {} };
}

// 岸边静态层（岩壁 + 钟乳石 + 岩床）烘成一张离屏图，运行期每帧只 drawImage 一次。
// 岩壁是纯矢量，图集缺失也照常出图。
function prerenderBank(geo) {
  const groundY = geo.bank.groundY;
  const c = document.createElement('canvas');
  c.width = SIDE.W; c.height = SIDE.H;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;

  // 岸边靠水：湿度自左向右升（水在 x 760 之后），右半苔藓更盛——设计稿 §1
  drawCaveWall(x, cavePlan(CAVE_SEEDS.bank, SIDE.W, groundY, { wetRange: [0.12, 0.88] }), {
    base: CAVE_PAL.rockA, moss: CAVE_PAL.moss, mossHi: CAVE_PAL.mossHi
  });
  drawStalactites(x, stalactitePlan(CAVE_SEEDS.bank + 1, SIDE.W, 0, 9), 0, CAVE_PAL.rockDark);

  x.save();
  x.translate(0, groundY);
  // 岩床行数少而块大，才读得出「石板」而不是细条
  drawCaveFloor(x, cavePlan(CAVE_SEEDS.bank + 2, SIDE.W, SIDE.H - groundY, { cols: 6, rows: 2, wetRange: [0.05, 0.05] }),
    { base: CAVE_PAL.floor });
  x.restore();

  return c;
}

// 裂隙房静态层：干燥的岩壁（湿度整体压低，只有缝口附近略潮）+ 石笋 + 岩床
function prerenderCrevice(geo) {
  const groundY = geo.crevice.groundY;
  const c = document.createElement('canvas');
  c.width = SIDE.W; c.height = SIDE.H;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;

  drawCaveWall(x, cavePlan(CAVE_SEEDS.crevice, SIDE.W, groundY, { wetRange: [0.05, 0.3] }), {
    base: CAVE_PAL.rockA, moss: CAVE_PAL.moss, mossHi: CAVE_PAL.mossHi
  });
  drawStalactites(x, stalactitePlan(CAVE_SEEDS.crevice + 1, SIDE.W, 0, 7), 0, CAVE_PAL.rockDark);

  x.save();
  x.translate(0, groundY);
  drawCaveFloor(x, cavePlan(CAVE_SEEDS.crevice + 2, SIDE.W, SIDE.H - groundY, { cols: 6, rows: 2, wetRange: [0.05, 0.05] }),
    { base: CAVE_PAL.floor });
  x.restore();

  return c;
}

// 深水房静态层：湿岩壁（整条暗河，湿度最高）+ 石笋 + 岩床
function prerenderDeep(geo) {
  const groundY = geo.deep.groundY;
  const c = document.createElement('canvas');
  c.width = SIDE.W; c.height = SIDE.H;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;

  drawCaveWall(x, cavePlan(CAVE_SEEDS.deep, SIDE.W, groundY, { wetRange: [0.26, 0.46] }), {
    base: CAVE_PAL.rockA, moss: CAVE_PAL.moss, mossHi: CAVE_PAL.mossHi
  });
  drawStalactites(x, stalactitePlan(CAVE_SEEDS.deep + 1, SIDE.W, 0, 11), 0, CAVE_PAL.rockDark);

  x.save();
  x.translate(0, groundY);
  drawCaveFloor(x, cavePlan(CAVE_SEEDS.deep + 2, SIDE.W, SIDE.H - groundY, { cols: 6, rows: 2, wetRange: [0.05, 0.05] }),
    { base: CAVE_PAL.floor });
  x.restore();

  return c;
}

// boot 时调用（需要 document）。Node 测试环境下直接返回，不产生烘焙层。
// atlases 本轮未使用（岩壁是纯矢量），保留以对齐第一关 initScene 的形态。
export function initScene(sc, atlases, geo) {
  if (typeof document === 'undefined') return;
  try {
    sc.baked.bank = prerenderBank(geo);
    sc.baked.crevice = prerenderCrevice(geo);
    sc.baked.deep = prerenderDeep(geo);
  } catch (e) {
    // 烘焙失败退回逐帧绘制：房间仍然可见，但记一笔供调试
    if (typeof window !== 'undefined' && window.__errors) window.__errors.push('ch3 bake: ' + e.message);
  }
}

// 有烘焙层就 blit，没有就回退旧路径——裂隙房与深水房本轮尚未迁移，走 drawRoom。
// 水面逐帧动，不能进烘焙层，所以在背景之后单独画。
export function drawScene(x, sc, w) {
  const baked = sc.baked?.[w.currentRoom];
  if (baked) x.drawImage(baked, 0, 0);
  else drawRoom(w, x);
  drawWater(x, w, w.view?.t ?? 0);
}
