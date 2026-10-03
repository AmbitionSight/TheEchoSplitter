import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createGame, startGame, gameEvent, ch3Debug, kit } from '../public/js/ch3.js';
import { stoneCount, addStone } from '../public/js/hotbar.js';

const content = JSON.parse(await readFile(new URL('../content/chapter3.json', import.meta.url), 'utf8'));
const profile = { everPicked: ['p', 'əʊ', 'r'], words: [], abilities: [], chaptersDone: [] };

function collect(g, word, stones) {
  let out = [];
  for (const ipa of stones) out = out.concat(gameEvent(g, 'PICKUP', ipa), gameEvent(g, 'BANK'));
  return out.concat(gameEvent(g, 'CRAFT', word));
}

function setUpRaft(g) {
  gameEvent(g, 'ROOM', 'crevice');
  gameEvent(g, 'CREVICE');
  for (const ipa of ['l', 'l', 'ɒ', 'g']) gameEvent(g, 'PICKUP', ipa), gameEvent(g, 'BANK');
  gameEvent(g, 'CRAFT', 'log');
  gameEvent(g, 'ROOM', 'bank');
  gameEvent(g, 'CRAFT', 'rope');
  gameEvent(g, 'HOLD_ITEM', 'log');
  gameEvent(g, 'USE', { word: 'log', target: 'bank' });
  gameEvent(g, 'HOLD_ITEM', 'rope');
  gameEvent(g, 'USE', { word: 'rope', target: 'logs' });
}

test('开局播种：p、əʊ、r 各有两颗记忆石', () => {
  const g = createGame(content, profile);
  assert.equal(stoneCount(g.inv, 'p'), 2);
  assert.equal(stoneCount(g.inv, 'əʊ'), 2);
  assert.equal(stoneCount(g.inv, 'r'), 2);
  assert.deepEqual(startGame(g), [{ t: 'hint', key: 'start' }, { t: 'beat', beat: 'bank' }]);
});

test('进入裂隙：Log 只低语一次并掉 l、l、ɒ、g', () => {
  const g = createGame(content, profile);
  gameEvent(g, 'ROOM', 'crevice');
  const out = gameEvent(g, 'CREVICE');
  assert.equal(g.logDropped, true);
  assert.deepEqual(out.find(i => i.t === 'drop').only, ['l', 'l', 'ɒ', 'g']);
  assert.equal(gameEvent(g, 'CREVICE').filter(i => i.t === 'drop').length, 0);
});

test('合成 log 与 rope：精确消耗音素且不允许负数', () => {
  const g = createGame(content, profile);
  gameEvent(g, 'ROOM', 'crevice'); gameEvent(g, 'CREVICE');
  for (const ipa of ['l', 'l', 'ɒ', 'g']) gameEvent(g, 'PICKUP', ipa), gameEvent(g, 'BANK');
  gameEvent(g, 'CRAFT', 'log');
  assert.equal(g.inv.items.has('log'), true);
  assert.equal(stoneCount(g.inv, 'l'), 1);
  assert.equal(stoneCount(g.inv, 'ɒ'), 0);
  assert.equal(stoneCount(g.inv, 'g'), 0);
  assert.equal(stoneCount(g.inv, 'p'), 2);
  assert.equal(stoneCount(g.inv, 'əʊ'), 2);
  assert.equal(stoneCount(g.inv, 'r'), 2);
  gameEvent(g, 'CRAFT', 'rope');
  assert.equal(g.inv.items.has('rope'), true);
  assert.equal(stoneCount(g.inv, 'r'), 1);
  assert.equal(stoneCount(g.inv, 'əʊ'), 1);
  assert.equal(stoneCount(g.inv, 'p'), 1);
  assert.ok([...g.inv.stones.values()].every(n => n >= 0));
});

test('木筏组装：放置 log、使用 rope 后 raftAssembled', () => {
  const g = createGame(content, profile);
  setUpRaft(g);
  assert.equal(g.logPlaced, true);
  assert.equal(g.raftAssembled, true);
  assert.ok(gameEvent(g, 'USE', { word: 'rope', target: 'logs' }).some(i => i.t === 'mutter'));
});

test('试探木筏：掉 æ、f、t；合成 raft 并对自己使用解锁', () => {
  const g = createGame(content, profile);
  setUpRaft(g);
  const out = gameEvent(g, 'RAFT');
  assert.ok(out.some(i => i.t === 'shrug'));
  assert.deepEqual(out.find(i => i.t === 'drop').only, ['æ', 'f', 't']);
  for (const ipa of ['æ', 'f', 't']) gameEvent(g, 'PICKUP', ipa), gameEvent(g, 'BANK');
  gameEvent(g, 'CRAFT', 'raft');
  assert.equal(stoneCount(g.inv, 'r'), 0);
  assert.equal(g.inv.items.has('raft'), true);
  gameEvent(g, 'HOLD_ITEM', 'raft');
  const unlock = gameEvent(g, 'USE', { word: 'raft', target: 'player' });
  assert.ok(unlock.some(i => i.t === 'effect' && i.name === 'raftRiderUnlock' && i.full));
  assert.equal(g.raftRiderUnlocked, true);
  assert.equal(g.hand, null);
});

test('全流程：登筏、深处停滞、pole 撑篙、驶出并结算', () => {
  const g = createGame(content, profile);
  setUpRaft(g);
  gameEvent(g, 'RAFT');
  for (const ipa of ['æ', 'f', 't']) gameEvent(g, 'PICKUP', ipa), gameEvent(g, 'BANK');
  gameEvent(g, 'CRAFT', 'raft');
  gameEvent(g, 'USE', { word: 'raft', target: 'player' });
  const board = gameEvent(g, 'BOARD');
  assert.equal(g.embarked, true);
  assert.equal(g.room, 'deep');
  assert.ok(board.some(i => i.t === 'effect' && i.name === 'roomTransition'));
  gameEvent(g, 'STALL');
  assert.equal(g.stalled, true);
  const pole = gameEvent(g, 'POLE');
  assert.deepEqual(pole.find(i => i.t === 'drop').only, ['l']);
  gameEvent(g, 'PICKUP', 'l'); gameEvent(g, 'BANK');
  gameEvent(g, 'CRAFT', 'pole');
  gameEvent(g, 'USE', { word: 'pole', target: 'player' });
  assert.equal(g.poled, true);
  const end = gameEvent(g, 'EXIT');
  assert.ok(end.some(i => i.t === 'summary'));
  assert.equal(g.summary, true);
  assert.equal(g.beat, 'summary');
  assert.deepEqual(gameEvent(g, 'EXIT'), []);
});

test('ch3Debug：各跳拍通过真实事件推进状态', () => {
  for (const [beat, check] of [
    ['logged', g => g.logDropped],
    ['crafted', g => g.inv.items.has('rope')],
    ['assembled', g => g.raftAssembled],
    ['raft-unlocked', g => g.raftRiderUnlocked],
    ['embarked', g => g.embarked && g.room === 'deep'],
    ['stalled', g => g.stalled],
    ['poled', g => g.poled],
    ['summary', g => g.summary]
  ]) {
    const g = createGame(content, profile);
    ch3Debug(g, beat);
    assert.equal(check(g), true, `debug beat ${beat}`);
  }
});

test('第三章 E 交互：入口与裂隙合成台都有可识别目标', () => {
  const g = createGame(content, profile);
  const w = {
    game: g,
    player: { x: 560, y: 590 },
    geo: content.geometry,
    currentRoom: 'bank',
    transition: null,
    stones: [],
    raft: { x: content.geometry.bank.raftX, y: 566 }
  };
  assert.equal(kit.findE(w).id, 'creviceDoor');

  g.room = 'crevice';
  w.currentRoom = 'crevice';
  w.player.x = content.geometry.crevice.benchX;
  assert.equal(kit.findE(w).id, 'bench');
});

test('暗河停滞：玩家离开木筏后恢复地面移动，合成台可用 E 存石', () => {
  const g = createGame(content, profile);
  ch3Debug(g, 'stalled');
  const player = { x: 700, y: 562, airborne: false, moving: true, dir: 'right', facing: 1, walkT: 0 };
  const w = {
    game: g,
    player,
    actors: { npc: { gestureT: 0, gestureDur: 1, mouth: 0 }, cat: { earT: 0, meowT: 0 } },
    geo: content.geometry,
    currentRoom: 'deep',
    stones: [],
    raft: { x: 760, y: 566, bob: 0 },
    transition: null,
    view: { t: 0, fadeAlpha: 0, bubbleT: 0, shrugT: 0, bulbT: 0, poleT: 0, puffs: [] },
    keys: new Set(['l']),
    cfg: { speed: 300 }
  };
  kit.tick(w, 0.1);
  assert.equal(player.y, content.geometry.deep.groundY);
  assert.equal(player.moving, true);
  assert.ok(player.x < 700);
  assert.equal(kit.findE({ ...w, player: { ...player, x: content.geometry.deep.benchX } }).id, 'bench');
});

test('内容：四词、carrier、flow、三房间 geometry 与无 emoji', () => {
  assert.deepEqual(Object.keys(content.words).sort(), ['log', 'pole', 'raft', 'rope']);
  for (const [word, def] of Object.entries(content.words)) {
    assert.ok(content.flows[word]);
    for (const [ipa] of def.phonemes) assert.ok(content.carriers[ipa], `${word}.${ipa}`);
  }
  assert.ok(content.geometry.bank && content.geometry.crevice && content.geometry.deep);
  assert.equal(content.geometry.crevice.benchX, 300);
  assert.ok(!/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(JSON.stringify(content)));
});
