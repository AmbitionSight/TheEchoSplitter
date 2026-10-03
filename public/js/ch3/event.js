// —— 析声者 · 第三关事件机（纯逻辑，Node 可测）：自 ch3.js 事件段原样迁入 ——
import { createInventory, addStone } from '../hotbar.js';
import { pickupStone, bankHeld, holdItem, craftWord } from '../chapter.js';

// 组筏前须并排放下的原木根数（手持原木词具在水边连按 E 逐根放置）
const LOGS_NEEDED = 3;

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
    logsPlaced: 0,
    raftAssembled: false,
    raftDropped: false,
    raftRiderUnlocked: false,
    embarked: false,
    stalled: false,
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

function dropInstruction(word, only) {
  return { t: 'drop', word, only };
}

function roomEvent(g, room) {
  if (!['bank', 'crevice', 'deep'].includes(room) || g.room === room) return [];
  g.room = room;
  g.beat = room;
  return [{ t: 'effect', name: 'roomTransition', room }, { t: 'hint', key: room }, { t: 'beat', beat: room }];
}

// 合成 = chapter.craftWord + 本章合成后的指向提示（绳未用前若原木未放满，指向放木头而非组筏）
const CRAFT_HINT = { log: 'log', rope: 'raft', raft: 'raftReady', pole: 'poled' };
function craft(g, word) {
  const key = word === 'rope' && g.logsPlaced < LOGS_NEEDED ? 'log' : CRAFT_HINT[word];
  return craftWord(g, word, [{ t: 'hint', key }]);
}

function clearHeld(g, word) {
  if (g.hand?.kind === 'item' && g.hand.word === word) g.hand = null;
}

function useItem(g, word, target) {
  const def = g.content.words[word]?.use;
  if (!def || target !== def.target || !g.inv.items.has(word)) return [{ t: 'mutter' }];
  if (word === 'log') {
    if (g.room !== 'bank') return [{ t: 'mutter' }];
    if (g.logsPlaced >= LOGS_NEEDED) return [{ t: 'effect', name: 'placeLog', full: false }];
    g.logsPlaced += 1;
    const done = g.logsPlaced === LOGS_NEEDED;
    if (done) {
      clearHeld(g, word);
      g.inv.items.delete(word);                // 三根放满：原木词具耗尽离栏
    }
    return [
      { t: 'hand' },
      ...(done ? [{ t: 'itemIn' }] : []),      // 耗尽时刷新物品栏并提示音
      { t: 'effect', name: 'placeLog', full: true, slot: g.logsPlaced },
      { t: 'hint', key: done ? 'raft' : g.logsPlaced === 1 ? 'log2' : 'log3' }
    ];
  }
  if (word === 'rope') {
    if (g.logsPlaced < LOGS_NEEDED || g.raftAssembled || g.room !== 'bank') return [{ t: 'mutter' }];
    g.raftAssembled = true;
    clearHeld(g, word);
    g.inv.items.delete(word);                  // 组筏完成：绳索词具耗尽离栏
    return [
      { t: 'hand' },
      { t: 'itemIn' },
      { t: 'effect', name: 'assembleRaft', full: true },
      { t: 'hint', key: 'raft' }
    ];
  }
  if (word === 'raft') {
    if (g.raftRiderUnlocked) return [{ t: 'effect', name: 'raftRiderUnlock', full: false }];
    g.raftRiderUnlocked = true;
    clearHeld(g, word);
    return [{ t: 'hand' }, { t: 'effect', name: 'raftRiderUnlock', full: true }, { t: 'hint', key: 'raftReady' }];
  }
  if (word === 'pole') {
    if (!g.stalled || g.poled) return g.poled ? [{ t: 'effect', name: 'poleRiver', full: false }] : [{ t: 'mutter' }];
    g.poled = true;
    clearHeld(g, word);
    return [{ t: 'hand' }, { t: 'effect', name: 'poleRiver', full: true }, { t: 'hint', key: 'poled' }, { t: 'beat', beat: 'poled' }];
  }
  return [{ t: 'mutter' }];
}

// —— 交互判定唯一入口（纯函数）：目标 id [+ 掉落的词具] → 事件指令 ——
// kit 的 E / 画布点击 / 拖放只负责把输入映射到 id；"没拼对 raft 词 → 困惑摇头、拼对 → 登筏"
// 这类规则只写在这一份，不许在 kit 里再写第二处判断。
// word 缺省取当前手持词具；拖放路径显式传入被拖的词。
export function interact(g, id, word = g.hand?.kind === 'item' ? g.hand.word : null) {
  switch (id) {
    case 'bench': return gameEvent(g, 'BANK');
    case 'creviceDoor': return gameEvent(g, 'ROOM', 'crevice');
    case 'bankDoor': return gameEvent(g, 'ROOM', 'bank');
    case 'creviceLog': return gameEvent(g, 'CREVICE');
    case 'water':
      if (word === 'log' || word === 'rope') return useItem(g, word, g.content.words[word].use.target);
      if (g.raftAssembled && g.raftRiderUnlocked) return gameEvent(g, 'BOARD');   // raftReady 提示承诺过：走到水边按 E 登筏
      return gameEvent(g, 'RAFT');
    case 'raft':
      return g.raftRiderUnlocked ? gameEvent(g, 'BOARD') : gameEvent(g, 'RAFT');
    case 'self':
      return word ? useItem(g, word, 'player') : [{ t: 'mutter' }];
    default:
      return [{ t: 'mutter' }];
  }
}

export function gameEvent(g, ev, arg = null) {
  switch (ev) {
    case 'ROOM':
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
        out.push(dropInstruction('raft', g.content.flows.raft.stones), { t: 'hint', key: 'raftListen' }, { t: 'beat', beat: 'raft' });
      }
      return out;
    }
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
    case 'BOARD': {
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
    case 'STALL':
      // 木筏停在停滞点：暗河授音（Pole.），壁龛/岩画皆为场景陈设，pole 用剩余音素拼出
      if (!g.embarked || g.poled || g.room !== 'deep') return [];
      g.stalled = true;
      g.beat = 'stalled';
      return [
        { t: 'speak', who: 'door', text: g.content.flows.pole.listen[0], slow: true },
        { t: 'hint', key: 'stalled' },
        { t: 'beat', beat: 'stalled' }
      ];
    case 'EXIT': {
      if (!g.poled || g.summary) return [];
      g.summary = true;
      g.beat = 'summary';
      return [{ t: 'summary' }, { t: 'hint', key: 'end' }, { t: 'beat', beat: 'summary' }];
    }
    case 'TICK': {
      g.teaseClock += Number(arg) || 0;
      if (g.teaseClock < 45 || g.summary) return [];
      g.teaseClock = 0;
      if (g.room === 'bank' && g.logsPlaced < LOGS_NEEDED) return [{ t: 'hint', key: 'start' }];
      if (!g.logDropped) return [{ t: 'hint', key: 'crevice' }];
      if (!g.book.has('log')) return [{ t: 'hint', key: 'craftLog' }];
      if (g.logsPlaced < LOGS_NEEDED) return [{ t: 'hint', key: 'log' }];
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
  if (word === 'log') out = out.concat(gameEvent(g, 'ROOM', 'crevice'), gameEvent(g, 'CREVICE'));
  if (word === 'raft') out = out.concat(gameEvent(g, 'RAFT'));
  const flow = g.content.flows[word];
  const source = flow?.stones?.length ? flow.stones : g.content.words[word].phonemes.map(([ipa]) => ipa);
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
      for (let i = 0; i < LOGS_NEEDED; i++) out = out.concat(gameEvent(g, 'USE', { word: 'log', target: 'bank' }));
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
      return ch3Debug(g, 'embarked').concat(gameEvent(g, 'STALL'));
    case 'poled': {
      let out = ch3Debug(g, 'stalled');
      out = out.concat(gameEvent(g, 'CRAFT', 'pole'));          // 剩下的 p·əʊ·l 恰好够拼
      return out.concat(gameEvent(g, 'USE', { word: 'pole', target: 'player' }));
    }
    case 'summary':
      return ch3Debug(g, 'poled').concat(gameEvent(g, 'EXIT'));
    default:
      return [];
  }
}
