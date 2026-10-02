import { test } from 'node:test';
import assert from 'node:assert';
import { createProfile, loadProfile, saveProfile, mergeProfile, seedMemory, neededSeeds } from '../public/js/profile.js';
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

test('neededSeeds：只挑本章词用得上的旧音素', () => {
  const ch2 = { words: { jump: { phonemes: [['dʒ', 90], ['ʌ', 80], ['m', 90], ['p', 80]] } } };
  assert.deepEqual(neededSeeds(ch2, ['h', 'ə', 'l', 'əʊ', 'p', 'n']), ['p']);
  const ch3 = { words: { rope: { phonemes: [['r', 90], ['əʊ', 160], ['p', 80]] } } };
  assert.deepEqual(neededSeeds(ch3, ['h', 'ə', 'l', 'əʊ', 'p', 'n']).sort(), ['p', 'əʊ']);
  assert.deepEqual(neededSeeds(ch2, []), []);                          // 无书档（新玩家）不带
});

test('heard：回声听过的音跨关并集，与 everPicked 分开存（拼词播种不受污染）', () => {
  let p = mergeProfile(createProfile(), { everPicked: ['h'], heard: ['w', 'ɔː'], chapter: 1 });
  p = mergeProfile(p, { everPicked: ['dʒ'], heard: ['w', 'æ'], chapter: 2 });
  assert.deepEqual(p.heard.sort(), ['æ', 'w', 'ɔː'].sort());
  assert.deepEqual(p.everPicked.sort(), ['dʒ', 'h'].sort());
  const store = { getItem: () => JSON.stringify(p), setItem() {} };
  assert.deepEqual(loadProfile(store).heard.sort(), ['æ', 'w', 'ɔː'].sort());   // 读写不丢
});

test('旧存档键迁移：读到 echo-stone-profile 旧档即沿用，保存时写入新键 echo-splitter-profile', () => {
  const p = mergeProfile(createProfile(), { everPicked: ['h'], words: ['hello'], chapter: 1 });
  let written = null;
  const store = {
    getItem: k => k === 'echo-stone-profile' ? JSON.stringify(p) : null,
    setItem: (k, v) => { written = [k, v]; }
  };
  const loaded = loadProfile(store);                       // 新键不存在 → 回退读旧键
  assert.deepEqual(loaded.words, ['hello']);
  saveProfile(store, loaded);
  assert.equal(written[0], 'echo-splitter-profile');       // 保存写新键，完成迁移
});
