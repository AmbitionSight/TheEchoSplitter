import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { createGame, startGame, gameEvent, chooseTease, jump } from '../public/js/main.js';

const content = JSON.parse(await readFile(new URL('../content/chapter1.json', import.meta.url), 'utf8'));
const seq = w => content.words[w].phonemes.map(p => p[0]);

function collect(g, word) { // 模拟：碰来源→捡全部石→合成
  const [id] = Object.entries(content.explorables).find(([, ex]) => ex.word === word);
  let out = gameEvent(g, 'INTERACT', id);
  for (const [ipa] of content.words[word].phonemes) out = out.concat(gameEvent(g, 'PICKUP', ipa));
  return out.concat(gameEvent(g, 'CRAFT', word));
}

test('开局：大叔只出声招手，提示「走过去点他」', () => {
  const g = createGame(content);
  const out = startGame(g);
  assert.ok(out.some(i => i.t === 'speak' && i.who === 'uncle' && i.text === 'Hello! Hello!'));
  assert.ok(out.some(i => i.t === 'hint' && i.key === 'hello'));
});

test('首点大叔：hello 入书 + 掉四石 + 进入自由探索', () => {
  const g = createGame(content);
  const out = gameEvent(g, 'INTERACT', 'npc');
  assert.ok(g.book.has('hello'));
  assert.ok(out.some(i => i.t === 'drop' && i.word === 'hello'));
  assert.equal(g.beat, 'explore-left');
});

test('黑暗中帽架不可交互；点亮后可碰', () => {
  const g = createGame(content);
  assert.ok(gameEvent(g, 'INTERACT', 'hatstand').some(i => i.t === 'blocked'));
  g.lit = true;
  assert.ok(gameEvent(g, 'INTERACT', 'hatstand').some(i => i.t === 'drop' && i.word === 'hat'));
});

test('首石：工具栏滑入恰好一次；合成 light 聪明路径可行', () => {
  const g = createGame(content);
  let all = [];
  for (const w of ['hello', 'fire', 'water']) all = all.concat(collect(g, w)); // l/hello aɪ/fire t/water
  assert.equal(all.filter(i => i.t === 'hotbarShow').length, 1);  // 首颗石时滑入一次
  for (const ipa of ['l', 'aɪ', 't']) all = all.concat(gameEvent(g, 'PICKUP', ipa));
  const out = gameEvent(g, 'CRAFT', 'light');
  assert.ok(g.inv.items.has('light') && g.book.has('light'));
  assert.ok(out.some(i => i.t === 'resonate' && i.word === 'light'));
  assert.ok(out.some(i => i.t === 'speak' && i.who === 'child'));
});

test('USE：词具匹配目标才生效；首次 full、重复轻反应；拖错咕哝', () => {
  const g = createGame(content);
  collect(g, 'hello'); collect(g, 'fire'); collect(g, 'water');
  for (const ipa of ['l', 'aɪ', 't']) gameEvent(g, 'PICKUP', ipa);
  gameEvent(g, 'CRAFT', 'light');
  let out = gameEvent(g, 'USE', { word: 'light', target: 'well' });
  assert.ok(out.some(i => i.t === 'mutter'));
  out = gameEvent(g, 'USE', { word: 'light', target: 'lamp' });
  assert.equal(g.lit, true);
  assert.ok(out.some(i => i.t === 'effect' && i.name === 'illuminate' && i.full === true));
  out = gameEvent(g, 'USE', { word: 'light', target: 'lamp' });
  assert.ok(out.some(i => i.t === 'effect' && i.full === false));
});

test('门醒需 5 词；点击低语并只掉一次 open 石；全链路到结算', () => {
  const g = createGame(content);
  for (const w of ['hello', 'water', 'fire', 'light']) collect(g, w);
  assert.equal(g.door.state, 'asleep');
  collect(g, 'hat');                                             // 第 5 词入书
  assert.equal(g.door.state, 'pulsing');
  let out = gameEvent(g, 'DOOR_CLICK');
  assert.ok(out.some(i => i.t === 'drop' && i.word === 'open'));
  assert.ok(out.some(i => i.t === 'speak' && i.who === 'door'));
  out = gameEvent(g, 'DOOR_CLICK');
  assert.ok(!out.some(i => i.t === 'drop'));                     // 反复听，不再掉
  for (const [ipa] of content.words.open.phonemes) gameEvent(g, 'PICKUP', ipa); // 门词无探索点：显式捡门石
  gameEvent(g, 'CRAFT', 'open');
  out = gameEvent(g, 'USE', { word: 'open', target: 'door' });
  assert.ok(out.some(i => i.t === 'ritualStart'));
  gameEvent(g, 'RITUAL_DONE');
  assert.equal(g.door.state, 'opening');
  out = gameEvent(g, 'OPEN_DONE');
  assert.ok(out.some(i => i.t === 'summary'));
  assert.equal(g.book.size, 6);
});

test('乱序合成无死局：收齐全部石后按倒序拼，六词全成（规格 §3.2）', () => {
  const g = createGame(content);
  const sources = ['hello', 'water', 'fire', 'light', 'hat'];
  for (const w of sources) {
    const [id] = Object.entries(content.explorables).find(([, ex]) => ex.word === w);
    if (id === 'hatstand') g.lit = true;
    gameEvent(g, 'INTERACT', id);
    for (const ipa of seq(w)) gameEvent(g, 'PICKUP', ipa);
  }
  gameEvent(g, 'DOOR_CLICK');
  for (const ipa of seq('open')) gameEvent(g, 'PICKUP', ipa);
  for (const w of ['open', 'hat', 'light', 'fire', 'water', 'hello']) {
    gameEvent(g, 'CRAFT', w);
    assert.ok(g.inv.items.has(w), `倒序合成失败: ${w}`);
  }
});

test('卡关提示：先报未收集词，再报「该拼词了」，门醒后报门', () => {
  const g = createGame(content);
  gameEvent(g, 'INTERACT', 'npc');
  assert.equal(chooseTease(g).kind, 'word');
  for (const w of ['hello', 'water', 'fire', 'light', 'hat']) collect(g, w === 'hat' ? 'hat' : w);
  gameEvent(g, 'DOOR_CLICK');
  for (const ipa of seq('open')) gameEvent(g, 'PICKUP', ipa);
  // 全部来源已碰、门石已捡：只剩拼词
  assert.equal(chooseTease(g).kind, 'craft');
  const g2 = createGame(content);
  for (const w of ['hello', 'water', 'fire', 'light', 'hat']) collect(g2, w);
  assert.equal(chooseTease(g2).kind, 'door');
});

test('jump 调试拍：lit-right / door-awake / door-open / summary 状态正确', () => {
  const g = createGame(content);
  jump(g, 'lit-right');
  assert.equal(g.lit, true);
  assert.equal(g.book.size, 4);
  jump(g, 'door-awake');
  assert.equal(g.book.size, 5);
  assert.ok(['pulsing', 'whispered'].includes(g.door.state));
  jump(g, 'door-open');
  assert.equal(g.inv.items.has('open'), true);
  assert.ok(['opening', 'opened'].includes(g.door.state));
  jump(g, 'summary');
  assert.equal(g.door.state, 'opened');
});

test('修正（Task 6 评审）：hello 最后入书也立即唤醒门', () => {
  const g = createGame(content);
  for (const w of ['water', 'fire', 'light']) collect(g, w);          // 3 词先合成入书
  gameEvent(g, 'USE', { word: 'light', target: 'lamp' });             // 点亮右侧（hatstand 需 lit）
  collect(g, 'hat');                                                  // 第 4 词入书
  assert.equal(g.book.size, 4);
  assert.equal(g.door.state, 'asleep');
  const out = gameEvent(g, 'INTERACT', 'npc');                        // hello = 第 5 词，经首点入书
  assert.equal(g.book.size, 5);
  assert.equal(g.door.state, 'pulsing');
  assert.ok(out.some(i => i.t === 'doorAwake'));
});
