// —— 横版共用件：移动/跳跃/攀爬物理核心 + 通用渲染（火把/合成台/石头/E 提示/暗角） ——
import { PAL, drawRune } from './art.js';
import { shade } from './masonry.js';
import { isVowel, stoneCount } from './hotbar.js';
import { drawBenchStones } from './workbench.js';
import { blit, tile } from './sprites.js';

export const SIDE = { W: 1280, H: 720 };

// —— 物理核心：w = { player, geo, keys, cfg } ——
// cfg: { gap:{L,R}|null, wall:{X,W,topY}|null, rope:{ok:()=>bool, x:()=>number}|null,
//        canJump:bool, speed?, onLand?(x), onFell?(), onTopReach?(), onCross?(x) }
export function moveSide(w, dt) {
  const p = w.player, geo = w.geo, cfg = w.cfg;
  const gap = cfg.gap, wall = cfg.wall, rope = cfg.rope;
  const overGap = gap && p.x > gap.L + 6 && p.x < gap.R - 6;
  const onTop = () => !!wall && p.y <= wall.topY + 2 && p.x > wall.X && p.x < wall.X + wall.W;

  if (p.climbing) {
    if (!rope?.ok() || Math.abs(p.x - rope.x()) > 40) p.climbing = false;
    else {
      p.dir = 'up';                                    // 攀爬 = 背对镜头
      if (w.keys.has('u')) { p.y -= 170 * dt; p.walkT += dt; }
      if (w.keys.has('d')) p.y += 130 * dt;
      p.y = Math.max(wall.topY, Math.min(geo.groundY, p.y));
      if (p.y <= wall.topY + 1) { p.climbing = false; cfg.onTopReach?.(); }
    }
  }
  if (!p.climbing) {
    const sp = (cfg.speed ?? 300) * dt;
    if (w.keys.has('l')) { p.x -= sp; p.facing = -1; p.dir = 'left'; }
    if (w.keys.has('r')) { p.x += sp; p.facing = 1; p.dir = 'right'; }
    p.moving = w.keys.size > 0 && !p.airborne;
    // blockGround:false = 高台/窗语义（第三关）：只保留墙顶平台，窗户以下墙面畅通
    if (wall && wall.blockGround !== false) {
      const inWallX = p.x > wall.X - 14 && p.x < wall.X + wall.W + 14;
      if (inWallX && p.y > wall.topY + 4) {
        p.x = p.x < wall.X + wall.W / 2 ? wall.X - 14 : wall.X + wall.W + 14;
      }
    }
    if (rope?.ok() && !p.airborne && p.y > wall.topY && Math.abs(p.x - rope.x()) < 75 && w.keys.has('u')) {
      p.climbing = true; p.x = rope.x();                // 抓住绳子：吸附到绳位（墙把玩家挡在两侧，起爬判定须放宽）
    }
    if (p.airborne || overGap) {
      p.vy += 1500 * dt; p.y += p.vy * dt; p.airborne = true;
      if (p.vy > 0 && p.y >= geo.groundY && !overGap) {
        p.y = geo.groundY; p.vy = 0; p.airborne = false;
        cfg.onLand?.(p.x);
      }
      if (p.y > geo.groundY + 230) cfg.onFell?.();
    } else if (wall && !onTop() && p.y <= wall.topY + 4 && geo.groundY - p.y > 10) {
      p.airborne = true; p.vy = 0;                                       // 走出墙顶边缘：下落
    } else {
      p.y = onTop() ? wall.topY : geo.groundY;
    }
  }
  p.x = Math.max(40, Math.min(SIDE.W - 40, p.x));
}

export function sideJump(w) {
  const p = w.player;
  if (!p.airborne && !p.climbing) { p.vy = -740; p.airborne = true; }
}

// —— 石头（横版抛物线；opts.noSinkGap 用于无坑章节） ——
export function spawnSideStone(list, ipa, x, y, vx, vy) {
  list.push({ ipa, x, y, vx, vy, state: 'fly', t: 0, phase: Math.random() * 6.28 });
}
export function stepSideStone(s, dt, groundY) {
  s.vy += 1300 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
  if (s.y >= groundY - 14 && s.vy > 0) { s.y = groundY - 14; s.vy = 0; s.vx = 0; s.state = 'idle'; }
}

// 掉落规划（纯函数）：旧识音素已由开局记忆石补位，不再落地（新档无记忆时照掉）；
// 落点自边界内侧向左散开，保证全部落在可达地面上（第二关边界=裂口左缘，第三关=墙左缘）
export function planDropStones(wordDef, inv, dropXY, edgeX) {
  const ax = Math.min(dropXY[0], edgeX - 90);
  return wordDef.phonemes.map(([ipa]) => ipa).concat(wordDef.decoys || [])   // decoys：学过的干扰音，一并掉落
    .filter(ipa => stoneCount(inv, ipa) === 0)
    .map((ipa, i) => ({ ipa, x: ax - i * 46 }));
}

// 听声点浮标：一枚脉动的青点（走近更亮），提示"这里有声音"（第二关起）
export function drawListenSpots(x, w) {
  const spots = w.content?.listening;
  if (!spots) return;
  const t = w.view.t, px = w.player.x;
  for (const spot of spots) {
    const near = Math.abs(px - spot.x) < spot.r;
    const pulse = 0.5 + Math.sin(t * 2.2 + spot.x * 0.03) * 0.5;
    const a = (near ? 0.45 : 0.18) * (0.6 + pulse * 0.4);
    const g = x.createRadialGradient(spot.x, spot.y, 2, spot.x, spot.y, 30 + pulse * 10);
    g.addColorStop(0, `rgba(84,224,200,${a})`);
    g.addColorStop(1, 'rgba(84,224,200,0)');
    x.fillStyle = g;
    x.beginPath(); x.arc(spot.x, spot.y, 40, 0, 7); x.fill();
    x.fillStyle = `rgba(233,228,213,${0.30 + pulse * 0.35})`;
    x.beginPath(); x.arc(spot.x, spot.y, 3, 0, 7); x.fill();
  }
}

// —— 通用渲染 ——
export function drawSideStone(x, s, t) {
  const bob = s.state === 'idle' ? Math.sin(t * 2.2 + s.phase) * 3 : 0;
  x.save();
  x.translate(s.x, s.y + bob);
  x.fillStyle = isVowel(s.ipa) ? PAL.vowel : PAL.cons;
  x.beginPath(); x.arc(0, 0, 15, 0, 7); x.fill();
  x.lineWidth = 3.5; x.strokeStyle = PAL.ink; x.stroke();
  x.strokeStyle = 'rgba(255,255,255,' + (0.35 + Math.abs(Math.sin(t * 3 + s.phase)) * 0.4) + ')';
  x.beginPath(); x.arc(0, 0, 18, 0, 7); x.stroke();
  x.fillStyle = PAL.ink; x.font = 'bold 13px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(s.ipa, 0, 1);
  x.restore();
}

export function drawTorchSide(x, tx, ty, t, glow = null) {
  x.strokeStyle = PAL.wood2; x.lineWidth = 6;
  x.beginPath(); x.moveTo(tx, ty + 26); x.lineTo(tx, ty); x.stroke();
  const f = Math.sin(t * 13 + tx) * 0.12 + 1;
  x.fillStyle = PAL.fire2;
  x.beginPath();
  x.moveTo(tx, ty - 18 * f);
  x.bezierCurveTo(tx + 10, ty - 6, tx + 8, ty + 6, tx, ty + 10);
  x.bezierCurveTo(tx - 8, ty + 6, tx - 10, ty - 6, tx, ty - 18 * f);
  x.fill();
  x.fillStyle = PAL.fireCore;
  x.beginPath(); x.arc(tx, ty + 2, 4, 0, 7); x.fill();
  // 动态光晕：可选第 5 参 {r,a}（缺省＝原 110/.22，ch2b/ch3 不受影响）；章节传 LIGHTS2 锚点的 r/s
  const gr = glow?.r ?? 110, ga = glow?.a ?? 0.22;
  const g = x.createRadialGradient(tx, ty, 4, tx, ty, gr);
  g.addColorStop(0, `rgba(255,170,80,${ga})`); g.addColorStop(1, 'rgba(255,170,80,0)');
  x.fillStyle = g; x.beginPath(); x.arc(tx, ty, gr, 0, 7); x.fill();
}

export function drawBenchSide(x, imgs, bx, gy, hot, slots = null, opts = {}) {
  x.fillStyle = 'rgba(0,0,0,.25)';
  x.beginPath(); x.ellipse(bx, gy + 6, 70, 9, 0, 0, 7); x.fill();
  blit(x, imgs, 'table', bx - 76, gy - 74);
  blit(x, imgs, 'table', bx, gy - 74);
  if (opts.candle) {                                          // ch1 同款台面陈设：内嵌石槽板 + ᚹ 阴刻 + 蜡烛座
    x.fillStyle = PAL.stone;
    x.beginPath();
    if (x.roundRect) x.roundRect(bx - 68, gy - 69, 136, 20, 6); else x.rect(bx - 68, gy - 69, 136, 20);
    x.fill();
    x.lineWidth = 3; x.strokeStyle = PAL.ink; x.stroke();
    drawRune(x, 'ᚹ', bx, gy - 12, 12, 'rgba(217,164,65,.5)', 2);          // ᚹ 阴刻（金蚀，不发光）
    x.fillStyle = '#d8d3c6'; x.fillRect(bx + 58, gy - 88, 8, 14);         // 蜡烛座（火苗由本函数动态层画）
    x.lineWidth = 3; x.strokeStyle = PAL.ink; x.strokeRect(bx + 58, gy - 88, 8, 14);
    x.fillStyle = '#9a958a'; x.fillRect(bx + 60, gy - 80, 4, 6);
  }
  const sockets = [];
  for (let i = 0; i < 4; i++) {
    const sx = bx - 33 + i * 22;
    sockets.push([sx, gy - 62]);
    x.fillStyle = 'rgba(20,22,34,.55)';
    x.beginPath(); x.arc(sx, gy - 62, 5, 0, 7); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.28)'; x.lineWidth = 1.2;
    x.beginPath(); x.arc(sx, gy - 62, 5, -2.2, 0.6); x.stroke();
    if (hot && !slots?.[i]) { x.fillStyle = 'rgba(84,224,200,.25)'; x.beginPath(); x.arc(sx, gy - 62, 9, 0, 7); x.fill(); }  // 手持音素石：只亮空槽
  }
  if (slots) drawBenchStones(x, slots, sockets);            // 槽内音素石上台面
  if (opts.candle) {                                          // 火苗 + 光晕：位置读 benchCandle 锚点（与章节 LIGHTS2 同源）
    const c = benchCandle(bx, gy), f = Math.sin((opts.t ?? 0) * 13 + bx) * 0.12 + 1, sz = 9, cy = c.y - 2;
    x.fillStyle = PAL.fire2;
    x.beginPath();
    x.moveTo(c.x, cy - sz * f);
    x.bezierCurveTo(c.x + sz * 0.55, cy - sz * 0.25, c.x + sz * 0.42, cy + sz * 0.3, c.x, cy + sz * 0.34);
    x.bezierCurveTo(c.x - sz * 0.42, cy + sz * 0.3, c.x - sz * 0.55, cy - sz * 0.25, c.x, cy - sz * f);
    x.closePath(); x.fill();
    x.fillStyle = PAL.fireCore;
    x.beginPath();
    x.moveTo(c.x, cy - sz * 0.3 * f);
    x.bezierCurveTo(c.x + sz * 0.24, cy, c.x + sz * 0.2, cy + sz * 0.26, c.x, cy + sz * 0.3);
    x.bezierCurveTo(c.x - sz * 0.2, cy + sz * 0.26, c.x - sz * 0.24, cy, c.x, cy - sz * 0.3 * f);
    x.closePath(); x.fill();
    const g = x.createRadialGradient(c.x, c.y, 2, c.x, c.y, 48);
    g.addColorStop(0, 'rgba(255,190,90,.26)'); g.addColorStop(1, 'rgba(255,190,90,0)');
    x.fillStyle = g; x.beginPath(); x.arc(c.x, c.y, 48, 0, 7); x.fill();
  }
}

// 横版背墙：MI 墙面平铺 + 压暗
export function drawWallBack(x, imgs, W, H, dim = 0.30) {
  tile(x, imgs, 'wall_face', 0, 0, W, H);
  x.fillStyle = `rgba(10,12,22,${dim})`;
  x.fillRect(0, 0, W, H);
}

// 横版地面：MI 地板平铺（从 groundY 往下）
export function drawFloorSide(x, imgs, x0, y0, w, h) {
  tile(x, imgs, 'floor', x0, y0, w, h);
}

export function drawEHint(x, t, time) {
  if (!t) return;
  const pulse = Math.sin(time * 3.2) * 0.5 + 0.5;
  x.save();
  x.translate(t.x, t.y + 6);
  x.scale(1, 0.38);
  const rr = 30 + pulse * 8;
  const gg = x.createRadialGradient(0, 0, rr * 0.25, 0, 0, rr);
  gg.addColorStop(0, 'rgba(84,224,200,.32)'); gg.addColorStop(1, 'rgba(84,224,200,0)');
  x.fillStyle = gg;
  x.beginPath(); x.arc(0, 0, rr, 0, 7); x.fill();
  x.restore();
  const kx = t.x + 28, ky = t.y - 58 + Math.sin(time * 2.6) * 2.5;
  x.save();
  x.translate(kx, ky); x.rotate(0.1);
  x.fillStyle = 'rgba(24,27,36,.92)';
  x.beginPath();
  if (x.roundRect) x.roundRect(-11, -11, 22, 22, 6); else x.rect(-11, -11, 22, 22);
  x.fill();
  x.lineWidth = 1.5; x.strokeStyle = PAL.glowRune; x.stroke();
  x.fillStyle = '#F5F5F7'; x.font = 'bold 12px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('E', 0, 0.5);
  x.restore();
}

export function vignette(x, W = SIDE.W, H = SIDE.H) {
  const v = x.createRadialGradient(W / 2, H / 2 - 40, 340, W / 2, H / 2 - 40, 760);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.5)');
  x.fillStyle = v; x.fillRect(0, 0, W, H);
}

export const AMBIENT = { grade: 0.24, vignette: 0.42 };   // 与 ch1 对齐（原两章 .30/.50）
export function benchCandle(bx, gy) { return { x: bx + 62, y: gy - 90 }; }
// 点哪走哪（第一关 walkTarget 的横版移植；调在 moveSide 之后）
export function stepWalkTo(w, dt) {
  const t = w.walkTo; if (!t || w.keys.size) return;
  const p = w.player, sp = w.cfg.walkSpeed ?? w.cfg.speed ?? 300, dx = t.x - p.x;
  if (Math.abs(dx) <= 6) { w.walkTo = null; p.moving = false; return; }
  p.x += Math.sign(dx) * Math.min(Math.abs(dx), sp * dt);
  p.dir = p.facing = dx > 0 ? 'right' : 'left'; p.moving = true; p.walkT += dt;
}
// 落地接触影（全关统一）
export function groundShadow(x, cx, gy, rx, ry = 7, a = 0.26) {
  x.fillStyle = `rgba(0,0,0,${a})`;
  x.beginPath(); x.ellipse(cx, gy + 4, rx, ry, 0, 0, 7); x.fill();
}
// 侧视矢量石拱（与 ch1 门拱同族；纯矢量、无章节几何）
export function drawArchSide(x, cx, baseY, { w = 120, h = 230, opening = 76, mouth = '#141824', rune = null, runeSize = 26, runeColor = 'rgba(30,32,44,.85)', runeGlow = 0 } = {}) {
  const hw = w / 2, top = baseY - h, ow = opening / 2, oh = h - 40;
  x.save();
  x.fillStyle = shade('#7b7669', 0.02);
  x.beginPath();
  x.moveTo(cx - hw, baseY); x.lineTo(cx - hw, top + 30);
  x.quadraticCurveTo(cx, top - 8, cx + hw, top + 30);
  x.lineTo(cx + hw, baseY); x.closePath(); x.fill();
  x.lineWidth = 5; x.strokeStyle = PAL.ink; x.stroke();
  x.fillStyle = mouth;
  x.beginPath();
  x.moveTo(cx - ow, baseY); x.lineTo(cx - ow, top + 44);
  x.quadraticCurveTo(cx, top + 16, cx + ow, top + 44);
  x.lineTo(cx + ow, baseY); x.closePath(); x.fill();
  x.fillStyle = shade('#7b7669', 0.12);                       // 拱心石
  x.fillRect(cx - 10, top + 18, 20, 20); x.strokeRect(cx - 10, top + 18, 20, 20);
  x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(cx + hw - 16, top + 30, 16, baseY - top - 30);  // 右柱沉影
  if (rune) {
    if (runeGlow > 0) {
      const g = x.createRadialGradient(cx, top + 6, 4, cx, top + 6, 44);
      g.addColorStop(0, `rgba(84,224,200,${0.35 * runeGlow})`); g.addColorStop(1, 'rgba(84,224,200,0)');
      x.fillStyle = g; x.beginPath(); x.arc(cx, top + 6, 44, 0, 7); x.fill();
    }
    x.fillStyle = runeColor; x.font = `${runeSize}px serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(rune, cx, top + 6);
  }
  x.restore();
}

