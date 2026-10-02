// 章节共用件（chapter.js）：事件机核心段 + kit 公共行为 —— 各关共用的规则只在这一份上测
import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { createInventory, addStone } from '../public/js/hotbar.js';
import { cap, pickupStone, bankHeld, holdItem, craftWord,
         chapterOnE, syncHeld, seedBegin, dropExtra, dropBackExtra, stepWorldStones } from '../public/js/chapter.js';

const content = JSON.parse(await readFile(new URL('../content/chapter2.json', import.meta.url), 'utf8'));

function makeG() {
  return { content, inv: createInventory(), book: new Set(), stonesPicked: 0, hand: null };
}

test('cap：首字母大写加句点', () => {
  assert.equal(cap('jump'), 'Jump.');
  assert.equal(cap('open'), 'Open.');
});

test('pickupStone：首块带 onFirst 追加段；旧石先放回；非首块不再追加', () => {
  const g = makeG();
  const first = [{ t: 'hint', key: 'carrying' }];
  let out = pickupStone(g, 'dʒ', { onFirst: first });
  assert.deepEqual(out, [{ t: 'carrier', ipa: 'dʒ' }, { t: 'hand' }, { t: 'hint', key: 'carrying' }]);
  assert.deepEqual(g.hand, { kind: 'stone', ipa: 'dʒ' });

  out = pickupStone(g, 'ʌ', { onFirst: first });          // 手上已有 dʒ → 先放回
  assert.deepEqual(out, [{ t: 'dropBack', ipa: 'dʒ' }, { t: 'carrier', ipa: 'ʌ' }, { t: 'hand' }]);
  assert.equal(g.stonesPicked, 2);
});

test('pickupStone：无 onFirst（第四关形态）输出与手举一致', () => {
  const g = makeG();
  assert.deepEqual(pickupStone(g, 'l'), [{ t: 'carrier', ipa: 'l' }, { t: 'hand' }]);
});

test('bankHeld：手上无石空转；有石进库存并清手', () => {
  const g = makeG();
  assert.deepEqual(bankHeld(g), []);
  g.hand = { kind: 'stone', ipa: 'm' };
  assert.deepEqual(bankHeld(g), [{ t: 'bank', ipa: 'm' }, { t: 'hand' }]);
  assert.equal(g.hand, null);
  assert.equal(g.inv.stones.get('m'), 1);
  assert.deepEqual(g.inv.order, ['m']);
});

test('holdItem：拿起带提示；再点放下；没拿到过的词空转', () => {
  const g = makeG();
  assert.deepEqual(holdItem(g, 'jump'), []);              // 没合成过
  g.inv.items.set('jump', true);
  assert.deepEqual(holdItem(g, 'jump'), [{ t: 'hand' }, { t: 'hint', key: 'give' }]);   // 拿起（默认提示）
  assert.deepEqual(holdItem(g, 'jump'), [{ t: 'hand' }]);                               // 再点 = 放下
  assert.deepEqual(holdItem(g, 'jump', { hint: 'raft' }), [{ t: 'hand' }, { t: 'hint', key: 'raft' }]);  // 再拿（章节提示）
  assert.deepEqual(holdItem(g, 'jump'), [{ t: 'hand' }]);                               // 放下
  assert.equal(g.hand, null);
});

test('craftWord：判定→消耗→入册→基础指令+章节追加段', () => {
  const g = makeG();
  assert.deepEqual(craftWord(g, 'nope'), []);             // 未知词
  for (const ipa of ['dʒ', 'ʌ', 'm', 'p']) addStone(g.inv, ipa);
  const out = craftWord(g, 'jump', [{ t: 'hint', key: 'give' }]);
  assert.deepEqual(out, [
    { t: 'resonate', word: 'jump' },
    { t: 'speak', who: 'child', text: 'Jump.' },
    { t: 'itemIn', word: 'jump' },
    { t: 'hint', key: 'give' }
  ]);
  assert.ok(g.inv.items.has('jump') && g.book.has('jump'));
  for (const ipa of ['dʒ', 'ʌ', 'm', 'p']) assert.equal(g.inv.stones.get(ipa), 0);   // 已消耗
  assert.deepEqual(craftWord(g, 'jump'), []);             // 已合成过
});

test('craftWord：库存不足不合成', () => {
  const g = makeG();
  addStone(g.inv, 'dʒ');
  assert.deepEqual(craftWord(g, 'jump'), []);
  assert.equal(g.inv.items.has('jump'), false);
});

test('chapterOnE：石头→拾取并出列；合成台→存石；其余交给章节 rest', () => {
  const g = makeG();
  const ran = [];
  const w = {
    game: g, stones: [{ ipa: 'ʌ', state: 'idle' }], player: {},
    run: list => ran.push(...list),
    sfx: { mutter() { ran.push('mutter'); } }
  };
  const ev = (gg, name, arg) => [{ t: 'ev', name, arg }];
  const onE = chapterOnE(ev, (ww, t) => { ww.sfx.mutter(); });

  onE(w, { kind: 'stone', ipa: 'ʌ', stone: w.stones[0] });
  assert.equal(w.stones.length, 0);
  assert.deepEqual(ran, [{ t: 'ev', name: 'PICKUP', arg: 'ʌ' }]);

  onE(w, { kind: 'obj', id: 'bench' });
  assert.deepEqual(ran[1], { t: 'ev', name: 'BANK', arg: null });

  onE(w, { kind: 'obj', id: 'rope' });                    // 章节自己处理
  assert.equal(ran[2], 'mutter');
});

test('syncHeld：空手/举石（元辅分类）/举词具图标', () => {
  const w = { game: { hand: null }, player: {}, content };
  syncHeld(w);
  assert.deepEqual(w.player, { held: null, heldVowel: false, heldIcon: null });

  w.game.hand = { kind: 'stone', ipa: 'ʌ' };              // 元音
  syncHeld(w);
  assert.equal(w.player.held, 'ʌ'); assert.equal(w.player.heldVowel, true);

  w.game.hand = { kind: 'stone', ipa: 'dʒ' };             // 辅音
  syncHeld(w);
  assert.equal(w.player.heldVowel, false);

  w.game.hand = { kind: 'item', word: 'jump' };
  syncHeld(w);
  assert.equal(w.player.held, null);
  assert.equal(w.player.heldIcon, content.words.jump.icon);
});

test('syncHeld：第一间房世界（player 挂在 actors 下）不抛错（回归：hand 指令曾 TypeError 卡死第一关）', () => {
  const w = { game: { hand: { kind: 'stone', ipa: 'h' } }, actors: { player: {} }, content };
  assert.doesNotThrow(() => syncHeld(w));
  assert.equal(w.actors.player.held, 'h');                // 手持状态写进真正的玩家演员
  const empty = { game: { hand: null }, actors: { player: {} }, content };
  assert.doesNotThrow(() => syncHeld(empty));
  assert.equal(empty.actors.player.held, null);
});

test('stepWorldStones：飞行石步进落定；keepOut 把落进禁区的石推出', () => {
  const w = { stones: [{ ipa: 'ʌ', x: 800, y: 605, vx: 0, vy: 10, state: 'fly', t: 0, phase: 0 }] };
  const keepOut = x => (x >= 700 && x <= 940) ? 700 - 30 : null;   // 裂隙 700..940 → 推回左缘
  stepWorldStones(w, 1, () => 600, keepOut);
  assert.equal(w.stones[0].state, 'idle');
  assert.equal(w.stones[0].x, 670);                        // 落进裂隙被推出
});

test('dropBackExtra：身后轻抛，音素入列', () => {
  const w = { stones: [], player: { x: 500 }, geo: { groundY: 600 } };
  dropBackExtra()(w, { t: 'dropBack', ipa: 'p' });
  assert.equal(w.stones.length, 1);
  assert.equal(w.stones[0].ipa, 'p');
  assert.equal(w.stones[0].x, 480);                        // player.x - 20
  assert.equal(w.stones[0].state, 'fly');
});

test('seedBegin：只补本章需要的旧音素并刷物品栏', async () => {
  const g = makeG();
  let refreshed = 0;
  const w = { game: g, content, profile: { everPicked: ['h', 'ə', 'l', 'əʊ', 'p'] },  // 第一关通关书档
              sfx: { chime() {} }, hb: { refresh() { refreshed++; } } };
  seedBegin(w);
  assert.equal(g.inv.stones.get('p'), 1);                  // jump 需要的旧识只有 p
  assert.equal(g.inv.stones.get('dʒ'), undefined);         // 新音素不预发
  assert.equal(g.inv.stones.get('h'), undefined);          // 与本章无关的旧识不带
  assert.equal(refreshed, 1);
});
