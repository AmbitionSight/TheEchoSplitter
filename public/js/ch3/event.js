// —— 析声者 · 第三关事件机（纯逻辑，Node 可测）：自 ch3.js 事件段原样迁入 ——
import { createInventory, addStone } from '../hotbar.js';
import { pickupStone, bankHeld, holdItem, craftWord } from '../chapter.js';

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

export function ch3Debug(g, beat) {
  switch (beat) {
    case 'crevice':
    case 'log':
    case 'logged':
      return gameEvent(g, 'ROOM', 'crevice').concat(gameEvent(g, 'CREVICE'));
    case 'crafted': {
      let out = ch3Debug(g, 'logged');
      out = out.concat(collectWord(g, 'log'));
      out = out.concat(collectWord(g, 'rope'));
      return out;
    }
    case 'assembled': {
      let out = ch3Debug(g, 'crafted');
      out = out.concat(gameEvent(g, 'ROOM', 'bank'));
      out = out.concat(gameEvent(g, 'HOLD_ITEM', 'log'));
      out = out.concat(gameEvent(g, 'USE', { word: 'log', target: 'bank' }));
      out = out.concat(gameEvent(g, 'HOLD_ITEM', 'rope'));
      out = out.concat(gameEvent(g, 'USE', { word: 'rope', target: 'logs' }));
      return out;
    }
    case 'raft-unlocked': {
      let out = ch3Debug(g, 'assembled');
      out = out.concat(gameEvent(g, 'RAFT'));
      for (const ipa of ['æ', 'f', 't']) out = out.concat(gameEvent(g, 'PICKUP', ipa), gameEvent(g, 'BANK'));
      out = out.concat(gameEvent(g, 'CRAFT', 'raft'));
      out = out.concat(gameEvent(g, 'USE', { word: 'raft', target: 'player' }));
      return out;
    }
    case 'embarked':
      return ch3Debug(g, 'raft-unlocked').concat(gameEvent(g, 'BOARD'));
    case 'stalled':
      return ch3Debug(g, 'embarked').concat(gameEvent(g, 'STALL'), gameEvent(g, 'POLE'));
    case 'poled': {
      let out = ch3Debug(g, 'stalled');
      for (const ipa of ['p', 'əʊ', 'l']) out = out.concat(gameEvent(g, 'PICKUP', ipa), gameEvent(g, 'BANK'));
      out = out.concat(gameEvent(g, 'CRAFT', 'pole'));
      return out.concat(gameEvent(g, 'USE', { word: 'pole', target: 'player' }));
    }
    case 'summary':
      return ch3Debug(g, 'poled').concat(gameEvent(g, 'EXIT'));
    default:
      return [];
  }
}
