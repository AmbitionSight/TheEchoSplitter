import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { createInventory, addStone, stoneCount, canConsume, consume, craftMatch, canPlace, placeNextIndex, swapSlots, isVowel } from '../public/js/hotbar.js';

const data = JSON.parse(await readFile(new URL('../content/chapter1.json', import.meta.url), 'utf8'));
const WORDS = data.words;

function invWith(pairs) {
  const inv = createInventory();
  for (const [ipa, n] of pairs) for (let i = 0; i < n; i++) addStone(inv, ipa);
  return inv;
}

test('库存：add/has/consume 计数精确，不出现负数', () => {
  const inv = createInventory();
  addStone(inv, 'h'); addStone(inv, 'h'); addStone(inv, 'ə');
  assert.equal(stoneCount(inv, 'h'), 2);
  assert.ok(canConsume(inv, ['h', 'ə']));
  assert.ok(consume(inv, ['h', 'ə']));
  assert.equal(stoneCount(inv, 'h'), 1);
  assert.equal(consume(inv, ['h', 'h', 'h']), false); // 不足则整体失败且不扣
  assert.equal(stoneCount(inv, 'h'), 1);
});

test('合成：正确序列命中词；乱序/缺石永不命中', () => {
  const inv = invWith([['h', 1], ['ə', 2], ['l', 1], ['əʊ', 1], ['p', 1], ['n', 1]]);
  assert.equal(craftMatch(['h', 'ə', 'l', 'əʊ'], WORDS, inv).word, 'hello');
  assert.equal(craftMatch(['ə', 'h', 'l', 'əʊ'], WORDS, inv).word, null);   // 乱序
  assert.equal(craftMatch(['əʊ', 'p', 'ə', 'n'], WORDS, inv).word, 'open');
  assert.equal(craftMatch(['əʊ', 'p', 'ə', null], WORDS, inv).word, null);  // 缺石
  assert.equal(craftMatch([null, null, null, null], WORDS, inv).word, null);
  const noP = invWith([['əʊ', 1], ['ə', 1], ['n', 1]]);
  assert.equal(craftMatch(['əʊ', 'p', 'ə', 'n'], WORDS, noP).word, null);   // 没有 p 石（p 只来自开关）
});

test('合成：拖对词缀有渐进共鸣，越长越亮', () => {
  const inv = invWith([['h', 1], ['ə', 2], ['l', 1], ['əʊ', 1]]);
  assert.equal(craftMatch(['h', null, null, null], WORDS, inv).glowDepth, 1);
  assert.equal(craftMatch(['h', 'ə', null, null], WORDS, inv).glowDepth, 2);
  assert.equal(craftMatch(['h', 'ə', 'l', null], WORDS, inv).glowDepth, 3);
  assert.equal(craftMatch(['h', 'l', null, null], WORDS, inv).glowDepth, 1); // 只对第一颗
});

test('跨词捡石：hello 里捡的 ə/əʊ 也能参与拼 open（音素共享）', () => {
  const inv = invWith([['ə', 1], ['əʊ', 1], ['p', 1], ['n', 1]]);           // ə/əʊ 来自 hello，p/n 来自开关
  const m = craftMatch(['əʊ', 'p', 'ə', 'n'], WORDS, inv);
  assert.equal(m.word, 'open');
  assert.ok(consume(inv, ['əʊ', 'p', 'ə', 'n']));
});

test('重复音素多重集消耗（回归）', () => {
  const inv = invWith([['ə', 2], ['h', 1], ['l', 1], ['əʊ', 1]]);
  assert.ok(consume(inv, ['h', 'ə', 'l', 'əʊ']));
  assert.equal(stoneCount(inv, 'ə'), 1);
  const inv2 = invWith([['ə', 1]]);
  assert.equal(canConsume(inv2, ['ə', 'ə']), false);                          // 一颗 ə 拼不出两颗
});

test('渐进共鸣跨候选词取最大（回归）', () => {
  const inv = invWith([['h', 1], ['ə', 1], ['əʊ', 1], ['p', 1]]);
  assert.equal(craftMatch(['h', 'ə', null, null], WORDS, inv).glowDepth, 2);  // hello 前缀
  assert.equal(craftMatch(['əʊ', 'p', null, null], WORDS, inv).glowDepth, 2); // open 前缀
  assert.equal(craftMatch(['ə', null, null, null], WORDS, inv).glowDepth, 0); // 无词以 ə 开头
});

test('canPlace：槽内同音素数不得超过库存', () => {
  const inv = invWith([['t', 2]]);
  assert.equal(canPlace([null, null, null, null], inv, 't'), true);
  assert.equal(canPlace(['t', null, null, null], inv, 't'), true);   // 已放 1，还有 1
  assert.equal(canPlace(['t', 't', null, null], inv, 't'), false);   // 已放 2，放不下第 3 颗
});

test('isVowel：元音/辅音分类正确', () => {
  assert.ok(isVowel('əʊ') && isVowel('ə') && isVowel('æ'));
  assert.ok(!isVowel('p') && !isVowel('n') && !isVowel('ŋ'));
});

test('placeNextIndex：依次填第一个空槽；满槽/超库存返回 -1', () => {
  const inv = invWith([['h', 1], ['ə', 1]]);
  assert.equal(placeNextIndex([null, null, null, null], inv, 'h'), 0);
  assert.equal(placeNextIndex(['h', null, null, null], inv, 'ə'), 1);
  assert.equal(placeNextIndex(['h', 'ə', 'h', 'ə'], inv, 'h'), -1);        // 槽满
  assert.equal(placeNextIndex(['h', null, null, null], inv, 'h'), -1);     // 库存只有 1 颗 h，槽里已有 1
  assert.equal(placeNextIndex([null, null, null, null], null, 'h'), -1);   // 无库存引用
});

test('swapSlots：两槽对调（含空槽移动）', () => {
  const s = ['h', 'ə', null, null];
  swapSlots(s, 0, 1);
  assert.deepEqual(s, ['ə', 'h', null, null]);
  swapSlots(s, 1, 2);
  assert.deepEqual(s, ['ə', null, 'h', null]);
  swapSlots(s, 0, 0);
  assert.deepEqual(s, ['ə', null, 'h', null]);
});
