// —— 回响之石 · 第二间房：jump（dʒ·ʌ·m·p；p 为第一间房旧识）——
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
         drawSideStone, drawTorchSide, drawBenchSide, drawEHint, vignette, drawMossyWall } from './sideview.js';
import { PAL } from './art.js';
import { tile } from './sprites.js';
import { createActors, updateActors, drawPlayer } from './actors.js';
import { rng } from './scene.js';

const kit = {
  chapter: 2, W: SIDE.W, H: SIDE.H, titleRune: 'ᛚ',

  createGame, startGame, gameEvent, debug: jumpDebug,

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
  },

  findE(w) {
    const { player, geo, stones } = w;
    let best = null, bd = 1e9;
    const consider = (d, t, r) => { if (d < bd && d <= r) { bd = d; best = t; } };
    for (const s of stones) if (s.state === 'idle') {
      consider(Math.hypot(player.x - s.x, geo.groundY - s.y), { kind: 'stone', ipa: s.ipa, x: s.x, y: s.y, stone: s }, 56);
    }
    consider(Math.abs(player.x - geo.benchX), { kind: 'obj', id: 'bench', x: geo.benchX, y: geo.groundY }, 80);
    if (w.game.hand?.kind === 'item') consider(0, { kind: 'obj', id: 'self', x: player.x, y: player.y }, 0);
    return best;
  },

  onE: chapterOnE(gameEvent, (w, t) => {
    if (t.id === 'self' && w.game.hand?.kind === 'item') w.run(gameEvent(w.game, 'USE', { word: w.game.hand.word, target: 'player' }));
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
    return { everPicked: [...game.inv.everPicked], words: [...game.book], abilities: ['jump'], chapter: 2 };
  },

  draw(w, x, eTarget) {
    const { view: v, geo, game } = w;
    x.clearRect(0, 0, SIDE.W, SIDE.H);
    if (!w.bg) w.bg = makeBg(w);                                            // 墙/地一次性预渲染
    x.drawImage(w.bg, 0, 0);
    // 出口微光
    const eg = x.createLinearGradient(geo.exitX - 70, 0, geo.exitX + 70, 0);
    eg.addColorStop(0, 'rgba(255,214,130,0)'); eg.addColorStop(0.5, 'rgba(255,214,130,.10)'); eg.addColorStop(1, 'rgba(255,214,130,0)');
    x.fillStyle = eg; x.fillRect(geo.exitX - 70, 200, 140, 420);
    // 深渊
    const gg = x.createLinearGradient(0, geo.groundY, 0, geo.groundY + 220);
    gg.addColorStop(0, '#05060a'); gg.addColorStop(1, '#000');
    x.fillStyle = gg; x.fillRect(geo.chasmL, geo.groundY, geo.chasmR - geo.chasmL, 220);
    // 断口两侧：苔藓巨石断崖
    drawCliffCluster(x, w.atlases, geo.chasmL, +1, geo.groundY, 71);
    drawCliffCluster(x, w.atlases, geo.chasmR, -1, geo.groundY, 72);
    x.fillStyle = 'rgba(90,100,120,.14)';
    for (const m of v.mist) {
      const span = geo.chasmR - geo.chasmL;
      x.beginPath();
      x.ellipse(geo.chasmL + ((m.o * span + Math.sin(m.ph) * 20 + span) % span), geo.groundY + 26 + Math.sin(m.ph * 1.3) * 8, 34, 10, 0, 0, 7);
      x.fill();
    }
    drawTorchSide(x, 90, 180, v.t);
    drawTorchSide(x, geo.chasmR + 120, 180, v.t);
    drawBenchSide(x, w.atlases, geo.benchX, geo.groundY, game.hand?.kind === 'stone', v.craftSlots);
    x.save();
    if (w.player.airborne) { x.translate(w.player.x, w.player.y); x.scale(1, 0.92); x.translate(-w.player.x, -w.player.y); }
    if (w.player.squash > 0) { const q = 1 - Math.sin(w.player.squash * Math.PI) * 0.08; x.translate(w.player.x, w.player.y); x.scale(1.06, q); x.translate(-w.player.x, -w.player.y); }
    drawPlayer(x, w.player, v.t, w.atlases);
    x.restore();
    for (const s of w.stones) drawSideStone(x, s, v.t);
    drawFX(w, x);
    drawEHint(x, eTarget, v.t);
    vignette(x);
  }
};

// —— 裂口断崖：大块苔藓巨石参差咬合（顶面受光、底面没入深渊）+ 路面裂缝 + 碎石 ——
// dir=+1：左路肩（石块伸向裂口右方）；dir=-1：右路肩（伸向左方）
const CLIFF_TEX = { wallClean: [1104, 1128], wallMoss: [814, 818], wallHalfMoss: [1128, 1142] };
function drawCliffCluster(x, imgs, ex, dir, gy, seed) {
  const r = rng(seed);
  x.fillStyle = 'rgba(0,0,0,.32)';                         // 巨石压在路缘的接触阴影
  x.beginPath(); x.ellipse(ex + dir * 6, gy + 7, 34, 6, 0, 0, 7); x.fill();
  const rocks = [                                          // 三块巨石自上而下咬合路缘（先画底下层）
    { ox: -10, oy: 86, w: 50, h: 52, moss: 0    },
    { ox: -14, oy: 40, w: 66, h: 60, moss: 0.5  },
    { ox: -20, oy: -12, w: 84, h: 72, moss: 1   },
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
    const sw = Math.round(rk.w * 3.2), shh = Math.round(rk.h * 3.2);
    if (imgs?.wallClean) {                                 // 石块本体：墙体同材质
      const [W0, H0] = CLIFF_TEX.wallClean;
      const sx0 = Math.round(r() * (W0 - sw)), sy0 = Math.round(r() * (H0 - shh));
      x.drawImage(imgs.wallClean, sx0, sy0, sw, shh, cx - rx - 8, cy - ry - 8, rk.w + 16, rk.h + 16);
    } else {
      x.fillStyle = PAL.stoneD;
      x.fillRect(cx - rx - 8, cy - ry - 8, rk.w + 16, rk.h + 16);
    }
    if (imgs?.wallMoss && rk.moss > 0) {                   // 顶面苔藓盖头（两块错位补丁打散直缝）
      const [W1, H1] = CLIFF_TEX.wallMoss;
      const mw = Math.round(rk.w * 2.6), mh = Math.round(rk.h * 1.4);
      for (const [hFrac, aFrac, oyF] of [[0.5, rk.moss, -4], [0.36, rk.moss * 0.65, rk.h * 0.36]]) {
        x.globalAlpha = aFrac;
        const mx0 = Math.round(r() * (W1 - mw)), my0 = Math.round(r() * (H1 - mh));
        x.drawImage(imgs.wallMoss, mx0, my0, mw, mh, cx - rx - 8, cy - ry - 8 + oyF, rk.w + 16, rk.h * hFrac + 8);
      }
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

function makeBg(w) {
  const { geo } = w;
  const c = document.createElement('canvas');
  c.width = SIDE.W; c.height = SIDE.H;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  // 墙：第一关同款青苔墙砖随机拼接 + 顶部渐暗
  drawMossyWall(x, w.atlases, SIDE.W, geo.groundY - 16, 23);
  const wsh = x.createLinearGradient(0, 0, 0, geo.groundY - 16);
  wsh.addColorStop(0, 'rgba(10,12,20,.42)'); wsh.addColorStop(0.6, 'rgba(10,12,20,0)');
  x.fillStyle = wsh; x.fillRect(0, 0, SIDE.W, geo.groundY - 16);
  // 墙脚踢脚线（裂缝两侧断开）
  tile(x, w.atlases, 'wall_base', 0, geo.groundY - 16, geo.chasmL, 16);
  tile(x, w.atlases, 'wall_base', geo.chasmR, geo.groundY - 16, SIDE.W - geo.chasmR, 16);
  // 地面（裂缝两侧）：第一关同款砖石地砖 + 顶缘亮线 + 下部压暗
  tile(x, w.atlases, 'floor_brick', 0, geo.groundY, geo.chasmL, 130, 0.25);
  tile(x, w.atlases, 'floor_brick', geo.chasmR, geo.groundY, SIDE.W - geo.chasmR, 130, 0.25);
  x.fillStyle = 'rgba(255,236,200,.09)';
  x.fillRect(0, geo.groundY, geo.chasmL, 2); x.fillRect(geo.chasmR, geo.groundY, SIDE.W - geo.chasmR, 2);
  // 墙脚落地阴影（压住墙/地交界）
  const fsh = x.createLinearGradient(0, geo.groundY - 8, 0, geo.groundY + 36);
  fsh.addColorStop(0, 'rgba(0,0,0,.30)'); fsh.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = fsh; x.fillRect(0, geo.groundY - 8, SIDE.W, 44);
  const gsh = x.createLinearGradient(0, geo.groundY, 0, geo.groundY + 130);
  gsh.addColorStop(0, 'rgba(0,0,0,0)'); gsh.addColorStop(1, 'rgba(0,0,0,.42)');
  x.fillStyle = gsh;
  x.fillRect(0, geo.groundY, geo.chasmL, 130); x.fillRect(geo.chasmR, geo.groundY, SIDE.W - geo.chasmR, 130);
  // 黄昏底色：与第一关同一层压暗，统一氛围
  x.fillStyle = 'rgba(16,18,36,.30)';
  x.fillRect(0, 0, SIDE.W, SIDE.H);
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
