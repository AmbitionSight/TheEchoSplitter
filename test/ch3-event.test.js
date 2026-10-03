// —— 直接单测 ch3 分层模块：event（绕过 ch3.js 兼容入口，锁死层边界）——
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createGame, startGame, gameEvent, ch3Debug, interact } from '../public/js/ch3/event.js';
import { stoneCount } from '../public/js/hotbar.js';

const content = JSON.parse(await readFile(new URL('../content/chapter3.json', import.meta.url), 'utf8'));
const profile = { everPicked: ['p', 'əʊ', 'r'], words: [], abilities: [], chaptersDone: [] };

function collect(g, word, stones) {
  let out = [];
  for (const ipa of stones) out = out.concat(gameEvent(g, 'PICKUP', ipa), gameEvent(g, 'BANK'));
  return out.concat(gameEvent(g, 'CRAFT', word));
}
function craftLog(g) {
  gameEvent(g, 'ROOM', 'crevice');
  gameEvent(g, 'CREVICE');
  collect(g, 'log', ['l', 'l', 'ɒ', 'g']);
}
const beatOf = out => out.find(i => i.t === 'beat')?.beat;

test('ch3/event 为纯模块：直接导入可用，开局播种与 beat 确定', () => {
  for (const fn of [createGame, startGame, gameEvent, ch3Debug]) {
    assert.equal(typeof fn, 'function');
  }
  const g = createGame(content, profile);
  assert.equal(g.room, 'bank');
  assert.equal(g.beat, 'bank');
  assert.equal(g.summary, false);
  assert.equal(g.hand, null);
  assert.equal(stoneCount(g.inv, 'p'), 2);
  assert.equal(stoneCount(g.inv, 'əʊ'), 2);
  assert.equal(stoneCount(g.inv, 'r'), 2);
  assert.deepEqual(startGame(g), [{ t: 'hint', key: 'start' }, { t: 'beat', beat: 'bank' }]);
});

test('裂隙：ROOM 切换房间，CREVICE 只掉一次 l,l,ɒ,g 并带 log 拍', () => {
  const g = createGame(content, profile);
  gameEvent(g, 'ROOM', 'crevice');
  assert.equal(g.room, 'crevice');
  assert.equal(g.beat, 'crevice');

  const out = gameEvent(g, 'CREVICE');
  assert.equal(g.logDropped, true);
  assert.deepEqual(out.find(i => i.t === 'drop')?.only, ['l', 'l', 'ɒ', 'g']);
  assert.equal(beatOf(out), 'log');
  assert.equal(gameEvent(g, 'CREVICE').filter(i => i.t === 'drop').length, 0, '不重复掉落');

  collect(g, 'log', ['l', 'l', 'ɒ', 'g']);
  assert.equal(g.inv.items.has('log'), true);
  assert.equal(g.book.has('log'), true);
  assert.equal(stoneCount(g.inv, 'l'), 1);
  assert.equal(stoneCount(g.inv, 'ɒ'), 0);
  assert.equal(stoneCount(g.inv, 'g'), 0);
});

test('岸边：合成 rope、放三根 log、用 rope 组装木筏（房间/手持字段随事件变化）', () => {
  const g = createGame(content, profile);
  craftLog(g);
  gameEvent(g, 'ROOM', 'bank');
  assert.equal(g.room, 'bank');
  assert.equal(g.beat, 'bank');

  gameEvent(g, 'CRAFT', 'rope');
  assert.equal(g.inv.items.has('rope'), true);
  assert.equal(stoneCount(g.inv, 'r'), 1);
  assert.equal(stoneCount(g.inv, 'əʊ'), 1);
  assert.equal(stoneCount(g.inv, 'p'), 1);

  gameEvent(g, 'HOLD_ITEM', 'log');
  assert.deepEqual(g.hand, { kind: 'item', word: 'log' });
  const first = gameEvent(g, 'USE', { word: 'log', target: 'bank' });
  assert.ok(first.some(i => i.t === 'effect' && i.name === 'placeLog' && i.full && i.slot === 1));
  assert.equal(g.logsPlaced, 1);
  assert.deepEqual(g.hand, { kind: 'item', word: 'log' }, '放满前词具保持在手，连按 E 连放');
  gameEvent(g, 'USE', { word: 'log', target: 'bank' });
  const third = gameEvent(g, 'USE', { word: 'log', target: 'bank' });
  assert.equal(g.logsPlaced, 3);
  assert.equal(g.hand, null, '放满三根后脱手');
  assert.ok(third.some(i => i.t === 'hint' && i.key === 'raft'));

  gameEvent(g, 'HOLD_ITEM', 'rope');
  const assembled = gameEvent(g, 'USE', { word: 'rope', target: 'logs' });
  assert.ok(assembled.some(i => i.t === 'effect' && i.name === 'assembleRaft' && i.full));
  assert.equal(g.raftAssembled, true);
  assert.equal(g.hand, null);
  assert.equal(g.inv.items.has('rope'), false, '组筏后绳索词具离栏');
  assert.equal(g.inv.items.has('log'), false, '三根放满后原木词具离栏');
});

test('三根门槛：绳在放满前只低语；放满后重复按 E 只轻响不再放置', () => {
  const g = createGame(content, profile);
  craftLog(g);
  gameEvent(g, 'ROOM', 'bank');
  gameEvent(g, 'CRAFT', 'rope');
  gameEvent(g, 'HOLD_ITEM', 'rope');
  assert.deepEqual(gameEvent(g, 'USE', { word: 'rope', target: 'logs' }), [{ t: 'mutter' }]);
  assert.equal(g.raftAssembled, false);

  gameEvent(g, 'HOLD_ITEM', 'log');
  gameEvent(g, 'USE', { word: 'log', target: 'bank' });
  gameEvent(g, 'USE', { word: 'log', target: 'bank' });
  assert.deepEqual(gameEvent(g, 'USE', { word: 'rope', target: 'logs' }), [{ t: 'mutter' }], '两根仍不够');

  gameEvent(g, 'USE', { word: 'log', target: 'bank' });
  assert.equal(g.logsPlaced, 3);
  assert.equal(g.inv.items.has('log'), false, '三根放满原木离栏');
  assert.deepEqual(gameEvent(g, 'HOLD_ITEM', 'log'), [], '耗尽后无法再拿起');
  assert.deepEqual(gameEvent(g, 'USE', { word: 'log', target: 'bank' }), [{ t: 'mutter' }]);
  assert.equal(g.logsPlaced, 3, '不超放');
});

test('三房间主线 happy path：跨关收集 → bank → raft → 深处 → pole → 结算', () => {
  const g = createGame(content, profile);

  // 一幕：裂隙拾取 log
  gameEvent(g, 'ROOM', 'crevice');
  assert.equal(g.room, 'crevice');
  const cv = gameEvent(g, 'CREVICE');
  assert.equal(g.logDropped, true);
  assert.deepEqual(cv.find(i => i.t === 'drop')?.only, ['l', 'l', 'ɒ', 'g']);
  collect(g, 'log', ['l', 'l', 'ɒ', 'g']);
  assert.equal(g.inv.items.has('log'), true);

  // 二幕：岸边合成 rope 并组装
  gameEvent(g, 'ROOM', 'bank');
  assert.equal(g.room, 'bank');
  gameEvent(g, 'CRAFT', 'rope');
  gameEvent(g, 'HOLD_ITEM', 'log');
  gameEvent(g, 'USE', { word: 'log', target: 'bank' });
  gameEvent(g, 'USE', { word: 'log', target: 'bank' });
  gameEvent(g, 'USE', { word: 'log', target: 'bank' });
  gameEvent(g, 'HOLD_ITEM', 'rope');
  gameEvent(g, 'USE', { word: 'rope', target: 'logs' });
  assert.equal(g.logsPlaced, 3);
  assert.equal(g.raftAssembled, true);

  // 试探木筏：掉 æ,f,t → 合成 raft → 对自己使用解锁
  const raft = gameEvent(g, 'RAFT');
  assert.deepEqual(raft.find(i => i.t === 'drop')?.only, ['æ', 'f', 't']);
  assert.equal(beatOf(raft), 'raft');
  collect(g, 'raft', ['æ', 'f', 't']);
  assert.equal(g.inv.items.has('raft'), true);
  assert.equal(stoneCount(g.inv, 'r'), 0);
  const unlock = gameEvent(g, 'USE', { word: 'raft', target: 'player' });
  assert.ok(unlock.some(i => i.t === 'effect' && i.name === 'raftRiderUnlock' && i.full));
  assert.equal(g.raftRiderUnlocked, true);

  // 登筏 → 三幕 deep
  const board = gameEvent(g, 'BOARD');
  assert.equal(g.embarked, true);
  assert.equal(g.room, 'deep');
  assert.equal(g.beat, 'deep');
  assert.ok(board.some(i => i.t === 'effect' && i.name === 'roomTransition' && i.room === 'deep'));
  assert.ok(board.some(i => i.t === 'effect' && i.name === 'embark' && i.full));

  // 停滞即授音 → 剩下的 p·əʊ·l 恰好拼出 pole → 撑篙
  const stall = gameEvent(g, 'STALL');
  assert.equal(g.stalled, true);
  assert.equal(g.beat, 'stalled');
  assert.ok(stall.some(i => i.t === 'speak' && i.text === 'Pole.'), '停筏授音');
  gameEvent(g, 'CRAFT', 'pole');
  assert.equal(g.inv.items.has('pole'), true);
  const poled = gameEvent(g, 'USE', { word: 'pole', target: 'player' });
  assert.ok(poled.some(i => i.t === 'effect' && i.name === 'poleRiver' && i.full));
  assert.equal(g.poled, true);
  assert.equal(beatOf(poled), 'poled');

  // 结算
  const end = gameEvent(g, 'EXIT');
  assert.ok(end.some(i => i.t === 'summary'));
  assert.equal(g.summary, true);
  assert.equal(g.beat, 'summary');
  assert.equal(g.room, 'deep');
  assert.deepEqual(gameEvent(g, 'EXIT'), [], '结算幂等');
});

test('interact：木筏判定唯一入口——未拼对困惑摇头，拼对并解锁后登筏', () => {
  const g = createGame(content, profile);
  ch3Debug(g, 'assembled');                          // 筏已组装，raft 词未拼
  const puzzled = interact(g, 'raft');
  assert.ok(puzzled.some(i => i.t === 'shrug'), '困惑摇头');
  assert.ok(puzzled.some(i => i.t === 'bubble'), '红叉气泡（不会）');
  assert.ok(puzzled.some(i => i.t === 'drop'), '首探掉 æ,f,t');
  assert.equal(gameEvent(g, 'RAFT').filter(i => i.t === 'drop').length, 0, '再探不重复掉落');
  assert.equal(gameEvent(g, 'BOARD').length, 0, '未解锁不得登筏');

  ch3Debug(g, 'raft-unlocked');                      // 拼出 raft 词并对自己使用
  const boardWater = interact(g, 'water');
  assert.ok(boardWater.some(i => i.t === 'effect' && i.name === 'embark'), '解锁后水边按 E = 登筏（raftReady 提示承诺的行为）');
  assert.equal(g.embarked, true);

  const g2 = createGame(content, profile);
  ch3Debug(g2, 'raft-unlocked');
  assert.ok(interact(g2, 'raft').some(i => i.t === 'effect' && i.name === 'roomTransition'), '解锁后 E 木筏 = 登筏');
  assert.equal(g2.embarked, true);
});

test('interact：水边与自身共用一份词具规则', () => {
  const g = createGame(content, profile);
  ch3Debug(g, 'crafted');
  gameEvent(g, 'ROOM', 'bank');
  gameEvent(g, 'HOLD_ITEM', 'log');
  assert.ok(interact(g, 'water').some(i => i.t === 'effect' && i.name === 'placeLog' && i.full && i.slot === 1));
  assert.ok(interact(g, 'water').some(i => i.t === 'effect' && i.name === 'placeLog' && i.full && i.slot === 2), '手持词具连放');
  assert.ok(interact(g, 'self').every(i => i.t === 'mutter'), 'log 对自己 = 低语（目标不符）');
  interact(g, 'water');                              // 第三根，放满脱手
  assert.equal(g.logsPlaced, 3);
  assert.equal(g.hand, null);
  gameEvent(g, 'HOLD_ITEM', 'rope');
  assert.ok(interact(g, 'water').some(i => i.t === 'effect' && i.name === 'assembleRaft' && i.full), '绳子交给水边组装');
  assert.ok(interact(g, 'self', 'pole').every(i => i.t === 'mutter'), '未持有的词对自身 = 低语');
  assert.deepEqual(interact(g, 'self'), [{ t: 'mutter' }], '空手对自己 = 低语');
});

test('interact：门与裂隙木头的转发', () => {
  const g = createGame(content, profile);
  assert.ok(interact(g, 'creviceDoor').some(i => i.t === 'effect' && i.name === 'roomTransition'));
  assert.equal(g.room, 'crevice');
  assert.ok(interact(g, 'creviceLog').some(i => i.t === 'drop'), 'E 裂隙木头 = CREVICE 掉落');
  assert.ok(interact(g, 'bankDoor').some(i => i.t === 'effect' && i.name === 'roomTransition'));
  assert.equal(g.room, 'bank');
});

test('守卫：目标不符/缺词只低语，未解锁不推进房间', () => {
  const g = createGame(content, profile);
  assert.deepEqual(gameEvent(g, 'USE', { word: 'log', target: 'logs' }), [{ t: 'mutter' }]);
  assert.deepEqual(gameEvent(g, 'USE', { word: 'log', target: 'bank' }), [{ t: 'mutter' }]);
  assert.deepEqual(gameEvent(g, 'USE', { word: 'raft', target: 'player' }), [{ t: 'mutter' }]);
  assert.deepEqual(gameEvent(g, 'BOARD'), []);
  assert.equal(g.room, 'bank');
  assert.equal(g.embarked, false);
  assert.deepEqual(gameEvent(g, 'USE', null), [{ t: 'mutter' }]);
});
