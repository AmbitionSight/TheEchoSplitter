// —— 横版共用件：移动/跳跃/攀爬物理核心 + 通用渲染（火把/合成台/石头/E 提示/暗角） ——
import { PAL } from './art.js';
import { isVowel, stoneCount } from './hotbar.js';
import { blit, tile } from './sprites.js';

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
  return wordDef.phonemes.map(([ipa]) => ipa)
    .filter(ipa => stoneCount(inv, ipa) === 0)
    .map((ipa, i) => ({ ipa, x: ax - i * 46 }));
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

export function drawBenchSide(x, imgs, bx, gy, hot) {
  x.fillStyle = 'rgba(0,0,0,.25)';
  x.beginPath(); x.ellipse(bx, gy + 6, 70, 9, 0, 0, 7); x.fill();
  blit(x, imgs, 'table', bx - 76, gy - 74);
  blit(x, imgs, 'table', bx, gy - 74);
  for (let i = 0; i < 4; i++) {
    const sx = bx - 33 + i * 22;
    x.fillStyle = 'rgba(20,22,34,.55)';
    x.beginPath(); x.arc(sx, gy - 62, 5, 0, 7); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.28)'; x.lineWidth = 1.2;
    x.beginPath(); x.arc(sx, gy - 62, 5, -2.2, 0.6); x.stroke();
    if (hot) { x.fillStyle = 'rgba(84,224,200,.25)'; x.beginPath(); x.arc(sx, gy - 62, 9, 0, 7); x.fill(); }
  }
}

// 横版背墙：MI 墙面平铺 + 压暗
export function drawWallBack(x, imgs, W, H, dim = 0.30) {
  tile(x, imgs, 'wall_face', 0, 0, W, H);
  x.fillStyle = `rgba(10,12,22,${dim})`;
  x.fillRect(0, 0, W, H);
}

// —— 青苔墙砖墙面（第一/二关同款）：wallClean/moss/halfMoss 随机拼接（同种子同布局） ——
export function drawMossyWall(x, imgs, W, H, seed = 23) {
  const textures = [imgs?.wallClean, imgs?.wallMoss, imgs?.wallHalfMoss].filter(Boolean);
  if (!textures.length) {
    x.fillStyle = PAL.wallA;
    x.fillRect(0, 0, W, H);
    return;
  }
  let s = (seed >>> 0) || 1;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  const tileSize = 96;
  for (let y = 0; y < H; y += tileSize) {
    for (let px = 0; px < W; px += tileSize) {
      const image = textures[Math.floor(r() * textures.length)];
      const wobbleX = (r() - 0.5) * 8, wobbleY = (r() - 0.5) * 8, flip = r() > 0.5;
      const width = Math.min(tileSize + 8, W - px + 8);
      const height = Math.min(tileSize + 8, H - y + 8);
      x.save();
      x.globalAlpha = 0.92;
      x.translate(px + wobbleX + (flip ? width : 0), y + wobbleY);
      x.scale(flip ? -1 : 1, 1);
      x.drawImage(image, 0, 0, image.width, image.height, 0, 0, width, height);
      x.restore();
    }
  }
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

