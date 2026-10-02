// —— 回响之石 · 第三间房：rope（r·əʊ·p；əʊ/p 为旧识凝石）——
import { createInventory, addStone, canConsume, consume } from './hotbar.js';

const cap = w => w[0].toUpperCase() + w.slice(1) + '.';

// ================= 纯事件机（Node 可测，行为与重构前一致） =================
export function createGame(content, profile) {
  return {
    content, beat: 'start',
    inv: createInventory(),
    book: new Set(), stonesPicked: 0,
    hand: null, attempted: false,
    mended: profile.abilities.includes('climb') ? true : false,
    climbed: false, exited: false, teaseClock: 0
  };
}

export function startGame(g) {
  return [{ t: 'hint', key: 'start' }, { t: 'beat', beat: 'start' }];
}

export function gameEvent(g, ev, arg = null) {
  const c = g.content;
  switch (ev) {
    case 'ROPE': {
      const first = !g.attempted;
      g.attempted = true;
      const out = [
        { t: 'speak', who: 'door', text: c.flows.rope.listen[0], slow: true },
        { t: 'speak', who: 'child', text: c.flows.rope.puzzled[0] }
      ];
      if (first) out.push({ t: 'drop', word: 'rope' }, { t: 'hint', key: 'carrying' });
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
      if (g.mended) return [{ t: 'speak', who: 'child', text: cap(word) }, { t: 'effect', name: 'mendRope', full: false }];
      g.mended = true; g.hand = null;
      return [{ t: 'speak', who: 'child', text: cap(word) }, { t: 'hand' }, { t: 'effect', name: 'mendRope', full: true }];
    }
    case 'CLIMBED': {
      if (g.climbed) return [];
      g.climbed = true;
      return [{ t: 'hint', key: 'top' }, { t: 'beat', beat: 'top' }];
    }
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
      if (!g.book.has('rope')) return [{ t: 'hint', key: 'carrying' }];
      if (!g.mended) return [{ t: 'hint', key: 'give' }];
      if (!g.climbed) return [{ t: 'hint', key: 'mended' }];
      return [{ t: 'hint', key: 'top' }];
    }
    default:
      return [];
  }
}

export function ropeDebug(g, beat) {
  switch (beat) {
    case 'drop': return gameEvent(g, 'ROPE');
    case 'crafted': {
      let out = ropeDebug(g, 'drop');
      for (const [ipa] of g.content.words.rope.phonemes) {
        out = out.concat(gameEvent(g, 'PICKUP', ipa), gameEvent(g, 'BANK'));
      }
      return out.concat(gameEvent(g, 'CRAFT', 'rope'));
    }
    case 'mended': return ropeDebug(g, 'crafted').concat(gameEvent(g, 'USE', { word: 'rope', target: 'rope' }));
    default: return [];
  }
}

// ================= 浏览器 kit（壳 + 横版共用件） =================
import { mount } from './shell.js';
import { SIDE, shade, moveSide, sideJump, spawnSideStone, stepSideStone,
         drawSideStone, drawTorchSide, drawBenchSide, drawEHint, vignette } from './sideview.js';
import { PAL, drawRune } from './art.js';
import { createActors, updateActors, drawPlayer, drawCat } from './actors.js';
import { seedMemory } from './profile.js';
import { isVowel } from './hotbar.js';

const kit = {
  chapter: 3, W: SIDE.W, H: SIDE.H, titleRune: 'ᚱ',

  createGame, startGame, gameEvent, debug: ropeDebug,

  voices: v => ({
    child: { voice: v.child, pitch: 1.25, rate: 1 },
    door: { voice: v.door, pitch: 0.7, rate: 0.8 }
  }),

  makeWorld({ content, profile, game }) {
    const geo = content.geometry;
    const actors = createActors();
    const player = actors.player;
    player.x = geo.spawnX; player.y = geo.groundY;
    player.vy = 0; player.airborne = false; player.climbing = false;
    actors.cat.x = geo.spawnX - 70; actors.cat.y = geo.groundY + 12;
    const canJump = profile.abilities.includes('jump');
    const w = {
      actors, player, geo, canJump,
      stones: [],
      view: { t: 0, puffs: [], ropeMendT: 0 },
      cfg: {
        wall: { X: geo.wallX, W: geo.wallW, topY: geo.topY },
        rope: { ok: () => w.game.mended, x: () => geo.wallX + geo.wallW / 2 },
        canJump,
        onTopReach: () => { w.run(gameEvent(w.game, 'CLIMBED')); w.sfx.chime(); }
      }
    };
    return w;
  },

  onBegin(w) {
    const seeded = seedMemory(w.game.inv, addStone, w.profile.everPicked);   // 旧识凝石
    if (seeded.length) setTimeout(() => { w.sfx.chime(); w.hb.refresh(w.game.inv); }, 900);
    w.hb.refresh(w.game.inv);
  },

  onSpace(w) { if (w.canJump) { sideJump(w); w.sfx.click(); } },

  tick(w, dt) {
    const { view: v, geo } = w;
    v.t += dt;
    v.ropeMendT = Math.max(0, v.ropeMendT - dt);
    updateActors(w.actors, dt);
    moveSide(w, dt);
    const cat = w.actors.cat;
    const tx = w.player.y < geo.groundY - 160 ? cat.x
      : Math.max(geo.spawnX - 70, Math.min(w.player.x - 80, geo.wallX - 70));
    cat.x += (tx - cat.x) * Math.min(1, dt * 2.5);
    for (const s of w.stones) if (s.state !== 'idle') stepSideStone(s, dt, geo.groundY);
    v.puffs = v.puffs.filter(p => { p.r += dt * 40; p.a -= dt * 2; return p.a > 0; });
  },

  findE(w) {
    const { player, geo, stones } = w;
    const ropeX = geo.wallX + geo.wallW / 2;
    let best = null, bd = 1e9;
    const consider = (d, t, r) => { if (d < bd && d <= r) { bd = d; best = t; } };
    for (const s of stones) if (s.state === 'idle') {
      consider(Math.hypot(player.x - s.x, player.y - s.y), { kind: 'stone', ipa: s.ipa, x: s.x, y: s.y, stone: s }, 56);
    }
    consider(Math.abs(player.x - geo.benchX), { kind: 'obj', id: 'bench', x: geo.benchX, y: geo.groundY }, 80);
    consider(Math.hypot(player.x - ropeX, player.y - (geo.groundY - 80)), { kind: 'obj', id: 'rope', x: ropeX, y: geo.groundY - 80 }, 90);
    consider(Math.abs(player.x - geo.exitX), { kind: 'obj', id: 'exit', x: geo.exitX, y: geo.topY }, 80);
    consider(Math.abs(player.x - w.actors.cat.x), { kind: 'obj', id: 'cat', x: w.actors.cat.x, y: w.actors.cat.y }, 50);
    return best;
  },

  onE(w, t) {
    const { game } = w;
    if (t.kind === 'stone') {
      const i = w.stones.indexOf(t.stone);
      if (i >= 0) w.stones.splice(i, 1);
      w.run(gameEvent(game, 'PICKUP', t.ipa));
    }
    else if (t.id === 'bench') w.run(gameEvent(game, 'BANK'));
    else if (t.id === 'cat') w.run([{ t: 'meow' }]);
    else if (t.id === 'rope') {
      if (game.hand?.kind === 'item' && game.hand.word === 'rope') w.run(gameEvent(game, 'USE', { word: 'rope', target: 'rope' }));
      else w.run(gameEvent(game, 'ROPE'));
    }
    else if (t.id === 'exit') w.run(gameEvent(game, 'EXIT'));
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
        spawnSideStone(w.stones, ipa, f.drop[0] + i * 46, f.drop[1] - 170, (Math.random() - 0.5) * 30, -110);
      });
    },
    dropBack(w, ins) { spawnSideStone(w.stones, ins.ipa, w.player.x - 20, w.geo.groundY - 120, -60, -100); },
    effect(w, ins) {
      if (ins.name !== 'mendRope') return;
      if (ins.full) { w.sfx.itemIn(); w.view.ropeMendT = 1.2; w.ui.setHint('mended'); }
      else w.sfx.glowTick();
    }
  },

  summaryMerge(game) {
    return { everPicked: [...game.inv.everPicked], words: [...game.book], abilities: ['climb'], chapter: 3 };
  },

  onFinal(w) {
    w.ui.setHint('end');
    const walk = document.getElementById('btn-walk');
    walk.textContent = '更深处，未完待续';
    walk.onclick = null;
  },

  draw(w, x, eTarget) {
    const { view: v, geo, game } = w;
    const ropeX = geo.wallX + geo.wallW / 2;
    x.clearRect(0, 0, SIDE.W, SIDE.H);
    // 夜空 + 星
    const sky = x.createLinearGradient(0, 0, 0, SIDE.H);
    sky.addColorStop(0, '#0b0e18'); sky.addColorStop(1, '#1c1610');
    x.fillStyle = sky; x.fillRect(0, 0, SIDE.W, SIDE.H);
    x.fillStyle = 'rgba(244,240,216,.5)';
    for (let i = 0; i < 20; i++) x.fillRect((i * 137 + 60) % SIDE.W, (i * 89 + 40) % 320, 2, 2);
    // 高墙 + 平台
    x.fillStyle = shade(PAL.wallA, -0.1);
    x.fillRect(geo.wallX, geo.topY, geo.wallW, geo.groundY - geo.topY);
    x.strokeStyle = PAL.wallDark; x.lineWidth = 3;
    for (let ry = geo.topY + 30; ry < geo.groundY; ry += 60) {
      x.beginPath(); x.moveTo(geo.wallX, ry); x.lineTo(geo.wallX + geo.wallW, ry); x.stroke();
    }
    x.fillStyle = shade(PAL.floorB, -0.02);
    x.fillRect(geo.wallX, geo.topY - 14, geo.wallW, 16);
    x.fillStyle = 'rgba(255,236,200,.1)';
    x.fillRect(geo.wallX, geo.topY - 14, geo.wallW, 3);
    // 地面
    x.fillStyle = shade(PAL.floorB, -0.05);
    x.fillRect(0, geo.groundY, SIDE.W, SIDE.H - geo.groundY);
    x.fillStyle = 'rgba(255,236,200,.07)'; x.fillRect(0, geo.groundY, SIDE.W, 3);
    drawRope(x, w, ropeX);
    drawTorchSide(x, 90, 180, v.t);
    drawBenchSide(x, geo.benchX, geo.groundY, game.hand?.kind === 'stone');
    drawExit(x, geo.exitX, geo.topY, game.climbed);
    drawCat(x, w.actors.cat, v.t);
    x.save();
    if (w.player.climbing) { x.translate(w.player.x, w.player.y); x.rotate(0.12); x.translate(-w.player.x, -w.player.y); }
    drawPlayer(x, w.player, v.t);
    x.restore();
    if (w.player.climbing) drawClimbArms(x, w.player);
    for (const s of w.stones) drawSideStone(x, s, v.t);
    for (const pf of v.puffs) {
      x.globalAlpha = pf.a * 0.5; x.fillStyle = '#cfc9ba';
      x.beginPath(); x.arc(pf.x, pf.y - 6, pf.r, 0, 7); x.fill();
    }
    x.globalAlpha = 1;
    drawEHint(x, eTarget, v.t);
    vignette(x);
  }
};

function drawRope(x, w, ropeX) {
  const geo = w.geo, v = w.view, game = w.game;
  const sway = Math.sin(v.t * 1.6) * 6;
  x.strokeStyle = '#c9a35e'; x.lineCap = 'round';
  if (!game.mended) {
    x.lineWidth = 7;
    x.beginPath();
    x.moveTo(ropeX - 4, geo.topY - 10);
    x.quadraticCurveTo(ropeX - 10 + sway, geo.topY + 130, ropeX - 2 + sway, geo.topY + 190);
    x.stroke();
    x.lineWidth = 3; x.strokeStyle = '#a8814a';
    for (const [dx, dy] of [[-5, 8], [4, 10], [0, 14]]) {
      x.beginPath(); x.moveTo(ropeX - 2 + sway, geo.topY + 190); x.lineTo(ropeX - 2 + sway + dx * 2, geo.topY + 190 + dy); x.stroke();
    }
    const gp = Math.sin(v.t * 3) * 0.5 + 0.5;
    const g = x.createRadialGradient(ropeX + sway, geo.topY + 192, 4, ropeX + sway, geo.topY + 192, 44 + gp * 16);
    g.addColorStop(0, `rgba(123,216,143,${0.3 + gp * 0.25})`); g.addColorStop(1, 'rgba(123,216,143,0)');
    x.fillStyle = g; x.beginPath(); x.arc(ropeX + sway, geo.topY + 192, 60, 0, 7); x.fill();
  } else {
    const grow = Math.min(1, (1.2 - v.ropeMendT) / 0.9);
    const endY = geo.topY + 190 + (geo.groundY - 14 - geo.topY - 190) * grow;
    x.lineWidth = 8;
    x.beginPath();
    x.moveTo(ropeX - 4, geo.topY - 10);
    x.quadraticCurveTo(ropeX - 10 + sway * 0.5, (geo.topY + geo.groundY) / 2 - 60, ropeX + sway * 0.4, endY);
    x.stroke();
    x.fillStyle = PAL.rugGold;
    for (const ky of [geo.topY + 220, geo.topY + 320]) {
      x.beginPath(); x.ellipse(ropeX + sway * 0.4, ky, 8, 5, 0, 0, 7); x.fill();
      x.lineWidth = 2; x.strokeStyle = PAL.ink; x.stroke();
    }
  }
}

function drawExit(x, ex, ty, open) {
  x.fillStyle = PAL.stone;
  x.beginPath();
  x.moveTo(ex - 40, ty); x.lineTo(ex - 40, ty - 78);
  x.arc(ex, ty - 78, 40, Math.PI, 0); x.lineTo(ex + 40, ty); x.closePath();
  x.fill(); x.lineWidth = 6; x.strokeStyle = PAL.stoneD; x.stroke();
  x.fillStyle = open ? 'rgba(255,214,130,.85)' : 'rgba(20,24,34,.9)';
  x.beginPath();
  x.moveTo(ex - 25, ty); x.lineTo(ex - 25, ty - 72);
  x.arc(ex, ty - 72, 25, Math.PI, 0); x.lineTo(ex + 25, ty); x.closePath();
  x.fill();
  drawRune(x, 'ᚱ', ex, ty - 58, 22, open ? PAL.glowRune : 'rgba(30,32,44,.8)', 4);
  if (open) {
    const g = x.createRadialGradient(ex, ty - 40, 10, ex, ty - 40, 80);
    g.addColorStop(0, 'rgba(255,214,130,.28)'); g.addColorStop(1, 'rgba(255,214,130,0)');
    x.fillStyle = g; x.beginPath(); x.arc(ex, ty - 40, 80, 0, 7); x.fill();
  }
}

function drawClimbArms(x, p) {
  const ph = Math.sin(p.walkT * 8) * 6;
  x.strokeStyle = PAL.ink; x.lineWidth = 4; x.lineCap = 'round';
  x.beginPath(); x.moveTo(p.x + 6, p.y - 40); x.lineTo(p.x + 16, p.y - 52 - ph); x.stroke();
  x.beginPath(); x.moveTo(p.x + 6, p.y - 36); x.lineTo(p.x + 16, p.y - 44 + ph); x.stroke();
}

mount(kit);
