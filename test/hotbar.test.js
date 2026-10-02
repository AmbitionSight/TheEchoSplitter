import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { createInventory, addStone, stoneCount, canConsume, consume, craftMatch } from '../public/js/hotbar.js';

const data = JSON.parse(await readFile(new URL('../content/chapter1.json', import.meta.url), 'utf8'));
const WORDS = data.words;

function invWith(pairs) {
  const inv = createInventory();
  for (const [ipa, n] of pairs) for (let i = 0; i < n; i++) addStone(inv, ipa);
  return inv;
}

test('库存：add/has/consume 计数精确，不出现负数', () => {
  const inv = createInventory();
  addStone(inv, 'h'); addStone(inv, 'h'); addStone(inv, 'æ');
  assert.equal(stoneCount(inv, 'h'), 2);
  assert.ok(canConsume(inv, ['h', 'æ']));
  assert.ok(consume(inv, ['h', 'æ']));
  assert.equal(stoneCount(inv, 'h'), 1);
  assert.equal(consume(inv, ['h', 'h', 'h']), false); // 不足则整体失败且不扣
  assert.equal(stoneCount(inv, 'h'), 1);
});

test('合成：正确序列命中词；乱序/缺石永不命中', () => {
  const inv = invWith([['l', 1], ['aɪ', 1], ['t', 1], ['h', 1], ['æ', 1]]);
  assert.equal(craftMatch(['l', 'aɪ', 't', null], WORDS, inv).word, 'light');
  assert.equal(craftMatch(['t', 'aɪ', 'l', null], WORDS, inv).word, null);   // 乱序
  assert.equal(craftMatch(['h', 'æ', 't', null], WORDS, inv).word, 'hat');
  assert.equal(craftMatch(['h', 'æ', null, null], WORDS, inv).word, null);   // 缺石
  assert.equal(craftMatch([null, null, null, null], WORDS, inv).word, null);
  assert.equal(craftMatch(['əʊ', 'p', 'ə', 'n'], WORDS, inv).word, null);    // 没有 p 石
});

test('合成：拖对词缀有渐进共鸣，越长越亮', () => {
  const inv = invWith([['l', 1], ['aɪ', 1], ['t', 1]]);
  assert.equal(craftMatch(['l', null, null, null], WORDS, inv).glowDepth, 1);
  assert.equal(craftMatch(['l', 'aɪ', null, null], WORDS, inv).glowDepth, 2);
  assert.equal(craftMatch(['l', 'aɪ', 't', null], WORDS, inv).glowDepth, 3);
  assert.equal(craftMatch(['l', 't', null, null], WORDS, inv).glowDepth, 1); // 只对第一颗
});

test('聪明路径：用别处捡的石也能拼 light（规格 §3.2）', () => {
  const inv = invWith([['l', 1], ['aɪ', 1], ['t', 1]]); // 来自 hello+fire+water
  const m = craftMatch(['l', 'aɪ', 't', null], WORDS, inv);
  assert.equal(m.word, 'light');
  assert.ok(consume(inv, ['l', 'aɪ', 't']));
});

test('聪明路径反例：没碰过帽架就拼不出 hat（æ 无其它来源）', () => {
  const inv = invWith([['h', 1], ['t', 1]]);
  assert.equal(craftMatch(['h', 'æ', 't', null], WORDS, inv).word, null);
});
