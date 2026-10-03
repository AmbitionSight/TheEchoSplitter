import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createGame, startGame, gameEvent, ch3Debug, kit } from '../public/js/ch3.js';
import { stoneCount, addStone } from '../public/js/hotbar.js';
import { spawnSideStone } from '../public/js/sideview.js';

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
  for (let i = 0; i < 3; i++) gameEvent(g, 'USE', { word: 'log', target: 'bank' });
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

test('木筏组装：三根原木并排放满、使用 rope 后 raftAssembled 且词具离栏', () => {
  const g = createGame(content, profile);
  setUpRaft(g);
  assert.equal(g.logsPlaced, 3);
  assert.equal(g.raftAssembled, true);
  assert.equal(g.inv.items.has('rope'), false, '绳索耗尽离栏');
  assert.equal(g.inv.items.has('log'), false, '原木耗尽离栏');
  assert.ok(gameEvent(g, 'USE', { word: 'rope', target: 'logs' }).some(i => i.t === 'mutter'));
});

test('三根原木：手持词具连按三次 E 逐根放置，放满才脱手', () => {
  const g = createGame(content, profile);
  gameEvent(g, 'ROOM', 'crevice'); gameEvent(g, 'CREVICE');
  for (const ipa of ['l', 'l', 'ɒ', 'g']) gameEvent(g, 'PICKUP', ipa), gameEvent(g, 'BANK');
  gameEvent(g, 'CRAFT', 'log');
  gameEvent(g, 'ROOM', 'bank');
  gameEvent(g, 'HOLD_ITEM', 'log');
  for (let n = 1; n <= 2; n++) {
    const out = gameEvent(g, 'USE', { word: 'log', target: 'bank' });
    assert.ok(out.some(i => i.t === 'effect' && i.name === 'placeLog' && i.full && i.slot === n), `第 ${n} 根`);
    assert.equal(g.logsPlaced, n);
    assert.deepEqual(g.hand, { kind: 'item', word: 'log' }, '放满前词具不脱手');
  }
  const third = gameEvent(g, 'USE', { word: 'log', target: 'bank' });
  assert.ok(third.some(i => i.t === 'effect' && i.name === 'placeLog' && i.full && i.slot === 3));
  assert.ok(third.some(i => i.t === 'hint' && i.key === 'raft'));
  assert.equal(g.logsPlaced, 3);
  assert.equal(g.hand, null, '放满三根后脱手');
  assert.equal(g.inv.items.has('log'), false, '三根放满原木词具离栏');

  assert.deepEqual(gameEvent(g, 'HOLD_ITEM', 'log'), [], '耗尽后无法再拿起');
  assert.deepEqual(gameEvent(g, 'USE', { word: 'log', target: 'bank' }), [{ t: 'mutter' }]);
  assert.equal(g.logsPlaced, 3);
});

test('绳子在三根原木放满前不能组筏', () => {
  const g = createGame(content, profile);
  gameEvent(g, 'ROOM', 'crevice'); gameEvent(g, 'CREVICE');
  for (const ipa of ['l', 'l', 'ɒ', 'g']) gameEvent(g, 'PICKUP', ipa), gameEvent(g, 'BANK');
  gameEvent(g, 'CRAFT', 'log');
  gameEvent(g, 'ROOM', 'bank');
  gameEvent(g, 'CRAFT', 'rope');
  gameEvent(g, 'HOLD_ITEM', 'rope');
  assert.deepEqual(gameEvent(g, 'USE', { word: 'rope', target: 'logs' }), [{ t: 'mutter' }]);
  gameEvent(g, 'HOLD_ITEM', 'log');
  gameEvent(g, 'USE', { word: 'log', target: 'bank' });
  gameEvent(g, 'USE', { word: 'log', target: 'bank' });
  assert.deepEqual(gameEvent(g, 'USE', { word: 'rope', target: 'logs' }), [{ t: 'mutter' }], '两根仍不够');
  assert.equal(g.raftAssembled, false);
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
  const stall = gameEvent(g, 'STALL');
  assert.equal(g.stalled, true);
  assert.ok(stall.some(i => i.t === 'speak' && i.text === 'Pole.'), '停筏即授音');
  gameEvent(g, 'CRAFT', 'pole');                    // 剩下的 p·əʊ·l 恰好够拼
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

test('第三关跳跃：步行态空格起跳，航行中不跳，停滞落地后可跳', () => {
  const mkW = (g, currentRoom) => ({
    game: g, currentRoom, transition: null,
    sfx: { click() {} },
    player: { x: 300, y: 590, vy: 0, airborne: false, climbing: false }
  });
  const w1 = mkW(createGame(content, profile), 'bank');
  kit.onSpace(w1);
  assert.equal(w1.player.airborne, true);
  assert.equal(w1.player.vy, -740);

  const g2 = createGame(content, profile);
  ch3Debug(g2, 'embarked');                        // 航行中
  const w2 = mkW(g2, 'deep');
  kit.onSpace(w2);
  assert.equal(w2.player.airborne, false, '筏上不跳');

  const g3 = createGame(content, profile);
  ch3Debug(g3, 'stalled');                         // 停滞（已落地）
  const w3 = mkW(g3, 'deep');
  kit.onSpace(w3);
  assert.equal(w3.player.airborne, true, '停滞落地后可跳');
});

test('停滞期跳跃：从筏面起跳落回筏面，不被压回水面', () => {
  const g = createGame(content, profile);
  ch3Debug(g, 'stalled');
  const player = { x: 760, y: 570, airborne: false, moving: false, dir: 'right', facing: 1, walkT: 0, vy: 0 };
  const w = {
    game: g,
    player,
    actors: { npc: { gestureT: 0, gestureDur: 1, mouth: 0 }, cat: { earT: 0, meowT: 0 } },
    geo: content.geometry,
    currentRoom: 'deep',
    stones: [],
    raft: { x: 760, y: 584, bob: 0 },
    transition: null,
    view: { t: 0, fadeAlpha: 0, bubbleT: 0, shrugT: 0, bulbT: 0, poleT: 0, puffs: [] },
    keys: new Set(),
    cfg: { speed: 300 },
    sfx: { click() {}, water() {} }
  };
  kit.onSpace(w);
  assert.equal(player.airborne, true);
  kit.tick(w, 0.05);
  assert.ok(player.y < 570, '起跳后离地');
  for (let i = 0; i < 60; i++) kit.tick(w, 0.05);  // 重力落回
  assert.equal(player.airborne, false);
  assert.equal(player.y, w.raft.y - 14, '落回筏面而非水面');
  assert.equal(w.view.puffs.length, 0, '没有落水');
});

test('木筏停在水面上：makeWorld 筏底吃水而非悬空', () => {
  const g = createGame(content, profile);
  const w = kit.makeWorld({ content, game: g, cv: null });
  assert.equal(w.raft.y, content.geometry.bank.groundY - 6);
});

test('跳上木筏：短移落在筏面，一直右移落水被冲回滩涂', () => {
  const g = createGame(content, profile);
  ch3Debug(g, 'raft-unlocked');                    // 岸边、筏已组装并解锁
  const mkW = () => {
    const w = kit.makeWorld({ content, game: g, cv: null });
    w.game = g;                                    // 壳在 makeWorld 之后回填的引用，测试补齐
    w.sfx = { click() {}, water() {} };
    w.keys = new Set();
    Object.assign(w.player, { x: 754, y: 590, airborne: false, moving: false, dir: 'right', facing: 1, walkT: 0, vy: 0 });
    return w;
  };
  // 短按右（~0.4s）后松开：下落穿越筏面 → 落在筏上
  const w1 = mkW();
  kit.onSpace(w1);
  w1.keys.add('r');
  for (let i = 0; i < 25; i++) kit.tick(w1, 0.016);
  w1.keys.delete('r');
  let guard = 0;
  while (w1.player.airborne && guard++ < 120) kit.tick(w1, 0.016);
  assert.equal(w1.player.airborne, false);
  assert.equal(w1.player.y, w1.raft.y - 14, '站在筏面上');
  assert.ok(w1.player.x > w1.raft.x - 90 && w1.player.x < w1.raft.x + 90, '落在筏面范围内');
  // 一直按右：飞越木筏落水 → 溅水花冲回滩涂
  const w2 = mkW();
  kit.onSpace(w2);
  w2.keys.add('r');
  guard = 0;
  do { kit.tick(w2, 0.016); } while (w2.player.airborne && guard++ < 120);
  assert.equal(w2.player.airborne, false);
  assert.equal(w2.player.y, content.geometry.bank.groundY);
  assert.equal(w2.player.x, content.geometry.bank.waterX - 40, '落水被冲回滩涂');
  assert.equal(w2.view.puffs.length > 0, true, '溅起水花');
});

test('岸边音素石不入水：越线石头被推回滩涂', () => {
  const g = createGame(content, profile);
  const w = kit.makeWorld({ content, game: g, cv: null });
  w.game = g;
  w.keys = new Set();
  spawnSideStone(w.stones, 't', 900, 400, 0, 0);
  for (let i = 0; i < 80; i++) kit.tick(w, 0.016);
  const s = w.stones[0];
  assert.equal(s.state, 'idle');
  assert.ok(s.x <= content.geometry.bank.waterX - 6, `石头落在滩涂上：${s.x}`);
});

test('E 目标审计：无锚点目标全部移除，self 仅在手持词具时出现', () => {
  const g = createGame(content, profile);
  const w = kit.makeWorld({ content, game: g, cv: null });
  w.game = g;
  w.keys = new Set();
  w.transition = null;
  // 裂隙出生点（150）：左壁回程门已绘制，可及
  w.currentRoom = 'crevice';
  Object.assign(w.player, { x: content.geometry.crevice.spawnX, y: 590 });
  assert.equal(kit.findE(w).id, 'bankDoor', '左壁回程门在出生点可及');
  // 岸边目标间隙（460）：合成台 278..442 与裂隙口 480..660 之间，空手无目标
  w.currentRoom = 'bank';
  Object.assign(w.player, { x: 460, y: 590 });
  assert.equal(kit.findE(w), null, '空手按 E 不再凭空出目标');
  // 木筏未组装时筏锚不是目标；组装后是
  Object.assign(w.player, { x: content.geometry.bank.raftX, y: 590 });
  assert.equal(kit.findE(w), null, '未组装无筏目标');
  ch3Debug(g, 'assembled');
  assert.equal(kit.findE(w).id, 'raft');
  // 深水段不再设 E 目标；手持词具时自身才成为目标（debug 链须从新档起跳）
  w.currentRoom = 'deep';
  w.raft.x = content.geometry.deep.stallX;
  const gDeep = createGame(content, profile);
  ch3Debug(gDeep, 'stalled');
  w.game = gDeep;
  Object.assign(w.player, { x: content.geometry.deep.stallX, y: 590 });
  assert.equal(kit.findE(w), null, '暗河无 E 目标');
  gameEvent(gDeep, 'HOLD_ITEM', 'raft');          // 深水起点 log/rope 已按新规则耗尽，raft 词具仍在
  assert.equal(kit.findE(w).id, 'self', '手持词具时自身才成为目标');
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

test('暗河停滞：只能在筏面行走，落水冲回筏上，壁龛在筏上够得到', () => {
  const g = createGame(content, profile);
  ch3Debug(g, 'stalled');
  const player = { x: 760, y: 570, airborne: false, moving: false, dir: 'left', facing: -1, walkT: 0, vy: 0 };
  const w = {
    game: g,
    player,
    actors: { npc: { gestureT: 0, gestureDur: 1, mouth: 0 }, cat: { earT: 0, meowT: 0 } },
    geo: content.geometry,
    currentRoom: 'deep',
    stones: [],
    raft: { x: 760, y: 584, bob: 0 },
    transition: null,
    view: { t: 0, fadeAlpha: 0, bubbleT: 0, shrugT: 0, bulbT: 0, poleT: 0, puffs: [] },
    keys: new Set(['l']),
    cfg: { speed: 300 },
    sfx: { click() {}, water() {} }
  };
  kit.tick(w, 0.05);
  assert.equal(player.y, w.raft.y - 14, '在筏面行走');
  assert.equal(player.moving, true);
  for (let i = 0; i < 12; i++) kit.tick(w, 0.05);   // 走出筏缘并落水
  let guard = 0;
  while ((player.x !== w.raft.x || player.y !== w.raft.y - 14) && guard++ < 200) kit.tick(w, 0.05);
  assert.equal(player.x, w.raft.x, '落水后被冲回筏上');
  assert.equal(player.y, w.raft.y - 14, '回到筏面');
  assert.ok(w.view.puffs.length > 0, '溅起水花');
  // 暗河不再设任何 E 目标（授音随 STALL 自动播放，pole 用背包剩余音素拼出）
  assert.equal(kit.findE({ ...w, player: { ...player, x: content.geometry.deep.benchX } }), null);
  assert.equal(kit.findE({ ...w, player: { ...player, x: 849 } }), null);
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

test('第三关 recap：三段回顾数据齐备，词都能解析到图标（只出图标不写字）', async () => {
  const recap = content.recap;
  assert.equal(recap?.slides?.length, 3, '三段：石室 / 裂谷·崖壁 / 暗河');
  for (const s of recap.slides) {
    assert.ok(s.day && s.place, '每段有日名与地点');
    for (const w of s.words) assert.ok(content.words[w] ?? content.lexicon?.[w], `${w} 缺图标来源`);
  }
  assert.ok(recap.end, '有收束句');
  const ui = await readFile(new URL('../public/js/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /function recap\(/, 'ui 提供 recap');
  assert.match(ui, /rc-icons[\s\S]{0,600}<img src=/, '回顾以图标呈现词');
  const shell = await readFile(new URL('../public/js/shell.js', import.meta.url), 'utf8');
  assert.match(shell, /content\.recap\)\s*setTimeout|setTimeout\(\(\) => ui\.recap\(content\.recap\)/, '壳在收尾自动播放');
});

test('第三关 recap：绘制时必须去掉 hidden（回归：曾漏这行导致走马灯永不显示）', async () => {
  const ui = await readFile(new URL('../public/js/ui.js', import.meta.url), 'utf8');
  assert.match(ui, /rcEl\.classList\.remove\('hidden'\)/, 'recapPaint 要亮出 #recap');
});
