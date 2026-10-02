// —— 回响之石 · 第二间房：jump（dʒ·ʌ·m·p；p 为第一间房旧识）——
import { createInventory, addStone, canConsume, consume } from './hotbar.js';

const cap = w => w[0].toUpperCase() + w.slice(1) + '.';

// ================= 纯事件机（Node 可测，行为与重构前一致） =================
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
    case 'PICKUP': {
      const ipa = arg;
      const out = [];
      if (g.hand?.kind === 'stone') out.push({ t: 'dropBack', ipa: g.hand.ipa });
      g.hand = { kind: 'stone', ipa };
      g.inv.everPicked.add(ipa);
      g.stonesPicked++;
      out.push({ t: 'carrier', ipa }, { t: 'hand' });
      if (g.stonesPicked === 1) out.push({ t: 'hint', key: 'carrying' });
      return out;
    }
    case 'BANK': {
      if (g.hand?.kind !== 'stone') return [];
      const ipa = g.hand.ipa;
      g.hand = null;
      addStone(g.inv, ipa);
      return [{ t: 'bank', ipa }, { t: 'hand' }];
    }
    case 'HOLD_ITEM': {
      const word = arg;
      if (!g.inv.items.has(word)) return [];
      if (g.hand?.kind === 'item' && g.hand.word === word) {
        g.hand = null;                                   // 再点一次 = 放下
        return [{ t: 'hand' }];
      }
      g.hand = { kind: 'item', word };
      return [{ t: 'speak', who: 'child', text: cap(word) }, { t: 'hand' }, { t: 'hint', key: 'give' }];
    }
    case 'CRAFT': {
      const word = arg;
      if (!c.words[word] || g.inv.items.has(word)) return [];
      const phon = c.words[word].phonemes.map(p => p[0]);
      if (!canConsume(g.inv, phon)) return [];
      consume(g.inv, phon);
      g.inv.items.set(word, true);
      g.book.add(word);
      return [
        { t: 'resonate', word },
        { t: 'speak', who: 'child', text: cap(word) },
        { t: 'itemIn', word },
        { t: 'hint', key: 'give' }
      ];
    }
    case 'USE': {
      const { word, target } = arg;
      const def = c.words[word]?.use;
      if (!def || target !== def.target) return [{ t: 'mutter' }];
      if (g.jumpUnlocked) return [{ t: 'speak', who: 'child', text: cap(word) }, { t: 'effect', name: 'jumpUnlock', full: false }];
      g.jumpUnlocked = true;
      return [{ t: 'speak', who: 'child', text: cap(word) }, { t: 'effect', name: 'jumpUnlock', full: true }];
    }
    case 'CROSS':
      if (g.crossed) return [];
      g.crossed = true;
      return [{ t: 'hint', key: 'exit' }, { t: 'beat', beat: 'crossed' }];
    case 'FELL':
      return [{ t: 'fell' }, { t: 'meow' }, { t: 'hint', key: 'fell' }];
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
import { mount, CHAPTER_DAY } from './shell.js';
import { SIDE, shade, moveSide, sideJump, spawnSideStone, stepSideStone,
         drawSideStone, drawTorchSide, drawBenchSide, drawEHint, vignette, drawWallBack, drawFloorSide } from './sideview.js';
import { PAL, drawRune } from './art.js';
import { blit, tile } from './sprites.js';
import { createActors, updateActors, drawPlayer, drawCat } from './actors.js';
import { seedMemory, neededSeeds } from './profile.js';
import { isVowel } from './hotbar.js';

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
    actors.cat.x = geo.spawnX - 70; actors.cat.y = geo.groundY + 12;
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

  onBegin(w) {
    const seeds = neededSeeds(w.content, w.profile.everPicked);              // 只带本章需要的旧音素（p）
    const seeded = seedMemory(w.game.inv, addStone, seeds);
    if (seeded.length) setTimeout(() => { w.sfx.chime(); w.hb.refresh(w.game.inv); }, 900);
    w.hb.refresh(w.game.inv);
  },

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
    // 猫：过坑后在对岸出现
    const cat = w.actors.cat;
    const tx = w.player.x > geo.chasmR ? geo.chasmR + 90
      : Math.max(geo.spawnX - 70, w.player.x - 80);
    cat.x += (tx - cat.x) * Math.min(1, dt * 2.5);
    for (const s of w.stones) if (s.state !== 'idle') stepSideStone(s, dt, geo.groundY);
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
    consider(Math.abs(player.x - geo.exitX), { kind: 'obj', id: 'exit', x: geo.exitX, y: geo.groundY }, 80);
    consider(Math.abs(player.x - w.actors.cat.x), { kind: 'obj', id: 'cat', x: w.actors.cat.x, y: w.actors.cat.y }, 50);
    if (w.game.hand?.kind === 'item') consider(0, { kind: 'obj', id: 'self', x: player.x, y: player.y }, 0);
    return best;
  },

  onE(w, t) {
    const { game, geo } = w;
    if (t.kind === 'stone') {
      const i = w.stones.indexOf(t.stone);
      if (i >= 0) w.stones.splice(i, 1);
      w.run(gameEvent(game, 'PICKUP', t.ipa));
    }
    else if (t.id === 'bench') w.run(gameEvent(game, 'BANK'));
    else if (t.id === 'cat') w.run([{ t: 'meow' }]);
    else if (t.id === 'exit') w.run(gameEvent(game, 'EXIT'));
    else if (t.id === 'self' && game.hand?.kind === 'item') w.run(gameEvent(game, 'USE', { word: game.hand.word, target: 'player' }));
    else w.sfx.mutter();
  },

  syncHeld(w) {
    const p = w.player, h = w.game.hand;
    if (!h) { p.held = null; p.heldVowel = false; p.heldIcon = null; return; }
    if (h.kind === 'stone') { p.held = h.ipa; p.heldVowel = isVowel(h.ipa); p.heldIcon = null; }
    else { p.held = null; p.heldVowel = false; p.heldIcon = w.content.words[h.word].icon; }
  },

  runExtras: {
    drop(w, ins) {
      const f = w.content.flows[ins.word];
      w.content.words[ins.word].phonemes.forEach(([ipa], i) => {
        spawnSideStone(w.stones, ipa, f.drop[0] + i * 46, f.drop[1] - 180, (Math.random() - 0.5) * 40, -120);
      });
    },
    dropBack(w, ins) { spawnSideStone(w.stones, ins.ipa, w.player.x - 20, w.geo.groundY - 120, -60, -100); },
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
    x.fillStyle = 'rgba(90,100,120,.14)';
    for (const m of v.mist) {
      const span = geo.chasmR - geo.chasmL;
      x.beginPath();
      x.ellipse(geo.chasmL + ((m.o * span + Math.sin(m.ph) * 20 + span) % span), geo.groundY + 26 + Math.sin(m.ph * 1.3) * 8, 34, 10, 0, 0, 7);
      x.fill();
    }
    x.fillStyle = shade(PAL.stoneD, -0.2);
    for (const [cx, cy, r] of [[geo.chasmL, geo.groundY + 8, 12], [geo.chasmR, geo.groundY + 8, 12], [geo.chasmL + 26, geo.groundY + 22, 7], [geo.chasmR - 26, geo.groundY + 20, 7]]) {
      x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
    }
    drawTorchSide(x, 90, 180, v.t);
    drawTorchSide(x, geo.chasmR + 120, 180, v.t);
    drawBenchSide(x, w.atlases, geo.benchX, geo.groundY, game.hand?.kind === 'stone');
    drawExit(x, w.atlases, geo.exitX, geo.groundY, game.crossed, v.t);
    drawCat(x, w.actors.cat, v.t);
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

function makeBg(w) {
  const { geo } = w;
  const c = document.createElement('canvas');
  c.width = SIDE.W; c.height = SIDE.H;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  drawWallBack(x, w.atlases, SIDE.W, SIDE.H, 0.42);
  // 墙脚踢脚线（裂缝两侧断开）
  tile(x, w.atlases, 'wall_base', 0, geo.groundY - 16, geo.chasmL, 16);
  tile(x, w.atlases, 'wall_base', geo.chasmR, geo.groundY - 16, SIDE.W - geo.chasmR, 16);
  // 地面（裂缝两侧）：MI 地砖平铺 + 顶缘亮线 + 下部压暗
  drawFloorSide(x, w.atlases, 0, geo.groundY, geo.chasmL, 130);
  drawFloorSide(x, w.atlases, geo.chasmR, geo.groundY, SIDE.W - geo.chasmR, 130);
  x.fillStyle = 'rgba(255,236,200,.09)';
  x.fillRect(0, geo.groundY, geo.chasmL, 2); x.fillRect(geo.chasmR, geo.groundY, SIDE.W - geo.chasmR, 2);
  const gsh = x.createLinearGradient(0, geo.groundY, 0, geo.groundY + 130);
  gsh.addColorStop(0, 'rgba(0,0,0,0)'); gsh.addColorStop(1, 'rgba(0,0,0,.42)');
  x.fillStyle = gsh;
  x.fillRect(0, geo.groundY, geo.chasmL, 130); x.fillRect(geo.chasmR, geo.groundY, SIDE.W - geo.chasmR, 130);
  return c;
}

function drawExit(x, imgs, ex, gy, lit) {
  blit(x, imgs, 'door', ex - 27, gy - 78);
  drawRune(x, 'ᚹ', ex, gy - 46, 20, lit ? PAL.glowRune : 'rgba(30,32,44,.85)', 3);
  if (lit) {
    const g = x.createRadialGradient(ex, gy - 40, 10, ex, gy - 40, 90);
    g.addColorStop(0, 'rgba(255,214,130,.25)'); g.addColorStop(1, 'rgba(255,214,130,0)');
    x.fillStyle = g; x.beginPath(); x.arc(ex, gy - 40, 90, 0, 7); x.fill();
  }
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
