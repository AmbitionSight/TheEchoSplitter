import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { createGame, gameEvent, ropeDebug, startGame } from '../public/js/ch3.js';
import { createProfile, mergeProfile, seedMemory, neededSeeds } from '../public/js/profile.js';
import { addStone, stoneCount } from '../public/js/hotbar.js';

const content = JSON.parse(await readFile(new URL('../content/chapter3.json', import.meta.url), 'utf8'));
const ch2Profile = mergeProfile(mergeProfile(createProfile(), {
  everPicked: ['h', 'ə', 'l', 'əʊ', 'p', 'n'], words: ['hello', 'open'], chapter: 1
}), {
  everPicked: ['dʒ', 'ʌ', 'm', 'p'], words: ['jump'], abilities: ['jump'], chapter: 2
});

test('开局：崖壁提示；断绳未碰', () => {
  const g = createGame(content, ch2Profile);
  const out = startGame(g);
  assert.ok(out.some(i => i.t === 'hint' && i.key === 'start'));
  assert.equal(g.mended, false);
});

test('记忆凝石：只带本章需要的 əʊ 与 p，r 仍需实地捡', () => {
  const g = createGame(content, ch2Profile);
  const seeds = neededSeeds(content, ch2Profile.everPicked);
  assert.deepEqual(seeds.sort(), ['p', 'əʊ']);                        // rope 只需要旧识 əʊ、p
  const seeded = seedMemory(g.inv, addStone, seeds);
  assert.deepEqual(seeded.sort(), ['p', 'əʊ']);
});

test('断绳：世界低语 Rope + 童声疑惑 + 只掉一次 r', () => {
  const g = createGame(content, ch2Profile);
  let out = gameEvent(g, 'ROPE');
  assert.ok(out.some(i => i.t === 'speak' && i.who === 'door' && i.text === 'Rope.'));
  assert.ok(out.some(i => i.t === 'speak' && i.who === 'child' && i.text === 'Rope?'));
  assert.ok(out.some(i => i.t === 'drop' && i.word === 'rope'));
  out = gameEvent(g, 'ROPE');
  assert.ok(!out.some(i => i.t === 'drop'));                            // 反复听，不再掉
});

test('全流程：捡 r → 合成 rope（əʊ/p 记忆补位）→ 对绳使用 → 补全 → 爬顶 → 出口结算', () => {
  const g = createGame(content, ch2Profile);
  seedMemory(g.inv, addStone, ch2Profile.everPicked);
  gameEvent(g, 'ROPE');
  gameEvent(g, 'PICKUP', 'r'); gameEvent(g, 'BANK');
  assert.equal(stoneCount(g.inv, 'r'), 1);
  const out = gameEvent(g, 'CRAFT', 'rope');
  assert.ok(g.inv.items.has('rope'));
  assert.ok(out.some(i => i.t === 'resonate' && i.word === 'rope'));
  assert.equal(stoneCount(g.inv, 'əʊ'), 0);                             // 全部消耗
  assert.equal(stoneCount(g.inv, 'p'), 0);
  let r2 = gameEvent(g, 'USE', { word: 'rope', target: 'door' });       // 用错目标
  assert.ok(r2.some(i => i.t === 'mutter'));
  r2 = gameEvent(g, 'USE', { word: 'rope', target: 'rope' });
  assert.ok(r2.some(i => i.t === 'effect' && i.name === 'mendRope' && i.full === true));
  assert.equal(g.mended, true);
  assert.equal(g.hand, null);
  r2 = gameEvent(g, 'CLIMBED');
  assert.ok(r2.some(i => i.t === 'hint' && i.key === 'top'));
  r2 = gameEvent(g, 'EXIT');
  assert.ok(r2.some(i => i.t === 'summary'));
});

test('ropeDebug：mended 拍状态正确', () => {
  const g = createGame(content, ch2Profile);
  seedMemory(g.inv, addStone, ch2Profile.everPicked);
  ropeDebug(g, 'mended');
  assert.ok(g.inv.items.has('rope'));
  assert.equal(g.mended, true);
});
