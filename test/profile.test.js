import { test } from 'node:test';
import assert from 'node:assert';
import { createProfile, loadProfile, saveProfile, mergeProfile, seedMemory } from '../public/js/profile.js';
import { createInventory, addStone, stoneCount } from '../public/js/hotbar.js';

test('书档：无存储/坏数据 → 空档；存取往返一致', () => {
  assert.deepEqual(loadProfile(null), createProfile());
  assert.deepEqual(loadProfile({ getItem: () => 'not json' }), createProfile());
  const store = { m: null, getItem() { return this.m; }, setItem(k, v) { this.m = v; } };
  const p = mergeProfile(createProfile(), { everPicked: ['h', 'ə'], words: ['hello'], chapter: 1 });
  saveProfile(store, p);
  assert.deepEqual(loadProfile(store), p);
});

test('书档：并集合并永不丢失、去重；多关累积', () => {
  let p = createProfile();
  p = mergeProfile(p, { everPicked: ['h', 'ə', 'l', 'əʊ', 'p', 'n'], words: ['hello', 'open'], abilities: [], chapter: 1 });
  p = mergeProfile(p, { everPicked: ['dʒ', 'ʌ', 'm', 'p'], words: ['jump'], abilities: ['jump'], chapter: 2 });
  p = mergeProfile(p, { everPicked: ['r'], words: ['rope'], abilities: ['climb'], chapter: 3 });
  assert.deepEqual(p.everPicked.sort(), ['dʒ','h','l','m','n','p','r','ʌ','ə','əʊ'].sort());
  assert.deepEqual(p.words, ['hello', 'open', 'jump', 'rope']);
  assert.deepEqual(p.abilities.sort(), ['climb', 'jump']);
  assert.deepEqual(p.chaptersDone, [1, 2, 3]);
});

test('播种：已学音素各凝一颗记忆石；已有关不重复', () => {
  const inv = createInventory();
  addStone(inv, 'p');                                   // 手里已有一颗 p
  const seeded = seedMemory(inv, addStone, ['h', 'ə', 'əʊ', 'p']);
  assert.deepEqual(seeded.sort(), ['ə', 'əʊ', 'h'].sort());  // p 未重复播种
  assert.equal(stoneCount(inv, 'h'), 1);
  assert.equal(stoneCount(inv, 'p'), 1);
});
