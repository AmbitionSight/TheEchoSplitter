import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { createGame, gameEvent, jumpDebug, startGame, kit } from '../public/js/ch2.js';
import { createProfile, mergeProfile, seedMemory, neededSeeds } from '../public/js/profile.js';
import { createInventory, addStone, stoneCount } from '../public/js/hotbar.js';
import { planDropStones } from '../public/js/sideview.js';

const content = JSON.parse(await readFile(new URL('../content/chapter2.json', import.meta.url), 'utf8'));
const ch1Profile = mergeProfile(createProfile(), {
  everPicked: ['h', 'ə', 'l', 'əʊ', 'p', 'n'], words: ['hello', 'open'], chapter: 1
});

test('开局（第一关书档在场）：不剧透 jump，只提示裂缝', () => {
  const g = createGame(content, ch1Profile);
  const out = startGame(g);
  assert.ok(out.some(i => i.t === 'hint' && i.key === 'start'));
  assert.ok(!out.some(i => i.t === 'speak'));                          // 开局不说话
  assert.equal(g.jumpUnlocked, false);
});

test('记忆凝石：只带本章需要的 p，其余旧音素不塞背包', () => {
  const g = createGame(content, ch1Profile);
  const seeds = neededSeeds(content, ch1Profile.everPicked);
  assert.deepEqual(seeds, ['p']);                                     // jump 只需要旧识 p
  const seeded = seedMemory(g.inv, addStone, seeds);
  assert.deepEqual(seeded, ['p']);
  assert.equal(stoneCount(g.inv, 'p'), 1);
  assert.equal(stoneCount(g.inv, 'h'), 0);                            // h/l/n/ə/əʊ 不带入
});

test('空格尝试：耸肩+红叉气泡+童声疑惑+世界低语+只掉一次 dʒ ʌ m', () => {
  const g = createGame(content, ch1Profile);
  let out = gameEvent(g, 'CHASM');
  assert.ok(out.some(i => i.t === 'shrug'));
  assert.ok(out.some(i => i.t === 'bubble'));
  assert.ok(out.some(i => i.t === 'speak' && i.who === 'child' && i.text === 'Jump?'));
  assert.ok(out.some(i => i.t === 'speak' && i.who === 'door' && i.text === 'Jump.'));
  assert.ok(out.some(i => i.t === 'drop' && i.word === 'jump'));
  out = gameEvent(g, 'CHASM');                                          // 再按：复读不再掉
  assert.ok(out.some(i => i.t === 'speak' && i.who === 'door'));
  assert.ok(!out.some(i => i.t === 'drop'));
});

test('掉落规划：p 已由记忆石补位则不再落地；落点全部在裂口近侧可达处', () => {
  const inv = createInventory();
  addStone(inv, 'p');
  const plan = planDropStones(content.words.jump, inv, content.flows.jump.drop, content.geometry.chasmL);
  assert.deepEqual(plan.map(s => s.ipa), ['dʒ', 'ʌ', 'm']);            // p 是旧识，不再掉一颗
  for (const s of plan) assert.ok(s.x < content.geometry.chasmL, `石头 ${s.ipa} 落进裂隙 x=${s.x}`);
  const fresh = planDropStones(content.words.jump, createInventory(), content.flows.jump.drop, content.geometry.chasmL);
  assert.deepEqual(fresh.map(s => s.ipa), ['dʒ', 'ʌ', 'm', 'p']);      // 无书档新档：p 仍须实地捡
});

test('全流程：E 搬运（p 由记忆补位）→ 合成 jump → 对自己用 → 解锁 → 过坑 → 出口结算', () => {
  const g = createGame(content, ch1Profile);
  seedMemory(g.inv, addStone, ch1Profile.everPicked);                   // p 一颗
  let out = gameEvent(g, 'CHASM');
  for (const ipa of ['dʒ', 'ʌ', 'm']) {                                 // 场上只有三颗新石；p 是记忆石不落地
    out = out.concat(gameEvent(g, 'PICKUP', ipa), gameEvent(g, 'BANK'));
  }
  assert.equal(g.stonesPicked, 3);
  out = gameEvent(g, 'CRAFT', 'jump');
  assert.ok(g.inv.items.has('jump') && g.book.has('jump'));
  assert.ok(out.some(i => i.t === 'resonate' && i.word === 'jump'));
  assert.equal(stoneCount(g.inv, 'p'), 0);                              // 全部消耗
  out = gameEvent(g, 'HOLD_ITEM', 'jump');
  assert.ok(!out.some(i => i.t === 'speak'));
  out = gameEvent(g, 'USE', { word: 'jump', target: 'well' });          // 用错目标
  assert.ok(out.some(i => i.t === 'mutter'));
  out = gameEvent(g, 'USE', { word: 'jump', target: 'player' });
  assert.ok(!out.some(i => i.t === 'speak'));
  assert.ok(out.some(i => i.t === 'effect' && i.name === 'jumpUnlock' && i.full === true));
  assert.equal(g.jumpUnlocked, true);
  out = gameEvent(g, 'USE', { word: 'jump', target: 'player' });        // 重复：轻反应
  assert.ok(out.some(i => i.t === 'effect' && i.full === false));
  out = gameEvent(g, 'CROSS');
  assert.ok(out.some(i => i.t === 'hint' && i.key === 'exit'));
  out = gameEvent(g, 'EXIT');
  assert.ok(out.some(i => i.t === 'summary'));
  assert.equal(g.exited, true);
});

test('FELL：软重生无惩罚（提示）；TICK 链按进度给提示', () => {
  const g = createGame(content, ch1Profile);
  const out = gameEvent(g, 'FELL');
  assert.ok(out.some(i => i.t === 'fell'));
  assert.ok(!out.some(i => i.t === 'meow'));                          // 猫只在第一关出场
  for (let i = 0; i < 44; i++) gameEvent(g, 'TICK', 1);
  let tease = gameEvent(g, 'TICK', 1);
  assert.ok(tease.some(i => i.t === 'hint'));
});

test('jumpDebug：crafted/unlocked 拍状态正确', () => {
  const g = createGame(content, ch1Profile);
  seedMemory(g.inv, addStone, ch1Profile.everPicked);
  jumpDebug(g, 'unlocked');
  assert.ok(g.inv.items.has('jump'));
  assert.equal(g.jumpUnlocked, true);
});

test('无缝交接：第二间房声明后继为崖壁（第二间房后半），且可动态载入其 kit', async () => {
  assert.equal(kit.next?.chapter, 2);
  assert.equal(typeof kit.next.load, 'function');
  const nextKit = await kit.next.load();          // 真实动态导入，守住 ch2b.js 必须导出 kit
  assert.equal(nextKit.chapter, 2);
  assert.equal(nextKit.contentId, '2b');
  assert.equal(typeof nextKit.createGame, 'function');
  assert.equal(typeof nextKit.makeWorld, 'function');
});
