// 回响之石 · 第四章：超级拼装（log / rope / raft / pole）
import { createInventory, addStone } from './hotbar.js';
import { pickupStone, bankHeld, holdItem, craftWord,
         chapterOnE, syncHeld, dropBackExtra, stepWorldStones } from './chapter.js';
import { mount } from './shell.js';
import {
  SIDE, moveSide, spawnSideStone, drawSideStone,
  drawBenchSide, drawEHint, vignette
} from './sideview.js';
import { PAL, drawIcon, drawBulb, drawCross } from './art.js';
import { createActors, updateActors, drawPlayer } from './actors.js';
import { screenToLogical } from './scene.js';

const PHONEMES = {
  log: ['l', 'ɒ', 'g'],
  rope: ['r', 'əʊ', 'p'],
  raft: ['r', 'æ', 'f', 't'],
  pole: ['p', 'əʊ', 'l']
};

function seedOpening(inv) {
  for (const [ipa, count] of [['p', 2], ['əʊ', 2], ['r', 2]]) {
    for (let i = 0; i < count; i++) addStone(inv, ipa);
  }
}

export function createGame(content, profile = null) {
  const inv = createInventory();
  seedOpening(inv);
  return {
    content,
    beat: 'bank',
    room: 'bank',
    inv,
    book: new Set(),
    stonesPicked: 0,
    hand: null,
    logDropped: false,
    logPlaced: false,
    raftAssembled: false,
    raftDropped: false,
    raftRiderUnlocked: false,
    embarked: false,
    stalled: false,
    poleDropped: false,
    poled: false,
    summary: false,
    teased: 0,
    teaseClock: 0,
    profile
  };
}

export function startGame(g) {
  return [{ t: 'hint', key: 'start' }, { t: 'beat', beat: 'bank' }];
}

function dropInstruction(word, only = null) {
  return only ? { t: 'drop', word, only } : { t: 'drop', word };
}

function roomEvent(g, room) {
  if (!['bank', 'crevice', 'deep'].includes(room) || g.room === room) return [];
  g.room = room;
  const key = room === 'bank' ? 'bank' : room;
  g.beat = key;
  return [{ t: 'effect', name: 'roomTransition', room }, { t: 'hint', key }, { t: 'beat', beat: key }];
}

// 合成 = chapter.craftWord + 本章合成后的指向提示
const CRAFT_HINT = { log: 'log', rope: 'raft', raft: 'raftReady', pole: 'poled' };
function craft(g, word) {
  return craftWord(g, word, [{ t: 'hint', key: CRAFT_HINT[word] }]);
}

function useItem(g, word, target) {
  const def = g.content.words[word]?.use;
  if (!def || target !== def.target || !g.inv.items.has(word)) return [{ t: 'mutter' }];
  if (word === 'log') {
    if (g.logPlaced) return [{ t: 'effect', name: 'placeLog', full: false }];
    if (g.room !== 'bank') return [{ t: 'mutter' }];
    g.logPlaced = true;
    if (g.hand?.kind === 'item' && g.hand.word === word) g.hand = null;
    return [{ t: 'hand' }, { t: 'effect', name: 'placeLog', full: true }, { t: 'hint', key: 'raft' }];
  }
  if (word === 'rope') {
    if (!g.logPlaced || g.raftAssembled || g.room !== 'bank') return [{ t: 'mutter' }];
    g.raftAssembled = true;
    if (g.hand?.kind === 'item' && g.hand.word === word) g.hand = null;
    return [{ t: 'hand' }, { t: 'effect', name: 'assembleRaft', full: true }, { t: 'hint', key: 'raft' }];
  }
  if (word === 'raft') {
    if (g.raftRiderUnlocked) return [{ t: 'effect', name: 'raftRiderUnlock', full: false }];
    g.raftRiderUnlocked = true;
    if (g.hand?.kind === 'item' && g.hand.word === word) g.hand = null;
    return [{ t: 'hand' }, { t: 'effect', name: 'raftRiderUnlock', full: true }, { t: 'hint', key: 'raftReady' }];
  }
  if (word === 'pole') {
    if (!g.stalled || g.poled) return g.poled ? [{ t: 'effect', name: 'poleRiver', full: false }] : [{ t: 'mutter' }];
    g.poled = true;
    if (g.hand?.kind === 'item' && g.hand.word === word) g.hand = null;
    return [{ t: 'hand' }, { t: 'effect', name: 'poleRiver', full: true }, { t: 'hint', key: 'poled' }, { t: 'beat', beat: 'poled' }];
  }
  return [{ t: 'mutter' }];
}

export function gameEvent(g, ev, arg = null) {
  switch (ev) {
    case 'ROOM':
    case 'ENTER_ROOM':
      return roomEvent(g, arg);
    case 'CREVICE': {
      if (g.room !== 'crevice') return [];
      const out = [{ t: 'speak', who: 'door', text: g.content.flows.log.listen[0], slow: true }];
      if (!g.logDropped) {
        g.logDropped = true;
        out.push(dropInstruction('log', g.content.flows.log.stones), { t: 'hint', key: 'log' }, { t: 'beat', beat: 'log' });
      }
      return out;
    }
    case 'LOG':
      return gameEvent(g, 'CREVICE');
    case 'RAFT': {
      if (g.room !== 'bank' || !g.raftAssembled) return [];
      const out = [
        { t: 'shrug' },
        { t: 'bubble' },
        { t: 'speak', who: 'child', text: g.content.flows.raft.puzzled[0] },
        { t: 'speak', who: 'door', text: g.content.flows.raft.listen[0], slow: true }
      ];
      if (!g.raftDropped) {
        g.raftDropped = true;
        out.push(dropInstruction('raft', ['æ', 'f', 't']), { t: 'hint', key: 'raftListen' }, { t: 'beat', beat: 'raft' });
      }
      return out;
    }
    case 'POLE':
      if (g.room !== 'deep' || !g.stalled) return [];
      if (!g.poleDropped) {
        g.poleDropped = true;
        return [
          { t: 'speak', who: 'door', text: g.content.flows.pole.listen[0], slow: true },
          dropInstruction('pole', ['l']),
          { t: 'hint', key: 'pole' },
          { t: 'beat', beat: 'stalled' }
        ];
      }
      return [{ t: 'speak', who: 'door', text: g.content.flows.pole.listen[0], slow: true }];
    case 'PICKUP':
      return pickupStone(g, arg);
    case 'BANK':
      return bankHeld(g);
    case 'HOLD_ITEM':
      return holdItem(g, arg, { hint: 'raft' });
    case 'CRAFT':
      return craft(g, arg);
    case 'USE': {
      if (!arg || typeof arg !== 'object') return [{ t: 'mutter' }];
      return useItem(g, arg.word, arg.target);
    }
    case 'PLACE_LOG':
      return useItem(g, 'log', 'bank');
    case 'ASSEMBLE_RAFT':
      return useItem(g, 'rope', 'logs');
    case 'BOARD':
    case 'EMBARK': {
      if (!g.raftAssembled || !g.raftRiderUnlocked || g.embarked || g.room !== 'bank') return [];
      g.embarked = true;
      g.room = 'deep';
      g.beat = 'deep';
      return [
        { t: 'effect', name: 'roomTransition', room: 'deep' },
        { t: 'effect', name: 'embark', full: true },
        { t: 'hint', key: 'deep' },
        { t: 'beat', beat: 'deep' }
      ];
    }
    case 'STALL': {
      if (!g.embarked || g.poled || g.room !== 'deep') return [];
      g.stalled = true;
      g.beat = 'stalled';
      const out = [
        { t: 'speak', who: 'door', text: g.content.flows.pole.listen[0], slow: true },
        { t: 'hint', key: 'stalled' },
        { t: 'beat', beat: 'stalled' }
      ];
      return out;
    }
    case 'DEEP_POLE':
      return gameEvent(g, 'STALL');
    case 'EXIT':
    case 'RAFT_EXIT': {
      if (!g.poled || g.summary) return [];
      g.summary = true;
      g.beat = 'summary';
      return [{ t: 'summary' }, { t: 'hint', key: 'end' }, { t: 'beat', beat: 'summary' }];
    }
    case 'TICK': {
      g.teaseClock += Number(arg) || 0;
      if (g.teaseClock < 45 || g.summary) return [];
      g.teaseClock = 0;
      if (g.room === 'bank' && !g.logPlaced) return [{ t: 'hint', key: 'start' }];
      if (!g.logDropped) return [{ t: 'hint', key: 'crevice' }];
      if (!g.book.has('log')) return [{ t: 'hint', key: 'craftLog' }];
      if (!g.logPlaced) return [{ t: 'hint', key: 'log' }];
      if (!g.book.has('rope')) return [{ t: 'hint', key: 'craftRope' }];
      if (!g.raftAssembled) return [{ t: 'hint', key: 'raft' }];
      if (!g.raftDropped || !g.book.has('raft')) return [{ t: 'hint', key: 'raftListen' }];
      if (!g.raftRiderUnlocked) return [{ t: 'hint', key: 'raftReady' }];
      if (!g.embarked) return [{ t: 'hint', key: 'raftReady' }];
      if (!g.stalled) return [{ t: 'hint', key: 'deep' }];
      if (!g.book.has('pole')) return [{ t: 'hint', key: 'pole' }];
      if (!g.poled) return [{ t: 'hint', key: 'pole' }];
      return [{ t: 'hint', key: 'end' }];
    }
    default:
      return [];
  }
}

function collectWord(g, word) {
  let out = [];
  const flow = g.content.flows[word];
  if (word === 'log') out = out.concat(gameEvent(g, 'ROOM', 'crevice'), gameEvent(g, 'CREVICE'));
  if (word === 'raft') out = out.concat(gameEvent(g, 'RAFT'));
  if (word === 'pole') out = out.concat(gameEvent(g, 'POLE'));
  const source = flow?.stones || flow?.phonemes || PHONEMES[word];
  for (const ipa of source) out = out.concat(gameEvent(g, 'PICKUP', ipa), gameEvent(g, 'BANK'));
  return out.concat(gameEvent(g, 'CRAFT', word));
}

export function ch4Debug(g, beat) {
  switch (beat) {
    case 'crevice':
    case 'log':
    case 'logged':
      return gameEvent(g, 'ROOM', 'crevice').concat(gameEvent(g, 'CREVICE'));
    case 'crafted': {
      let out = ch4Debug(g, 'logged');
      out = out.concat(collectWord(g, 'log'));
      out = out.concat(collectWord(g, 'rope'));
      return out;
    }
    case 'assembled': {
      let out = ch4Debug(g, 'crafted');
      out = out.concat(gameEvent(g, 'ROOM', 'bank'));
      out = out.concat(gameEvent(g, 'HOLD_ITEM', 'log'));
      out = out.concat(gameEvent(g, 'USE', { word: 'log', target: 'bank' }));
      out = out.concat(gameEvent(g, 'HOLD_ITEM', 'rope'));
      out = out.concat(gameEvent(g, 'USE', { word: 'rope', target: 'logs' }));
      return out;
    }
    case 'raft-unlocked': {
      let out = ch4Debug(g, 'assembled');
      out = out.concat(gameEvent(g, 'RAFT'));
      for (const ipa of ['æ', 'f', 't']) out = out.concat(gameEvent(g, 'PICKUP', ipa), gameEvent(g, 'BANK'));
      out = out.concat(gameEvent(g, 'CRAFT', 'raft'));
      out = out.concat(gameEvent(g, 'USE', { word: 'raft', target: 'player' }));
      return out;
    }
    case 'embarked':
      return ch4Debug(g, 'raft-unlocked').concat(gameEvent(g, 'BOARD'));
    case 'stalled':
      return ch4Debug(g, 'embarked').concat(gameEvent(g, 'STALL'), gameEvent(g, 'POLE'));
    case 'poled': {
      let out = ch4Debug(g, 'stalled');
      for (const ipa of ['p', 'əʊ', 'l']) out = out.concat(gameEvent(g, 'PICKUP', ipa), gameEvent(g, 'BANK'));
      out = out.concat(gameEvent(g, 'CRAFT', 'pole'));
      return out.concat(gameEvent(g, 'USE', { word: 'pole', target: 'player' }));
    }
    case 'summary':
      return ch4Debug(g, 'poled').concat(gameEvent(g, 'EXIT'));
    default:
      return [];
  }
}

// ================= 浏览器 Kit =================
export const kit = {
  chapter: 4,
  W: SIDE.W,
  H: SIDE.H,
  titleRune: 'ᚩ',
  createGame,
  startGame,
  gameEvent,
  debug: ch4Debug,
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
    return { everPicked: [...game.inv.everPicked], words: [...game.book], abilities: ['raft'], chapter: 4 };
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

function currentGround(w) {
  return w.currentRoom === 'crevice' ? w.geo.crevice.groundY : w.currentRoom === 'deep' ? w.geo.deep.groundY : w.geo.bank.groundY;
}

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

function drawRoom(w, x) {
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

function drawBankObjects(w, x) {
  const geo = w.geo.bank;
  drawBenchSide(x, w.atlases, geo.benchX, geo.groundY, true, w.view.craftSlots);
  x.fillStyle = '#67727d'; x.strokeStyle = PAL.ink; x.lineWidth = 5;
  x.beginPath(); x.roundRect ? x.roundRect(565, geo.groundY - 100, 150, 90, 12) : x.rect(565, geo.groundY - 100, 150, 90); x.fill(); x.stroke();
  x.fillStyle = '#b28a58'; x.fillRect(590, geo.groundY - 70, 100, 12);
  x.fillStyle = '#6b7078';
  x.beginPath(); x.moveTo(geo.doorX - 55, geo.groundY); x.lineTo(geo.doorX - 35, geo.groundY - 130); x.lineTo(geo.doorX + 35, geo.groundY - 130); x.lineTo(geo.doorX + 55, geo.groundY); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#10151b';
  x.beginPath(); x.moveTo(geo.doorX - 24, geo.groundY); x.lineTo(geo.doorX - 18, geo.groundY - 110); x.lineTo(geo.doorX + 18, geo.groundY - 110); x.lineTo(geo.doorX + 24, geo.groundY); x.closePath(); x.fill();
  if (w.game.logPlaced) drawLog(x, geo.waterX - 25, geo.groundY - 16);
  if (w.game.raftAssembled) drawRaft(x, w.raft.x, w.raft.y, w.view.t);
  x.fillStyle = '#2d3941'; x.fillRect(geo.waterX - 4, geo.groundY - 4, 8, 8);
}

function drawCreviceObjects(w, x) {
  const geo = w.geo.crevice;
  drawBenchSide(x, w.atlases, geo.benchX, geo.groundY, true, w.view.craftSlots);
  x.fillStyle = '#10151c'; x.strokeStyle = '#75808b'; x.lineWidth = 8;
  x.beginPath(); x.moveTo(500, 0); x.lineTo(560, 160); x.lineTo(520, 310); x.lineTo(610, 455); x.lineTo(560, geo.groundY); x.lineTo(820, geo.groundY); x.lineTo(760, 430); x.lineTo(820, 280); x.lineTo(750, 120); x.lineTo(790, 0); x.closePath(); x.fill(); x.stroke();
  drawLog(x, geo.logX, geo.groundY - 16);
  x.strokeStyle = '#c1a76b'; x.lineWidth = 4;
  x.beginPath(); x.moveTo(810, 180); x.lineTo(900, 240); x.lineTo(980, 180); x.lineTo(1040, 250); x.stroke();
  x.beginPath(); x.moveTo(830, 180); x.lineTo(850, 300); x.moveTo(940, 210); x.lineTo(940, 320); x.stroke();
  x.fillStyle = '#c1a76b'; x.font = '18px system-ui'; x.fillText('◼  ◼  ◼', 820, 365);
}

function drawDeepObjects(w, x) {
  const geo = w.geo.deep;
  if (w.game.stalled) drawBenchSide(x, w.atlases, geo.benchX, geo.groundY, true, w.view.craftSlots);
  x.fillStyle = 'rgba(120,205,230,.10)'; x.fillRect(0, geo.groundY - 80, SIDE.W, 80);
  x.strokeStyle = '#c1a76b'; x.lineWidth = 5;
  x.beginPath(); x.moveTo(geo.muralX - 120, 190); x.lineTo(geo.muralX, 100); x.lineTo(geo.muralX + 110, 190); x.stroke();
  x.beginPath(); x.moveTo(geo.muralX - 65, 150); x.lineTo(geo.muralX - 20, 270); x.lineTo(geo.muralX + 30, 150); x.stroke();
  x.beginPath(); x.moveTo(geo.muralX - 80, 230); x.lineTo(geo.muralX + 85, 230); x.stroke();
  if (w.game.raftAssembled) drawRaft(x, w.raft.x, w.raft.y, w.view.t);
  x.fillStyle = 'rgba(255,221,140,.5)'; x.font = '18px system-ui'; x.fillText('石壁上的撑篙图', geo.muralX - 88, 310);
}

function drawLog(x, cx, cy) {
  x.save(); x.translate(cx, cy); x.rotate(-0.08);
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

function drawBubble(x, p, t) {
  const a = Math.min(1, t / 0.4);
  const bx = p.x + 12, by = p.y - 110;
  x.save(); x.globalAlpha = a; x.fillStyle = 'rgba(247,244,234,.96)'; x.strokeStyle = PAL.ink; x.lineWidth = 3;
  x.beginPath(); x.roundRect ? x.roundRect(bx - 52, by - 32, 104, 58, 14) : x.rect(bx - 52, by - 32, 104, 58); x.fill(); x.stroke();
  x.beginPath(); x.moveTo(bx - 8, by + 26); x.lineTo(bx + 2, by + 40); x.lineTo(bx + 12, by + 26); x.closePath(); x.fill(); x.stroke();
  drawCross(x, bx + 12, by - 2, 26);
  x.restore();
}

mount(kit);
