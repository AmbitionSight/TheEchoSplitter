import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { createGame, startGame, gameEvent, chooseTease, jump } from '../public/js/main.js';
import { stoneCount } from '../public/js/hotbar.js';

const content = JSON.parse(await readFile(new URL('../content/chapter1.json', import.meta.url), 'utf8'));

function carry(g, word) {              // E 拾取 → 合成台存入（逐块）
  let out = [];
  for (const [ipa] of content.words[word].phonemes) {
    out = out.concat(gameEvent(g, 'PICKUP', ipa));
    out = out.concat(gameEvent(g, 'BANK'));
  }
  return out;
}

test('开局：大叔只出声招手，提示「按 E 碰他」', () => {
  const g = createGame(content);
  const out = startGame(g);
  assert.ok(out.some(i => i.t === 'speak' && i.who === 'uncle' && i.text === 'Hello! Hello!'));
  assert.ok(out.some(i => i.t === 'hint' && i.key === 'hello'));
});

test('Hello 超时提醒只触发一次，之后不再自动发声', () => {
  const g = createGame(content);
  assert.deepEqual(gameEvent(g, 'TICK', 44), []);
  const reminder = gameEvent(g, 'TICK', 1);
  assert.deepEqual(reminder, [{ t: 'speak', who: 'uncle', text: 'Hello! Hello!', slow: true }]);
  assert.equal(g.helloReminded, true);
  assert.deepEqual(gameEvent(g, 'TICK', 45), []);
});

test('主动碰大叔会作废未触发的超时提醒，后续卡关只保留 hint', () => {
  const g = createGame(content);
  gameEvent(g, 'TICK', 44);
  gameEvent(g, 'INTERACT', 'npc');
  assert.equal(g.helloDropped, true);
  assert.equal(g.helloReminded, true);
  assert.equal(g.teaseClock, 0);
  const out = gameEvent(g, 'TICK', 45);
  assert.ok(out.some(i => i.t === 'hint' && i.key === 'hand'));
  assert.ok(!out.some(i => i.t === 'speak' && i.who === 'uncle'));
});

test('首碰大叔：掉 hello 四石 + 提示「按 E 捡」', () => {
  const g = createGame(content);
  const out = gameEvent(g, 'INTERACT', 'npc');
  assert.ok(out.some(i => i.t === 'drop' && i.word === 'hello'));
  assert.ok(out.some(i => i.t === 'hint' && i.key === 'hand'));
  assert.equal(g.helloDropped, true);
});

test('纯手持：E 拾石发声入手上；换手把旧石放回地面；首石提示去合成台', () => {
  const g = createGame(content);
  gameEvent(g, 'INTERACT', 'npc');
  let out = gameEvent(g, 'PICKUP', 'h');
  assert.deepEqual(g.hand, { kind: 'stone', ipa: 'h' });
  assert.ok(out.some(i => i.t === 'carrier' && i.ipa === 'h'));
  assert.ok(out.some(i => i.t === 'hint' && i.key === 'bench'));       // 首石
  out = gameEvent(g, 'PICKUP', 'ə');
  assert.deepEqual(g.hand, { kind: 'stone', ipa: 'ə' });
  assert.ok(out.some(i => i.t === 'dropBack' && i.ipa === 'h'));       // 旧石放回
  assert.equal(g.stonesPicked, 2);
  assert.ok(g.inv.everPicked.has('h') && g.inv.everPicked.has('ə'));
});

test('合成台：手石入库；空手按台无反应', () => {
  const g = createGame(content);
  gameEvent(g, 'PICKUP', 'h');
  const out = gameEvent(g, 'BANK');
  assert.equal(g.hand, null);
  assert.ok(out.some(i => i.t === 'bank' && i.ipa === 'h'));
  assert.equal(stoneCount(g.inv, 'h'), 1);
  assert.deepEqual(gameEvent(g, 'BANK'), []);
});

test('全流程：hello 教学合成（大叔庆祝）→ 开关（Open+掉石+亮）→ open 合成 → 词具开门 → 结算', () => {
  const g = createGame(content);
  // hello
  let out = gameEvent(g, 'INTERACT', 'npc');
  out = out.concat(carry(g, 'hello'));
  out = out.concat(gameEvent(g, 'CRAFT', 'hello'));
  assert.ok(g.inv.items.has('hello') && g.book.has('hello'));
  assert.ok(out.some(i => i.t === 'resonate' && i.word === 'hello'));
  assert.ok(!out.some(i => i.t === 'uncleCheer'));                     // v2：不自动庆祝——要拿着气泡给大叔
  assert.ok(out.some(i => i.t === 'hint' && i.key === 'helloGive'));
  // 开关
  out = gameEvent(g, 'INTERACT', 'switch');
  assert.equal(g.lit, true);
  assert.equal(g.switchOn, true);
  assert.ok(out.some(i => i.t === 'speak' && i.who === 'door' && i.text === 'Open.'));
  assert.ok(out.some(i => i.t === 'drop' && i.word === 'open'));
  assert.ok(out.some(i => i.t === 'illuminate'));
  // 再点开关：只复读不掉石
  out = gameEvent(g, 'INTERACT', 'switch');
  assert.ok(out.some(i => i.t === 'speak' && i.who === 'door'));
  assert.ok(!out.some(i => i.t === 'drop'));
  // open
  out = carry(g, 'open');
  out = out.concat(gameEvent(g, 'CRAFT', 'open'));
  assert.equal(out.filter(i => i.t === 'speak' && i.who === 'child' && i.text === 'Open.').length, 1);
  assert.ok(g.inv.items.has('open'));
  // 拿起词具 → 门
  out = gameEvent(g, 'HOLD_ITEM', 'open');
  assert.deepEqual(g.hand, { kind: 'item', word: 'open' });
  assert.ok(!out.some(i => i.t === 'speak'));
  out = gameEvent(g, 'USE', { word: 'open', target: 'door' });
  assert.ok(out.some(i => i.t === 'ritualStart'));
  assert.ok(!out.some(i => i.t === 'speak'));
  assert.equal(g.hand, null);
  gameEvent(g, 'RITUAL_DONE');
  assert.equal(g.door.state, 'opening');
  out = gameEvent(g, 'OPEN_DONE');
  assert.ok(out.some(i => i.t === 'summary'));
  assert.equal(g.book.size, 2);
  assert.equal(g.stonesPicked, 8);
});

test('拖错/拿错：hello 词具对门 = 咕哝；open 对大叔 = 咕哝；黑暗门不可 E（纯逻辑层面跳过）', () => {
  const g = createGame(content);
  gameEvent(g, 'INTERACT', 'npc');
  carry(g, 'hello');
  gameEvent(g, 'CRAFT', 'hello');
  assert.ok(gameEvent(g, 'USE', { word: 'hello', target: 'door' }).some(i => i.t === 'mutter'));
  assert.ok(gameEvent(g, 'USE', { word: 'open', target: 'npc' }).every(i => i.t === 'mutter'));
});

test('hello 词具回礼大叔：首次 full 庆祝、重复轻反应；再点物品栏=放下', () => {
  const g = createGame(content);
  gameEvent(g, 'INTERACT', 'npc');
  carry(g, 'hello');
  gameEvent(g, 'CRAFT', 'hello');
  let out = gameEvent(g, 'HOLD_ITEM', 'hello');
  assert.ok(!out.some(i => i.t === 'speak'));
  out = gameEvent(g, 'INTERACT', 'npc');                            // 手持 hello 碰大叔 = USE
  assert.ok(out.some(i => i.t === 'speak' && i.who === 'child' && i.text === 'Hello.'));
  assert.ok(out.some(i => i.t === 'effect' && i.name === 'greet' && i.full === true));
  assert.ok(out.some(i => i.t === 'hint' && i.key === 'helloDone'));   // 回礼后指向发光开关
  out = gameEvent(g, 'INTERACT', 'npc');                                // 手上仍持有 → 重复使用轻反应
  assert.ok(out.some(i => i.t === 'effect' && i.full === false));
  out = gameEvent(g, 'HOLD_ITEM', 'hello');                             // 再点一次物品栏 = 放下
  assert.equal(g.hand, null);
  assert.deepEqual(out, [{ t: 'hand' }]);
  gameEvent(g, 'HOLD_ITEM', 'hello');                                   // 再点 = 重新拿起
  assert.deepEqual(g.hand, { kind: 'item', word: 'hello' });
});

test('氛围物：只出音效指令，永不掉石', () => {
  const g = createGame(content);
  for (const id of ['well', 'brazier', 'hatstand', 'sprout']) {
    const out = gameEvent(g, 'INTERACT', id);
    assert.ok(out.length === 1 && out[0].t === 'sfx', `${id} 应只出音效`);
  }
  assert.ok(gameEvent(g, 'INTERACT', 'cat').some(i => i.t === 'cat'));
});

test('TICK 卡关提示链：捡石 → 开关 → 合成 → 去门', () => {
  const g = createGame(content);
  assert.equal(chooseTease(g).kind, 'hello');
  gameEvent(g, 'INTERACT', 'npc');
  assert.equal(chooseTease(g).key, 'hand');
  carry(g, 'hello'); gameEvent(g, 'CRAFT', 'hello');
  assert.equal(chooseTease(g).key, 'switch');
  gameEvent(g, 'INTERACT', 'switch');
  carry(g, 'open');
  assert.equal(chooseTease(g).key, 'craft');
  gameEvent(g, 'CRAFT', 'open');
  assert.equal(chooseTease(g).key, 'openItem');
});

test('jump 调试拍：hello / lit / door-open / summary 状态正确且不重复掉落', () => {
  const g = createGame(content);
  jump(g, 'lit');
  assert.equal(g.book.has('hello'), true);
  assert.equal(g.lit, true);
  jump(g, 'door-open');
  assert.ok(g.inv.items.has('open'));
  assert.ok(['opening', 'opened'].includes(g.door.state));
  jump(g, 'summary');
  assert.equal(g.door.state, 'opened');
  assert.equal(g.stonesPicked, 8);
});
