// —— 横版共用件：移动/跳跃/攀爬物理核心 + 通用渲染（火把/合成台/石头/E 提示/暗角） ——
import { PAL } from './art.js';
import { isVowel } from './hotbar.js';

export const SIDE = { W: 1280, H: 720 };

export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const cl = v => Math.max(0, Math.min(255, Math.round(v)));
  return `rgb(${cl(((n >> 16) & 255) * (1 + f))},${cl(((n >> 8) & 255) * (1 + f))},${cl((n & 255) * (1 + f))})`;
}

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
      if (w.keys.has('u')) { p.y -= 170 * dt; p.walkT += dt; }
      if (w.keys.has('d')) p.y += 130 * dt;
      p.y = Math.max(wall.topY, Math.min(geo.groundY, p.y));
      if (p.y <= wall.topY + 1) { p.climbing = false; cfg.onTopReach?.(); }
    }
  }
  if (!p.climbing) {
    const sp = (cfg.speed ?? 300) * dt;
    if (w.keys.has('l')) { p.x -= sp; p.facing = -1; }
    if (w.keys.has('r')) { p.x += sp; p.facing = 1; }
    p.moving = w.keys.size > 0 && !p.airborne;
    if (wall) {
      const inWallX = p.x > wall.X - 14 && p.x < wall.X + wall.W + 14;
      if (inWallX && p.y > wall.topY + 4) {
        p.x = p.x < wall.X + wall.W / 2 ? wall.X - 14 : wall.X + wall.W + 14;
      }
    }
    if (rope?.ok() && !p.airborne && p.y > wall.topY && Math.abs(p.x - rope.x()) < 34 && w.keys.has('u')) {
      p.climbing = true;
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

export function drawTorchSide(x, tx, ty, t) {
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
  const g = x.createRadialGradient(tx, ty, 4, tx, ty, 110);
  g.addColorStop(0, 'rgba(255,170,80,.22)'); g.addColorStop(1, 'rgba(255,170,80,0)');
  x.fillStyle = g; x.beginPath(); x.arc(tx, ty, 110, 0, 7); x.fill();
}

export function drawBenchSide(x, bx, gy, hot) {
  x.fillStyle = 'rgba(0,0,0,.25)';
  x.beginPath(); x.ellipse(bx, gy + 6, 60, 9, 0, 0, 7); x.fill();
  x.strokeStyle = PAL.ink; x.lineWidth = 4;
  for (const lx of [bx - 40, bx + 40]) { x.beginPath(); x.moveTo(lx - 5, gy - 38); x.lineTo(lx + 3, gy); x.stroke(); }
  x.fillStyle = PAL.wood;
  x.beginPath(); x.roundRect ? x.roundRect(bx - 62, gy - 62, 124, 22, 6) : x.rect(bx - 62, gy - 62, 124, 22);
  x.fill(); x.lineWidth = 4.5; x.stroke();
  x.fillStyle = shade(PAL.stoneD, -0.2);
  x.beginPath(); x.roundRect ? x.roundRect(bx - 48, gy - 58, 96, 14, 6) : x.rect(bx - 48, gy - 58, 96, 14);
  x.fill(); x.lineWidth = 3; x.stroke();
  for (let i = 0; i < 4; i++) {
    const sx = bx - 33 + i * 22;
    x.fillStyle = 'rgba(0,0,0,.4)';
    x.beginPath(); x.arc(sx, gy - 51, 5, 0, 7); x.fill();
    if (hot) { x.fillStyle = 'rgba(84,224,200,.25)'; x.beginPath(); x.arc(sx, gy - 51, 9, 0, 7); x.fill(); }
  }
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

// 背墙（暗砖，两关共用）
export function drawBrickBack(x, W, H, dim = -0.18) {
  for (let ry = 0; ry < H; ry += 56) {
    for (let bx = ((ry / 56) % 2) * 46 - 46; bx < W; bx += 92) {
      x.fillStyle = shade(PAL.wallA, (Math.sin(bx * 12.9 + ry * 7.7) * 0.5) * 0.08 + dim);
      x.fillRect(bx + 1, ry + 1, 90, 54);
    }
  }
}
