// —— 析声者 · 第三关浏览器 kit（侧视河程）：自 ch3.js kit 段原样迁入 ——
import { createGame, startGame, gameEvent, ch3Debug } from './event.js';
import { drawRoom, drawBankObjects, drawCreviceObjects, drawDeepObjects, drawBubble, currentGround } from './render.js';
import { chapterOnE, syncHeld, dropBackExtra, stepWorldStones } from '../chapter.js';
import { mount } from '../shell.js';
import {
  SIDE, moveSide, spawnSideStone, drawSideStone,
  drawEHint, vignette
} from '../sideview.js';
import { drawBulb } from '../art.js';
import { createActors, updateActors, drawPlayer } from '../actors.js';
import { screenToLogical } from '../ch1/physics.js';

// ================= 浏览器 Kit =================
export const kit = {
  chapter: 3,
  W: SIDE.W,
  H: SIDE.H,
  titleRune: 'ᚩ',
  createGame,
  startGame,
  gameEvent,
  debug: ch3Debug,
  voices: v => ({
    child: { voice: v.child, pitch: 1.25, rate: 1, rateSlow: 0.8 },
    door: { voice: v.door, pitch: 0.7, rate: 0.8, rateSlow: 0.6 }
  }),

  makeWorld({ content, game, cv }) {
    const actors = createActors();
    const geo = content.geometry;
    const player = actors.player;
    player.x = geo.bank.spawnX;
    player.y = geo.bank.groundY;
    player.dir = 'right';
    player.airborne = false;
    const w = {
      actors, player, geo, cv, currentRoom: 'bank',
      stones: [],
      raft: { x: geo.bank.raftX, y: geo.bank.groundY - 24, bob: 0 },
      transition: null,
      view: { t: 0, fadeAlpha: 0, bubbleT: 0, shrugT: 0, bulbT: 0, poleT: 0, puffs: [] },
      cfg: { speed: 300 }
    };
    return w;
  },

  onBegin(w) {
    w.hb.refresh(w.game.inv);
    w.ui.setHint('start');
  },

  tick(w, dt) {
    const { game, player, view } = w;
    view.t += dt;
    view.bubbleT = Math.max(0, view.bubbleT - dt);
    view.shrugT = Math.max(0, view.shrugT - dt);
    view.bulbT = Math.max(0, view.bulbT - dt);
    view.poleT = Math.max(0, view.poleT - dt);
    updateActors(w.actors, dt);

    if (w.transition) {
      const tr = w.transition;
      tr.alpha += dt * 2.4 * tr.dir;
      w.view.fadeAlpha = Math.max(0, Math.min(1, tr.alpha));
      if (tr.dir > 0 && tr.alpha >= 1) {
        w.currentRoom = tr.room;
        placeRoom(w, tr.room);
        tr.dir = -1;
      } else if (tr.dir < 0 && tr.alpha <= 0) {
        w.transition = null;
        w.view.fadeAlpha = 0;
      }
    } else if (w.currentRoom === 'bank' || w.currentRoom === 'crevice' || (w.currentRoom === 'deep' && game.stalled && !game.poled)) {
      w.cfg.gap = null;
      if (w.currentRoom === 'deep' && game.stalled && !game.poled) {
        player.y = w.geo.deep.groundY;
        player.airborne = false;
      }
      moveSide(w, dt);
      if (player.moving && (w.keys.has('l') || w.keys.has('r'))) player.walkT += dt;
    }

    if (game.embarked && w.currentRoom === 'deep') {
      w.raft.bob += dt;
      if (!game.stalled) {
        w.raft.x += 110 * dt;
        if (w.raft.x >= w.geo.deep.stallX) w.run(gameEvent(game, 'STALL'));
      } else if (game.poled && !game.summary) {
        w.raft.x += 360 * dt;
        if (w.raft.x > SIDE.W + 80) w.run(gameEvent(game, 'EXIT'));
      }
      if (!game.stalled || game.poled) {
        player.x = w.raft.x;
        player.y = w.raft.y - 28;
        player.moving = true;
        player.dir = 'right';
        player.walkT += dt;
      }
    }

    stepWorldStones(w, dt, currentGround);
    view.puffs = view.puffs.filter(p => { p.r += dt * 40; p.a -= dt * 2; return p.a > 0; });
  },

  findE(w) {
    const { game, player } = w;
    if (w.transition) return null;
    let best = null;
    let bd = Infinity;
    const consider = (d, target, radius) => {
      if (d <= radius && d < bd) { bd = d; best = target; }
    };
    for (const stone of w.stones) if (stone.state === 'idle') {
      consider(Math.hypot(player.x - stone.x, player.y - stone.y), { kind: 'stone', ipa: stone.ipa, stone, x: stone.x, y: stone.y }, 58);
    }
    if (w.currentRoom === 'bank') {
      consider(Math.abs(player.x - w.geo.bank.benchX), { kind: 'obj', id: 'bench', x: w.geo.bank.benchX, y: w.geo.bank.groundY }, 82);
      consider(Math.abs(player.x - w.geo.bank.doorX), { kind: 'obj', id: 'creviceDoor', x: w.geo.bank.doorX, y: w.geo.bank.groundY }, 110);
      if (game.logPlaced) consider(Math.abs(player.x - w.geo.bank.waterX), { kind: 'obj', id: 'logs', x: w.geo.bank.waterX, y: w.geo.bank.groundY }, 92);
      else consider(Math.abs(player.x - w.geo.bank.waterX), { kind: 'obj', id: 'waterbank', x: w.geo.bank.waterX, y: w.geo.bank.groundY }, 92);
      if (game.raftAssembled) consider(Math.abs(player.x - w.raft.x), { kind: 'obj', id: 'raft', x: w.raft.x, y: w.raft.y }, 100);
    } else if (w.currentRoom === 'crevice') {
      consider(Math.abs(player.x - w.geo.crevice.benchX), { kind: 'obj', id: 'bench', x: w.geo.crevice.benchX, y: w.geo.crevice.groundY }, 110);
      consider(Math.abs(player.x - w.geo.crevice.logX), { kind: 'obj', id: 'creviceLog', x: w.geo.crevice.logX, y: w.geo.crevice.groundY }, 100);
      consider(Math.abs(player.x - w.geo.crevice.exitX), { kind: 'obj', id: 'bankDoor', x: w.geo.crevice.exitX, y: w.geo.crevice.groundY }, 110);
      consider(Math.abs(player.x - w.geo.crevice.spawnX), { kind: 'obj', id: 'bankDoor', x: w.geo.crevice.spawnX, y: w.geo.crevice.groundY }, 90);
    } else {
      if (game.stalled) consider(Math.abs(player.x - w.geo.deep.benchX), { kind: 'obj', id: 'bench', x: w.geo.deep.benchX, y: w.geo.deep.groundY }, 110);
      if (game.stalled && !game.poled) consider(Math.abs(player.x - w.geo.deep.muralX), { kind: 'obj', id: 'mural', x: w.geo.deep.muralX, y: w.geo.deep.groundY }, 110);
      if (game.stalled && game.raftAssembled) consider(Math.abs(player.x - w.raft.x), { kind: 'obj', id: 'raft', x: w.raft.x, y: w.raft.y }, 100);
    }
    if (!best) consider(0, { kind: 'obj', id: 'self', x: player.x, y: player.y }, 0);
    return best;
  },

  // 石头/合成台公共段走 chapterOnE；其余为本章专属目标
  onE: chapterOnE(gameEvent, (w, target) => {
    const { game } = w;
    if (target.id === 'creviceDoor') { w.run(gameEvent(game, 'ROOM', 'crevice')); return; }
    if (target.id === 'bankDoor') { w.run(gameEvent(game, 'ROOM', 'bank')); return; }
    if (target.id === 'creviceLog') { w.run(gameEvent(game, 'CREVICE')); return; }
    if (target.id === 'waterbank') {
      if (game.hand?.kind === 'item' && game.hand.word === 'log') w.run(gameEvent(game, 'USE', { word: 'log', target: 'bank' }));
      else w.run(gameEvent(game, 'RAFT'));
      return;
    }
    if (target.id === 'logs') {
      if (game.hand?.kind === 'item' && game.hand.word === 'rope') w.run(gameEvent(game, 'USE', { word: 'rope', target: 'logs' }));
      else w.run(gameEvent(game, 'RAFT'));
      return;
    }
    if (target.id === 'raft') {
      if (game.hand?.kind === 'item' && game.hand.word === 'rope' && !game.raftAssembled) w.run(gameEvent(game, 'USE', { word: 'rope', target: 'logs' }));
      else if (!game.raftRiderUnlocked) w.run(gameEvent(game, 'RAFT'));
      else w.run(gameEvent(game, 'BOARD'));
      return;
    }
    if (target.id === 'mural') { w.run(gameEvent(game, 'POLE')); return; }
    if (target.id === 'self' && game.hand?.kind === 'item') {
      w.run(gameEvent(game, 'USE', { word: game.hand.word, target: 'player' }));
    }
  }),

  onPointerDown(w, e, cv) {
    const p = screenToLogical(e.clientX, e.clientY, cv.getBoundingClientRect());
    if (!p.inside || w.transition) return;
    const game = w.game;
    if (w.currentRoom === 'bank') {
      if (Math.abs(p.x - w.geo.bank.doorX) < 100) { w.run(gameEvent(game, 'ROOM', 'crevice')); return; }
      if (Math.abs(p.x - w.geo.bank.waterX) < 120) {
        if (game.hand?.kind === 'item' && game.hand.word === 'log') w.run(gameEvent(game, 'USE', { word: 'log', target: 'bank' }));
        else if (game.hand?.kind === 'item' && game.hand.word === 'rope' && game.logPlaced) w.run(gameEvent(game, 'USE', { word: 'rope', target: 'logs' }));
        else if (game.raftAssembled && game.raftRiderUnlocked) w.run(gameEvent(game, 'BOARD'));
        else if (game.raftAssembled) w.run(gameEvent(game, 'RAFT'));
        return;
      }
    } else if (w.currentRoom === 'crevice') {
      if (Math.abs(p.x - w.geo.crevice.benchX) < 110) { w.run(gameEvent(game, 'BANK')); return; }
      if (Math.abs(p.x - w.geo.crevice.logX) < 110) { w.run(gameEvent(game, 'CREVICE')); return; }
      if (p.x < 120 || p.x > 1080) { w.run(gameEvent(game, 'ROOM', 'bank')); return; }
    } else if (w.currentRoom === 'deep') {
      if (Math.abs(p.x - w.geo.deep.benchX) < 110) { w.run(gameEvent(game, 'BANK')); return; }
      if (Math.abs(p.x - w.geo.deep.muralX) < 130) { w.run(gameEvent(game, 'POLE')); return; }
      if (game.stalled && game.raftRiderUnlocked && Math.abs(p.x - w.raft.x) < 120) { w.run(gameEvent(game, 'BOARD')); }
    }
  },

  onDropItem(w, word, cx, cy) {
    const p = screenToLogical(cx, cy, w.cv.getBoundingClientRect());
    if (!p.inside) return;
    const game = w.game;
    const target = w.currentRoom === 'bank'
      ? (word === 'log' && p.x >= w.geo.bank.waterX - 130 ? 'bank' : word === 'rope' && p.x >= w.geo.bank.waterX - 150 ? 'logs' : word === 'raft' && Math.hypot(p.x - w.player.x, p.y - w.player.y) < 100 ? 'player' : null)
      : (w.currentRoom === 'deep' && word === 'pole' && Math.hypot(p.x - w.player.x, p.y - w.player.y) < 130 ? 'player' : null);
    if (target) w.run(gameEvent(game, 'USE', { word, target }));
  },

  syncHeld,

  runExtras: {
    drop(w, ins) {                        // 本章掉落按 only 名单定点排布（与公共 dropExtra 的散开策略不同）
      const def = w.content.words[ins.word];
      const flow = w.content.flows[ins.word];
      const only = ins.only || def.phonemes.map(([ipa]) => ipa);
      only.forEach((ipa, i) => spawnSideStone(w.stones, ipa, flow.drop[0] + i * 42, flow.drop[1] - 120, (Math.random() - 0.5) * 35, -120));
    },
    dropBack: dropBackExtra(currentGround, -50),
    shrug(w) { w.view.shrugT = 1.2; },
    bubble(w) { w.view.bubbleT = 2.6; },
    effect(w, ins) {
      if (ins.name === 'roomTransition') {
        w.transition = { room: ins.room, alpha: 0, dir: 1 };
      } else if (ins.name === 'placeLog') {
        w.view.puffs.push({ x: w.geo.bank.waterX, y: w.geo.bank.groundY - 20, r: 8, a: 1 });
      } else if (ins.name === 'assembleRaft') {
        w.view.puffs.push({ x: w.geo.bank.waterX + 50, y: w.geo.bank.groundY - 30, r: 10, a: 1 });
        w.sfx.itemIn();
      } else if (ins.name === 'raftRiderUnlock') {
        if (ins.full) w.view.bulbT = 2.8;
        else w.sfx.glowTick();
      } else if (ins.name === 'embark') {
        w.sfx.water();
      } else if (ins.name === 'poleRiver') {
        if (ins.full) { w.view.poleT = 1.2; w.sfx.sweepUp(); }
        else w.sfx.glowTick();
      }
    }
  },

  summaryMerge(game) {
    return { everPicked: [...game.inv.everPicked], words: [...game.book], abilities: ['raft'], chapter: 3 };
  },

  onFinal(w) {
    w.ui.setHint('end');
    const walk = document.getElementById('btn-walk');
    walk.textContent = '旅程完成';
    walk.onclick = null;
  },

  draw(w, x, eTarget) {
    const { game, view } = w;
    x.clearRect(0, 0, SIDE.W, SIDE.H);
    drawRoom(w, x);
    if (w.currentRoom === 'bank') drawBankObjects(w, x);
    if (w.currentRoom === 'crevice') drawCreviceObjects(w, x);
    if (w.currentRoom === 'deep') drawDeepObjects(w, x);
    x.save();
    if (view.shrugT > 0) { x.translate(w.player.x, w.player.y); x.scale(1.05, 0.92); x.translate(-w.player.x, -w.player.y); }
    drawPlayer(x, w.player, view.t, w.atlases);
    x.restore();
    for (const stone of w.stones) drawSideStone(x, stone, view.t);
    if (view.bulbT > 0) drawBulb(x, w.player.x, w.player.y - 100, view.bulbT / 2.8);
    if (view.bubbleT > 0) drawBubble(x, w.player, view.bubbleT);
    drawEHint(x, eTarget, view.t);
    vignette(x);
    if (view.fadeAlpha > 0) { x.fillStyle = `rgba(0,0,0,${view.fadeAlpha})`; x.fillRect(0, 0, SIDE.W, SIDE.H); }
    if (game.summary) { x.fillStyle = 'rgba(255,220,150,.12)'; x.fillRect(0, 0, SIDE.W, SIDE.H); }
  }
};

function placeRoom(w, room) {
  const geo = w.geo[room];
  w.player.x = geo.spawnX;
  w.player.y = geo.groundY;
  w.player.airborne = false;
  w.player.moving = false;
  if (room === 'deep') {
    w.raft.x = geo.raftX;
    w.raft.y = geo.groundY - 24;
  }
}

mount(kit);
