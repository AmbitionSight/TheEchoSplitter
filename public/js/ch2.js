// —— 析声者 · 第二间房：jump（dʒ·ʌ·m·p；p 为第一间房旧识）——
import { createInventory } from './hotbar.js';
import { pickupStone, bankHeld, holdItem, craftWord,
         chapterOnE, syncHeld, seedBegin, dropExtra, dropBackExtra, stepWorldStones } from './chapter.js';

// ================= 纯事件机（Node 可测，行为与重构前一致；公共段见 chapter.js） =================
export function createGame(content, profile) {
  return {
    content, beat: 'start',
    inv: createInventory(),
    book: new Set(), stonesPicked: 0,
    hand: null,
    attempted: false,
    jumpUnlocked: profile.abilities.includes('jump'),
    crossed: false, exited: false, fell: false,
    heard: new Set(),                                  // 听声点听过的音（声音层；与拼词层 everPicked 分开）
    teaseClock: 0
  };
}

export function startGame(g) {
  return [{ t: 'hint', key: 'start' }, { t: 'beat', beat: 'start' }];
}

export function gameEvent(g, ev, arg = null) {
  const c = g.content;
  switch (ev) {
    case 'CHASM': {
      const first = !g.attempted;
      g.attempted = true;
      const out = [
        { t: 'shrug' },
        { t: 'bubble' },
        { t: 'speak', who: 'child', text: c.flows.jump.puzzled[0] },
        { t: 'speak', who: 'door', text: c.flows.jump.listen[0], slow: true }
      ];
      if (first) out.push({ t: 'drop', word: 'jump' }, { t: 'hint', key: 'attempt' });
      return out;
    }
    case 'PICKUP':
      return pickupStone(g, arg, { onFirst: [{ t: 'hint', key: 'carrying' }] });
    case 'BANK':
      return bankHeld(g);
    case 'HOLD_ITEM':
      return holdItem(g, arg);
    case 'CRAFT':
      return craftWord(g, arg, [{ t: 'hint', key: 'give' }]);
    case 'USE': {
      const { word, target } = arg;
      const def = c.words[word]?.use;
      if (!def || target !== def.target) return [{ t: 'mutter' }];
      if (g.jumpUnlocked) return [{ t: 'effect', name: 'jumpUnlock', full: false }];
      g.jumpUnlocked = true;
      return [{ t: 'effect', name: 'jumpUnlock', full: true }];
    }
    case 'CROSS':
      if (g.crossed) return [];
      g.crossed = true;
      return [{ t: 'hint', key: 'exit' }, { t: 'beat', beat: 'crossed' }];
    case 'FELL':
      return [{ t: 'fell' }, { t: 'hint', key: 'fell' }];
    case 'EXIT': {
      if (g.exited) return [];
      g.exited = true;
      g.beat = 'summary';
      return [{ t: 'summary' }];
    }
    case 'LISTEN': {                                          // 听声点：走近按 E 触发（纯听觉，不进库存）
      const spot = (c.listening || []).find(s => s.id === arg);
      if (!spot) return [];
      const v = (g.jumpUnlocked && spot.after) ? spot.after : spot;   // 解锁跳跃（能过坑）后回声变化
      return [{ t: 'sfx', name: 'glowTick' }, { t: 'echo', ipas: v.echo, say: v.say }];
    }
    case 'TICK': {
      g.teaseClock += arg;
      if (g.teaseClock < 45) return [];
      g.teaseClock = 0;
      if (!g.attempted) return [{ t: 'hint', key: 'start' }];
      if (!g.book.has('jump')) return [{ t: 'hint', key: 'carrying' }];
      if (!g.jumpUnlocked) return [{ t: 'hint', key: 'give' }];
      if (!g.crossed) return [{ t: 'hint', key: 'unlocked' }];
      return [{ t: 'hint', key: 'exit' }];
    }
    default:
      return [];
  }
}

export function jumpDebug(g, beat) {
  switch (beat) {
    case 'drop': return gameEvent(g, 'CHASM');
    case 'crafted': {
      let out = jumpDebug(g, 'drop');
      for (const [ipa] of g.content.words.jump.phonemes) {
        out = out.concat(gameEvent(g, 'PICKUP', ipa), gameEvent(g, 'BANK'));
      }
      return out.concat(gameEvent(g, 'CRAFT', 'jump'));
    }
    case 'unlocked': return jumpDebug(g, 'crafted').concat(gameEvent(g, 'USE', { word: 'jump', target: 'player' }));
    default: return [];
  }
}

// ================= 浏览器 kit（壳 + 横版共用件） =================
import { mount } from './shell.js';
import { SIDE, moveSide, sideJump,
         drawSideStone, drawTorchSide, drawBenchSide, drawEHint, vignette, drawListenSpots,
         drawArchSide, groundShadow } from './sideview.js';
import { blit } from './sprites.js';
import { PAL } from './art.js';
import { createActors, updateActors, drawPlayer } from './actors.js';
import { rng, masonryPlan, slabPlan } from './ch1/planners.js';
import { shade, paintMasonry, paintSlabs, BAYER4, pixelGradientV, pixelGlow } from './masonry.js';

export const kit = {
  chapter: 2, W: SIDE.W, H: SIDE.H, titleRune: 'ᛚ',

  createGame, startGame, gameEvent, debug: jumpDebug,

  // 走到走廊尽头：无缝交接进入崖壁（第二间房后半，同页、无刷新，跳过其标题页）——壳读 kit.next
  next: { chapter: 2, page: 'chapter2b.html', load: () => import('./ch2b.js').then(m => m.kit) },

  voices: v => ({
    child: { voice: v.child, pitch: 1.25, rate: 1, rateSlow: 0.8 },
    door: { voice: v.door, pitch: 0.7, rate: 0.8, rateSlow: 0.6 }
  }),

  makeWorld({ content, profile, game }) {
    const geo = content.geometry;
    const actors = createActors();
    const player = actors.player;
    player.x = geo.spawnX; player.y = geo.groundY; player.dir = 'right';
    player.vy = 0; player.airborne = false; player.squash = 0;
    const w = {
      actors, player, geo,
      stones: [],
      view: { t: 0, stars: [], puffs: [], bubbleT: 0, mist: [] },
      cfg: {
        gap: { L: geo.chasmL, R: geo.chasmR },
        canJump: game.jumpUnlocked,
        onLand: x => { if (x > geo.chasmR) w.run(gameEvent(game, 'CROSS')); },
        onFell: () => w.run(gameEvent(game, 'FELL'))
      }
    };
    for (let i = 0; i < 14; i++) {
      w.view.mist.push({ o: Math.random(), ph: Math.random() * 6.28, v: 6 + Math.random() * 10 });
    }
    return w;
  },

  onBegin(w) { seedBegin(w); },                   // 开局记忆石：只带本章需要的旧音素（p）

  onSpace(w) {
    if (w.game.jumpUnlocked) { sideJump(w); w.sfx.click(); }
    else if (!w.player.airborne && Math.abs(w.player.x - w.geo.chasmL) < 150) {
      w.run(gameEvent(w.game, 'CHASM'));
    }
  },

  tick(w, dt) {
    const { view: v, geo } = w;
    v.t += dt;
    v.bubbleT = Math.max(0, v.bubbleT - dt);
    w.player.squash = Math.max(0, w.player.squash - dt * 2);
    w.cfg.canJump = w.game.jumpUnlocked;
    updateActors(w.actors, dt);
    moveSide(w, dt);
    if (w.player.moving && (w.keys.has('l') || w.keys.has('r'))) w.player.walkT += dt;  // 行走帧推进（仅水平移动）
    // 走到走廊尽头：不再有门，直接进入下一关
    if (!w.game.exited && w.game.crossed && w.player.x >= geo.exitX - 10) w.run(gameEvent(w.game, 'EXIT'));
    // 保险：石头绝不落在裂隙里
    stepWorldStones(w, dt, () => geo.groundY,
      x => (x >= geo.chasmL && x <= geo.chasmR) ? geo.chasmL - 30 - Math.random() * 40 : null);
    for (const m of v.mist) m.ph += dt * m.v * 0.1;
    v.stars = v.stars.filter(st => (st.a -= dt * 1.2) > 0);
    v.puffs = v.puffs.filter(p => { p.r += dt * 40; p.a -= dt * 2; return p.a > 0; });
    // 环境听声点（火把等）：走近自动响，不用按 E
    for (const spot of (w.content.listening || [])) {
      if (!spot.auto) continue;
      const near = Math.abs(w.player.x - spot.x) < spot.r;
      const st = (v.listen ||= {})[spot.id] ||= { near: false };
      if (near && !st.near) w.run(gameEvent(w.game, 'LISTEN', spot.id));
      st.near = near;
    }
  },

  findE(w) {
    const { player, geo, stones } = w;
    let best = null, bd = 1e9;
    const consider = (d, t, r) => { if (d < bd && d <= r) { bd = d; best = t; } };
    for (const s of stones) if (s.state === 'idle') {
      consider(Math.hypot(player.x - s.x, geo.groundY - s.y), { kind: 'stone', ipa: s.ipa, x: s.x, y: s.y, stone: s }, 56);
    }
    consider(Math.abs(player.x - geo.benchX), { kind: 'obj', id: 'bench', x: geo.benchX, y: geo.groundY }, 80);
    for (const spot of (w.content.listening || [])) {           // 听声点：实体物件，走近按 E（auto 的自动响，不占 E）
      if (spot.auto) continue;
      consider(Math.abs(player.x - spot.x), { kind: 'obj', id: spot.id, x: spot.x, y: spot.y }, spot.r);
    }
    if (w.game.hand?.kind === 'item') consider(0, { kind: 'obj', id: 'self', x: player.x, y: player.y }, 0);
    return best;
  },

  onE: chapterOnE(gameEvent, (w, t) => {
    if (w.content.listening?.some(s => s.id === t.id)) w.run(gameEvent(w.game, 'LISTEN', t.id));
    else if (t.id === 'self' && w.game.hand?.kind === 'item') w.run(gameEvent(w.game, 'USE', { word: w.game.hand.word, target: 'player' }));
    else w.sfx.mutter();
  }),

  syncHeld,

  runExtras: {
    drop: dropExtra(w => w.geo.chasmL),
    dropBack: dropBackExtra(),
    shrug(w) { w.player.squash = 0.9; },
    bubble(w) { w.view.bubbleT = 2.6; },
    fell(w) {
      w.sfx.mutter();
      w.view.puffs.push({ x: w.player.x, y: w.geo.groundY, r: 8, a: 1 });
      w.player.x = w.geo.chasmL - 90; w.player.y = w.geo.groundY - 160;
      w.player.vy = 0; w.player.airborne = false;
    },
    effect(w, ins) {
      if (ins.name !== 'jumpUnlock') return;
      if (ins.full) {
        w.player.vy = -740; w.player.airborne = true;                     // 示范跳
        for (let i = 0; i < 10; i++) {
          w.view.stars.push({ x: w.player.x + (Math.random() - 0.5) * 60, y: w.player.y - 60 - Math.random() * 60, a: 1, r: 3 + Math.random() * 3 });
        }
        w.ui.setHint('unlocked');
      } else w.sfx.glowTick();
    }
  },

  summaryMerge(game) {
    return { everPicked: [...game.inv.everPicked], heard: [...game.heard], words: [...game.book], abilities: ['jump'], chapter: 2 };
  },

  draw(w, x, eTarget) {
    const { view: v, geo, game } = w;
    x.clearRect(0, 0, SIDE.W, SIDE.H);
    if (!w.bg) w.bg = makeBg(w);                                            // 墙/地/陈设一次性预渲染
    x.drawImage(w.bg, 0, 0);
    // 深谷、出口石拱（ᚱ 呼吸 + 金尘为 draw() 动态层）与断崖已烘进背景（makeBg，像素化）
    // 断口两侧：苔藓巨石断崖
    drawCliffCluster(x, geo.chasmL, +1, geo.groundY, 71);
    drawCliffCluster(x, geo.chasmR, -1, geo.groundY, 72);
    x.fillStyle = 'rgba(90,100,120,.14)';
    for (const m of v.mist) {
      const span = geo.chasmR - geo.chasmL;
      x.beginPath();
      x.ellipse(geo.chasmL + ((m.o * span + Math.sin(m.ph) * 20 + span) % span), geo.groundY + 26 + Math.sin(m.ph * 1.3) * 8, 34, 10, 0, 0, 7);
      x.fill();
    }
    drawTorchSide(x, 90, 240, v.t);                                         // 火把挪到墙面 y=240（离开岩脊带）
    drawTorchSide(x, geo.chasmR + 120, 240, v.t);
    drawBenchSide(x, w.atlases, geo.benchX, geo.groundY, game.hand?.kind === 'stone', v.craftSlots);
    x.save();
    if (w.player.airborne) { x.translate(w.player.x, w.player.y); x.scale(1, 0.92); x.translate(-w.player.x, -w.player.y); }
    if (w.player.squash > 0) { const q = 1 - Math.sin(w.player.squash * Math.PI) * 0.08; x.translate(w.player.x, w.player.y); x.scale(1.06, q); x.translate(-w.player.x, -w.player.y); }
    drawPlayer(x, w.player, v.t, w.atlases);
    x.restore();
    for (const s of w.stones) drawSideStone(x, s, v.t);
    drawFX(w, x);
    // 黄昏级色：角色之后统一压暗（与第一关同法，全场同吃一级大气）
    x.fillStyle = 'rgba(16,18,36,.30)';
    x.fillRect(0, 0, SIDE.W, SIDE.H);
    drawListenSpots(x, w);
    drawEHint(x, eTarget, v.t);
    vignette(x);
  }
};

// —— 裂口断崖：大块苔藓巨石参差咬合（顶面受光、底面没入深渊）+ 路面裂缝 + 碎石 ——
// dir=+1：左路肩（石块伸向裂口右方）；dir=-1：右路肩（伸向左方）
// §8：巨石用独立岩色 #5a5f6b 族（不再与砌墙同色）、块格放大到 26–34px；最上再叠一块压住直切谷缘
function drawCliffCluster(x, ex, dir, gy, seed) {
  const r = rng(seed);
  x.fillStyle = 'rgba(0,0,0,.32)';                         // 巨石压在路缘的接触阴影
  x.beginPath(); x.ellipse(ex + dir * 6, gy + 7, 34, 6, 0, 0, 7); x.fill();
  const rocks = [                                          // 四块巨石自下而上咬合路缘（先画底下层）
    { ox: -10, oy: 86, w: 50, h: 52, moss: 0    },
    { ox: -14, oy: 40, w: 66, h: 60, moss: 0.5  },
    { ox: -20, oy: -12, w: 84, h: 72, moss: 1   },
    { ox: -8, oy: -92, w: 96, h: 88, moss: 1    },         // 再长高 ~80px：压在谷缘上（避开石桥残墩）
  ];
  for (const rk of rocks) {
    const cx = ex + dir * (rk.ox + rk.w / 2);
    const cy = gy + rk.oy + rk.h / 2;
    const rx = rk.w / 2, ry = rk.h / 2;
    const n = 10, pts = [];
    for (let i = 0; i < n; i++) {                          // 墩实圆润的巨石轮廓
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const j = 0.8 + r() * 0.34;
      pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]);
    }
    x.save();
    x.beginPath();
    x.moveTo(pts[0][0], pts[0][1]);
    for (const [px, py] of pts.slice(1)) x.lineTo(px, py);
    x.closePath();
    x.save();
    x.clip();
    // 石块本体：独立岩色 #5a5f6b 族块状纹理（错缝凿石，看得出是一块块石头，不再是一团纯色）
    const bx0 = cx - rx - 8, by0 = cy - ry - 8, bw = rk.w + 16, bh = rk.h + 16;
    x.fillStyle = '#22252b';                                  // 灰浆底（冷灰）
    x.fillRect(bx0, by0, bw, bh);
    const cell = 26 + (seed % 9);                             // 块格 26–34px（§8）
    for (let yy = by0, row = 0; yy < by0 + bh; yy += cell, row++) {
      const off = (row % 2) ? cell / 2 : 0;                   // 错缝
      for (let xx = bx0 - off; xx < bx0 + bw; xx += cell) {
        const t = 0.9 + r() * 0.2, inset = 2;
        x.fillStyle = shade('#5a5f6b', t - 1);
        x.fillRect(xx + inset, yy + inset, cell - inset * 2, cell - inset * 2);
        x.fillStyle = shade('#5a5f6b', t - 1 + 0.18);         // 上/左受光
        x.fillRect(xx + inset, yy + inset, cell - inset * 2, 1.5);
        x.fillRect(xx + inset, yy + inset, 1.5, cell - inset * 2);
        x.fillStyle = shade('#5a5f6b', t - 1 - 0.22);         // 下缘沉影
        x.fillRect(xx + inset, yy + cell - inset - 1.5, cell - inset * 2, 1.5);
      }
    }
    if (rk.moss > 0) {                                        // 顶面苔藓盖头（去饱和绿，与砌石苔藓同族）
      x.globalAlpha = 0.55 * rk.moss;
      x.fillStyle = '#446355';
      x.fillRect(cx - rx - 8, cy - ry - 8, rk.w + 16, rk.h * 0.5 + 8);
      x.globalAlpha = 1;
    }
    const sh = x.createLinearGradient(0, cy - ry - 8, 0, cy + ry + 8);   // 顶受光、底没入深渊
    sh.addColorStop(0, 'rgba(255,240,214,.22)');
    sh.addColorStop(0.42, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(4,5,9,.74)');
    x.fillStyle = sh;
    x.fillRect(cx - rx - 8, cy - ry - 8, rk.w + 16, rk.h + 16);
    x.restore();
    x.strokeStyle = 'rgba(10,12,18,.9)'; x.lineWidth = 2.5;              // 巨石描边
    x.stroke();
    x.restore();
  }
  x.strokeStyle = 'rgba(20,24,34,.5)'; x.lineWidth = 1.6;   // 路面裂缝（向路里延伸）
  for (let c = 0; c < 2; c++) {
    let cx = ex - dir * (10 + r() * 20), cy = gy + 3 + r() * 5;
    x.beginPath(); x.moveTo(cx, cy);
    for (let i = 0; i < 3; i++) { cx -= dir * (10 + r() * 14); cy += (r() - 0.5) * 7; x.lineTo(cx, cy); }
    x.stroke();
  }
  x.fillStyle = 'rgba(186,190,200,.85)';                    // 散落碎石
  for (let i = 0; i < 5; i++) {
    x.beginPath();
    x.ellipse(ex - dir * (8 + r() * 48), gy + 4 + r() * 12, 2.2 + r() * 2.6, 1.6 + r() * 1.5, 0, 0, 7);
    x.fill();
  }
  x.fillStyle = 'rgba(210,214,224,.9)';                     // 石缝碎屑
  for (let i = 0; i < 3; i++) {
    x.beginPath();
    x.ellipse(ex - dir * (4 + r() * 12), gy + 2 + r() * 5, 1.6 + r() * 1.6, 1.2 + r(), 0, 0, 7);
    x.fill();
  }
}

// ================= 第二关背景：峡谷（像素语言） =================
// 远处崖层剪影：锯齿顶缘 + 顶缘受光（越远越浅），给峡谷纵深
// §8：只画到近景墙顶（bottomY=ridge）——不再画满画布高，最暗层不再盖住前层
function drawFarCliffs(x, topY, color, rim, seed, bottomY = SIDE.H) {
  const r = rng(seed);
  const pts = [];
  for (let px = 0; px <= SIDE.W; px += 22) pts.push([px, topY + (r() * 46 - 12)]);
  x.fillStyle = color;
  x.beginPath(); x.moveTo(0, bottomY); x.lineTo(pts[0][0], pts[0][1]);
  for (const [px, y] of pts.slice(1)) x.lineTo(px, y);
  x.lineTo(SIDE.W, bottomY); x.closePath(); x.fill();
  x.strokeStyle = rim; x.lineWidth = 2; x.beginPath();        // 顶缘受光（远山轮廓）
  x.moveTo(pts[0][0], pts[0][1]); for (const [px, y] of pts.slice(1)) x.lineTo(px, y);
  x.stroke();
}

// —— 缝内对壁：三层后退岩壁（值阶 #2a3546 → #1d2634 → #141a26）——
// 每层顶缘冷色轮廓光 + 层内岩层横纹（α≥.10）+ 层底霾带；越深越暗，读出「对面有崖」
function drawFarWallLayers(x, gx, gw, topY, botY, seed) {
  const r = rng(seed);
  const layers = [
    { c: '#2a3546', inset: 4,  rim: 'rgba(178,196,224,.22)', haze: 'rgba(150,168,192,.15)' },
    { c: '#1d2634', inset: 18, rim: 'rgba(160,180,210,.16)', haze: 'rgba(140,158,184,.13)' },
    { c: '#141a26', inset: 36, rim: 'rgba(148,168,200,.12)', haze: 'rgba(120,146,180,.22)' },   // 底层霾带更强：与渊底渐变接得住
  ];
  const step = (botY - topY) / layers.length;
  for (let i = 0; i < layers.length; i++) {
    const L = layers[i], y0 = topY + i * step;
    const x0 = gx + L.inset, x1 = gx + gw - L.inset;
    const pts = [];
    for (let px = x0; px < x1; px += 20) pts.push([px, y0 + 4 + r() * 18]);   // 顶缘岩肩微起伏
    pts.push([x1, y0 + 4 + r() * 18]);
    x.fillStyle = L.c;
    x.beginPath(); x.moveTo(x0, botY); x.lineTo(pts[0][0], pts[0][1]);
    for (const [px, py] of pts.slice(1)) x.lineTo(px, py);
    x.lineTo(x1, botY); x.closePath(); x.fill();
    for (let k = 0; k < 3; k++) {                                             // 岩层横纹（层内可见带）
      const ly = y0 + 26 + k * ((step - 36) / 3);
      if (ly > y0 + step - 14) break;
      x.fillStyle = `rgba(150,164,186,${0.10 + r() * 0.05})`;
      x.fillRect(x0 + 6, ly, x1 - x0 - 12, 3);
    }
    x.strokeStyle = L.rim; x.lineWidth = 2;                                   // 顶缘冷轮廓光
    x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
    for (const [px, py] of pts.slice(1)) x.lineTo(px, py);
    x.stroke();
    const hz = x.createLinearGradient(0, y0 + step - 30, 0, y0 + step);       // 层底霾带
    hz.addColorStop(0, 'rgba(90,108,138,0)'); hz.addColorStop(1, L.haze);
    x.fillStyle = hz; x.fillRect(x0, y0 + step - 30, x1 - x0, 30);
  }
}

// 近景崖壁顶缘：崩裂岩脊（压住砌石的平顶，让它读起来是崖顶不是墙头）
function drawRockRidge(x, y, W, seed) {
  const r = rng(seed);
  x.fillStyle = '#2f3139';
  x.beginPath(); x.moveTo(0, y + 46);
  for (let px = 0; px <= W; px += 18) x.lineTo(px, y + (r() * 32 - 6));
  x.lineTo(W, y + 46); x.closePath(); x.fill();
  x.strokeStyle = 'rgba(10,12,18,.75)'; x.lineWidth = 2; x.stroke();
  x.fillStyle = 'rgba(255,240,214,.07)';                       // 岩脊顶受光
  x.fillRect(0, y + 2, W, 2);
}

// 崖台细节：碎石 + 苔簇（让崖台不空、不塑料）
function drawLedgeDetail(x, geo, seed) {
  const r = rng(seed), gy = geo.groundY;
  for (const [bx, bw] of [[0, geo.chasmL], [geo.chasmR, SIDE.W - geo.chasmR]]) {
    for (let i = 0; i < 8; i++) {                              // 碎石
      const px = bx + 24 + r() * (bw - 48), t = 150 + (r() * 44 | 0);
      x.fillStyle = `rgba(${t},${t},${t + 12},.5)`;
      x.beginPath(); x.ellipse(px, gy - 2 - r() * 4, 2 + r() * 3, 1.4 + r() * 1.8, 0, 0, 7); x.fill();
    }
    for (let i = 0; i < 6; i++) {                              // 苔簇 / 草
      const px = bx + 34 + r() * (bw - 68), h = 6 + r() * 9;
      x.strokeStyle = i % 2 ? '#446355' : '#3a5646'; x.lineWidth = 2; x.lineCap = 'round';
      x.beginPath(); x.moveTo(px, gy - 2); x.lineTo(px + (r() - 0.5) * 7, gy - 2 - h); x.stroke();
    }
  }
}

// ================= 2a 陈设（静态件，全部烘进 makeBg；动态层见 draw()） =================

// 行囊与铺盖（底 195）：铺盖卷 + 皮袋 + 斜倚木杖——旅人在这里歇过脚
function drawBedroll(x, bx, gy) {
  x.strokeStyle = PAL.ink; x.lineWidth = 7; x.lineCap = 'round';       // 木杖（衬在铺盖后）
  x.beginPath(); x.moveTo(bx - 30, gy - 2); x.lineTo(bx - 44, gy - 60); x.stroke();
  x.strokeStyle = PAL.wood2; x.lineWidth = 4;
  x.beginPath(); x.moveTo(bx - 30, gy - 2); x.lineTo(bx - 44, gy - 60); x.stroke();
  x.save(); x.translate(bx - 6, gy - 11); x.rotate(-0.03);             // 铺盖卷（横放圆枕）
  x.fillStyle = '#7e6a4f';
  x.beginPath();
  if (x.roundRect) x.roundRect(-30, -9, 60, 18, 9); else x.rect(-30, -9, 60, 18);
  x.fill();
  x.strokeStyle = PAL.ink; x.lineWidth = 2.5; x.stroke();
  x.strokeStyle = 'rgba(40,32,22,.55)'; x.lineWidth = 2;               // 捆绳两道
  x.beginPath(); x.moveTo(-13, -9); x.lineTo(-13, 9); x.moveTo(13, -9); x.lineTo(13, 9); x.stroke();
  x.restore();
  x.save(); x.translate(bx + 24, gy - 15); x.rotate(0.14);             // 皮袋
  x.fillStyle = '#6b4a2e';
  x.beginPath(); x.ellipse(0, 0, 12, 14, 0, 0, 7); x.fill();
  x.strokeStyle = PAL.ink; x.lineWidth = 2.5; x.stroke();
  x.fillStyle = '#553a24'; x.fillRect(-6, -16, 12, 6);                 // 束口
  x.strokeStyle = PAL.ink; x.lineWidth = 2; x.strokeRect(-6, -16, 12, 6);
  x.restore();
}

// 货堆（底 256/314）：大木箱 + 叠小木箱 + 陶罐组（mi 图集 1:1 整倍）
function drawCrates(x, imgs, gy) {
  groundShadow(x, 256, gy, 30, 7, 0.28);
  groundShadow(x, 314, gy, 32, 7, 0.28);
  blit(x, imgs, 'crate_big', 230, gy - 46);
  blit(x, imgs, 'crate_sm', 240, gy - 46 - 45);                        // 小箱叠在大箱上
  blit(x, imgs, 'jars2', 284, gy - 34);
}

// 石桥残墩（签名地标，墩 cx=658 底 600）：砌石墩 + 路边断板 + 向缝下续 4 块渐隐断板
function drawBridgePier(x, cx, gy) {
  groundShadow(x, cx, gy, 38, 8, 0.30);
  const r = rng(83);
  const base = '#6f6a60';
  const blocks = [                                                     // 下宽上窄的墩身（错缝砌块）
    { dy: 0,   w: 58, h: 26 },
    { dy: -26, w: 52, h: 24 },
    { dy: -50, w: 44, h: 24 },
  ];
  for (const b of blocks) {
    const bx = cx - b.w / 2, by = gy + b.dy - b.h;
    x.fillStyle = shade(base, (r() - 0.5) * 0.18);
    x.fillRect(bx, by, b.w, b.h);
    x.fillStyle = shade(base, 0.10);                                   // 上/左受光
    x.fillRect(bx, by, b.w, 2); x.fillRect(bx, by, 2, b.h);
    x.fillStyle = shade(base, -0.26);                                  // 下/右沉影
    x.fillRect(bx, by + b.h - 2, b.w, 2); x.fillRect(bx + b.w - 2, by, 2, b.h);
  }
  const topY = gy - 74, jags = [];                                     // 桥面断掉后的参差石口
  for (let i = 0; i <= 4; i++) jags.push([cx - 22 + i * 11, topY - 4 - r() * 12]);
  x.fillStyle = shade(base, -0.06);
  x.beginPath(); x.moveTo(cx - 22, topY + 2);
  for (const [px, py] of jags) x.lineTo(px, py);
  x.lineTo(cx + 22, topY + 2); x.closePath(); x.fill();
  x.strokeStyle = 'rgba(10,12,18,.85)'; x.lineWidth = 2.5;             // 墩身 + 破口描边
  x.beginPath(); x.moveTo(cx - 29, gy); x.lineTo(cx - 29, gy - 50); x.lineTo(cx - 26, gy - 50);
  x.lineTo(cx - 26, topY + 2); x.lineTo(cx - 22, topY + 2);
  for (const [px, py] of jags) x.lineTo(px, py);
  x.lineTo(cx + 22, topY + 2); x.lineTo(cx + 26, topY + 2);
  x.lineTo(cx + 26, gy - 50); x.lineTo(cx + 29, gy - 50); x.lineTo(cx + 29, gy);
  x.stroke();
  x.save(); x.translate(614, gy - 4); x.rotate(-0.05);                 // 路边断板（旧桥面残片）
  x.fillStyle = '#6e4526'; x.fillRect(-24, -5, 48, 10);
  x.fillStyle = '#8a5a33'; x.fillRect(-24, -5, 48, 3);
  x.strokeStyle = PAL.ink; x.lineWidth = 2; x.strokeRect(-24, -5, 48, 10);
  x.restore();
  const frags = [[16, 10, 44, 9], [48, 38, 36, 8], [78, 74, 28, 7], [104, 116, 20, 6]];
  for (let i = 0; i < frags.length; i++) {                             // 向缝下续 4 块渐隐断板
    const [dx, dy, fw, fh] = frags[i];
    x.save();
    x.globalAlpha = 0.72 - i * 0.17;
    x.translate(cx + 10 + dx, gy + 4 + dy);
    x.rotate(0.24 + i * 0.16);
    x.fillStyle = i % 2 ? '#5d3b20' : '#6e4526';
    x.fillRect(-fw / 2, -fh / 2, fw, fh);
    x.strokeStyle = PAL.ink; x.lineWidth = 1.5; x.strokeRect(-fw / 2, -fh / 2, fw, fh);
    x.restore();
  }
  x.globalAlpha = 1;
}

// 水洼（听声点 shine 的实体，底 968/602）：矢量水面 + 暖竖反光（2 闪粒在 draw() 动态）
function drawPuddle(x, px, py) {
  groundShadow(x, px, py, 30, 6, 0.26);
  x.fillStyle = '#2b4a5e';
  x.beginPath(); x.ellipse(px, py, 30, 7, 0, 0, 7); x.fill();
  x.strokeStyle = 'rgba(10,12,18,.7)'; x.lineWidth = 2; x.stroke();
  x.fillStyle = 'rgba(255,214,130,.30)';                               // 暖竖反光（对岸/出口的光落在水上）
  x.fillRect(px - 2, py - 5, 3, 9); x.fillRect(px + 7, py - 3, 2, 6);
  x.fillStyle = 'rgba(150,200,220,.18)';                               // 冷天光横纹
  x.fillRect(px - 18, py - 1, 12, 2); x.fillRect(px + 11, py + 1, 9, 1.5);
}

// 风幡（气氛，杆底 1030）：矢量木杆 + 撕口布幡（绕顶摆 ±0.06rad 由 draw() 动态层负责）
function drawWindBanner(x, bx, gy, sway = 0) {
  groundShadow(x, bx, gy, 14, 4, 0.24);
  x.fillStyle = PAL.wood2; x.fillRect(bx - 2, gy - 152, 4, 152);       // 木杆
  x.strokeStyle = PAL.ink; x.lineWidth = 2; x.strokeRect(bx - 2, gy - 152, 4, 152);
  x.save();
  x.translate(bx + 2, gy - 150); x.rotate(sway);                       // 摆动轴 = 杆顶
  x.fillStyle = '#8c4f42';                                             // 撕口布幡（3 段撕口）
  x.beginPath();
  x.moveTo(0, 2); x.lineTo(44, 10); x.lineTo(30, 22);
  x.lineTo(50, 30); x.lineTo(26, 42); x.lineTo(36, 52); x.lineTo(0, 54);
  x.closePath(); x.fill();
  x.strokeStyle = PAL.ink; x.lineWidth = 2; x.stroke();
  x.fillStyle = 'rgba(255,236,200,.16)';                               // 布面受光
  x.beginPath(); x.moveTo(0, 2); x.lineTo(44, 10); x.lineTo(30, 22); x.lineTo(0, 20); x.closePath(); x.fill();
  x.restore();
}

// 火把铁托架（与第一关同款金属件，垫在火把柄下）
function drawTorchBracket(x, tx, ty) {
  x.fillStyle = '#4b4f5a';
  x.beginPath(); x.moveTo(tx - 10, ty); x.lineTo(tx + 10, ty); x.lineTo(tx + 5, ty + 10); x.lineTo(tx - 5, ty + 10); x.closePath(); x.fill();
  x.strokeStyle = PAL.ink; x.lineWidth = 1.5; x.stroke();
}

function makeBg(w) {
  const { geo } = w;
  const c = document.createElement('canvas');
  c.width = SIDE.W; c.height = SIDE.H;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  const gy = geo.groundY, wallH = gy - 16;
  const ridge = 176;                                           // 近景崖壁顶缘：其上露出天与远山（峡谷纵深）
  const segs = [[0, geo.chasmL], [geo.chasmR, SIDE.W - geo.chasmR]];   // 裂缝两侧的两块崖体
  const er = rng(43);                                          // 谷缘错位折线的抖动
  // 黄昏天幕（像素化：色带 + 拜耳抖动）
  pixelGradientV(x, 0, SIDE.W, 0, gy, [[0, '#0c1320'], [0.5, '#182233'], [0.82, '#28313f'], [1, '#39414d']]);
  // 远处崖层剪影（三层，越远越浅、顶缘受光）——只画到近景墙顶 ridge，最暗层不再盖住前层
  drawFarCliffs(x, 58,  '#2b3646', 'rgba(150,168,192,.10)', 11, ridge);
  drawFarCliffs(x, 104, '#212b3a', 'rgba(140,158,184,.09)', 23, ridge);
  drawFarCliffs(x, 150, '#18202d', 'rgba(130,148,176,.08)', 37, ridge);
  // 缝内对壁：三层后退岩壁（值阶 #2a3546 → #1d2634 → #141a26），替换平色天空
  drawFarWallLayers(x, geo.chasmL, geo.chasmR - geo.chasmL, 200, gy, 61);
  // 对面有光：缝口那侧的暖光（像素化光晕）——落在对壁上
  const gx0 = (geo.chasmL + geo.chasmR) / 2;
  pixelGlow(x, gx0, gy - 70, 300, [255, 214, 130], 0.16);
  // 近景崖壁：砌石（自 ridge 起），顶缘压一道崩裂岩脊。
  // 关键：裂缝处整面断开——峡谷贯穿上下，缝里透出天与远山，才读得出"悬崖"。
  const floorH = SIDE.H - gy;
  const slabRows = slabPlan(31, SIDE.W, gy, floorH);
  for (const [bx, bw] of segs) {
    x.save(); x.beginPath(); x.rect(bx, 0, bw, wallH); x.clip();
    x.save(); x.translate(0, ridge);
    paintMasonry(x, masonryPlan(23, SIDE.W, wallH - ridge), SIDE.W, wallH - ridge);
    x.restore();
    drawRockRidge(x, ridge, SIDE.W, 31);
    x.restore();
    // 断崖立面：缝两侧的切面压暗 + 错位谷缘折线（让它像被劈开的岩体）
    const ex = bx === 0 ? geo.chasmL : geo.chasmR;
    const inLeft = bx === 0;                                   // 左块：切面在其右缘
    const gapDir = inLeft ? 1 : -1;                            // 谷缘朝向裂口的方向
    const eg = x.createLinearGradient(ex, 0, ex + (inLeft ? -1 : 1) * 34, 0);
    eg.addColorStop(0, 'rgba(0,0,0,.5)'); eg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = eg; x.fillRect(inLeft ? ex - 34 : ex, ridge, 34, wallH - ridge);
    // §8 谷缘：2–3 段错位折线（起伏 ≥6px），不再是一条 2px 直边；外加受光边
    const ep = [];
    for (let i = 0; i <= 3; i++) {
      const yy = ridge + (wallH - ridge) * i / 3;
      const jit = (i === 0 || i === 3) ? 0 : (6 + er() * 8) * (er() < 0.5 ? -1 : 1);
      ep.push([ex + jit, yy]);
    }
    x.strokeStyle = 'rgba(8,10,14,.85)'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(ep[0][0], ep[0][1]);
    for (const [px, py] of ep.slice(1)) x.lineTo(px, py);
    x.stroke();
    x.strokeStyle = 'rgba(255,226,170,.16)'; x.lineWidth = 1.4;  // 受光边：缝口暖光擦过切缘
    x.beginPath(); x.moveTo(ep[0][0] + gapDir * 2.5, ep[0][1]);
    for (const [px, py] of ep.slice(1)) x.lineTo(px + gapDir * 2.5, py);
    x.stroke();
    // 石质基座带（墙脚踢脚线，随崖体断开）
    x.fillStyle = '#5d5a52'; x.fillRect(bx, wallH, bw, 16);
    x.fillStyle = '#7b7669'; x.fillRect(bx, wallH, bw, 4);
    x.fillStyle = '#3a3833'; x.fillRect(bx, wallH + 12, bw, 4);
    // 地：大块凿石板（seed 31），随崖体断开
    x.save(); x.beginPath(); x.rect(bx, gy, bw, floorH); x.clip();
    paintSlabs(x, slabRows, SIDE.W, gy, floorH);
    x.restore();
  }
  // 深谷：渊底向 #070a0f 收（现渐变保留；岩层横纹由缝内三层对壁承担）
  pixelGradientV(x, geo.chasmL, geo.chasmR, gy, SIDE.H, [[0, '#33404f'], [0.42, '#1d2634'], [1, '#070a0f']]);
  // 火把暖光落在崖壁上（像素化光晕）——光与墙发生关系，是"精致"的关键
  pixelGlow(x, 90, 240, 180, [255, 198, 112], 0.34);
  pixelGlow(x, geo.chasmR + 120, 240, 180, [255, 198, 112], 0.34);
  // 崖台细节：碎石 + 苔簇
  drawLedgeDetail(x, geo, 53);
  // —— 陈设（静态件，§5.1）：拱门 / 火把托架 / 行囊铺盖 / 货堆 / 石桥残墩 / 水洼 / 风幡 ——
  drawArchSide(x, 60, gy, { rune: 'ᚵ' });                      // 入口拱（ᚵ 阴刻，不发光）
  groundShadow(x, 60, gy, 62, 9, 0.30);
  drawArchSide(x, geo.exitX, gy, { rune: 'ᚱ', runeGlow: 1, runeColor: 'rgba(140,240,220,.6)' });   // 出口拱（呼吸符文与 12 金尘为 draw() 动态层，锚点 (exitX, gy)）
  groundShadow(x, geo.exitX, gy, 62, 9, 0.30);
  drawTorchBracket(x, 90, 266); drawTorchBracket(x, geo.chasmR + 120, 266);   // 火把铁托架
  groundShadow(x, 195, gy, 36, 8, 0.28);                       // 行囊与铺盖
  drawBedroll(x, 195, gy);
  drawCrates(x, w.atlases, gy);                                // 货堆：木箱×2 + 陶罐组
  drawBridgePier(x, 658, gy);                                  // 石桥残墩（签名地标）
  drawPuddle(x, 968, 602);                                     // 水洼（听声点 shine 实体）
  drawWindBanner(x, 1030, gy);                                 // 风幡
  x.fillStyle = 'rgba(255,236,200,.09)';                       // 地面顶缘亮线（裂缝两侧）
  x.fillRect(0, gy, geo.chasmL, 2); x.fillRect(geo.chasmR, gy, SIDE.W - geo.chasmR, 2);
  const fsh = x.createLinearGradient(0, gy - 8, 0, gy + 36);   // 墙脚落地阴影
  fsh.addColorStop(0, 'rgba(0,0,0,.30)'); fsh.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = fsh; x.fillRect(0, gy - 8, SIDE.W, 44);
  const gsh = x.createLinearGradient(0, gy, 0, gy + 130);      // 地面下部压暗
  gsh.addColorStop(0, 'rgba(0,0,0,0)'); gsh.addColorStop(1, 'rgba(0,0,0,.42)');
  x.fillStyle = gsh;
  x.fillRect(0, gy, geo.chasmL, 130); x.fillRect(geo.chasmR, gy, SIDE.W - geo.chasmR, 130);
  // 黄昏级色不再烘焙进背景：改到 draw() 角色之后统一压暗（与第一关同法）
  return c;
}

function drawFX(w, x) {
  const v = w.view, p = w.player;
  for (const st of v.stars) {
    x.globalAlpha = st.a;
    x.fillStyle = PAL.gold;
    x.beginPath(); x.arc(st.x, st.y - (1 - st.a) * 30, st.r, 0, 7); x.fill();
  }
  for (const pf of v.puffs) {
    x.globalAlpha = pf.a * 0.5;
    x.fillStyle = '#cfc9ba';
    x.beginPath(); x.arc(pf.x, pf.y - 6, pf.r, 0, 7); x.fill();
  }
  x.globalAlpha = 1;
  if (v.bubbleT <= 0) return;
  const a = Math.min(1, v.bubbleT / 0.4);
  const bx = p.x + 8, by = p.y - 108;
  x.save();
  x.globalAlpha = a;
  x.fillStyle = 'rgba(247,244,234,.95)';
  x.beginPath();
  if (x.roundRect) x.roundRect(bx - 44, by - 30, 88, 52, 14); else x.rect(bx - 44, by - 30, 88, 52);
  x.fill();
  x.beginPath(); x.moveTo(bx - 6, by + 22); x.lineTo(bx + 2, by + 36); x.lineTo(bx + 10, by + 22); x.closePath(); x.fill();
  x.lineWidth = 2.5; x.strokeStyle = PAL.ink; x.strokeRect(bx - 44, by - 30, 88, 52);
  const fx = bx - 20, fy = by + 2;
  x.strokeStyle = PAL.ink; x.lineWidth = 2.5;
  x.beginPath(); x.arc(fx, fy - 12, 4, 0, 7); x.stroke();
  x.beginPath(); x.moveTo(fx, fy - 8); x.lineTo(fx, fy + 2); x.stroke();
  x.beginPath(); x.moveTo(fx, fy - 4); x.lineTo(fx - 6, fy - 12); x.stroke();
  x.beginPath(); x.moveTo(fx, fy - 4); x.lineTo(fx + 6, fy - 12); x.stroke();
  x.beginPath(); x.moveTo(fx, fy + 2); x.lineTo(fx - 5, fy + 10); x.stroke();
  x.beginPath(); x.moveTo(fx, fy + 2); x.lineTo(fx + 5, fy + 10); x.stroke();
  x.strokeStyle = '#e5484d'; x.lineWidth = 5; x.lineCap = 'round';        // 红叉（用户指定）
  x.beginPath(); x.moveTo(bx + 8, by - 14); x.lineTo(bx + 34, by + 12); x.stroke();
  x.beginPath(); x.moveTo(bx + 34, by - 14); x.lineTo(bx + 8, by + 12); x.stroke();
  x.restore();
}

mount(kit);
