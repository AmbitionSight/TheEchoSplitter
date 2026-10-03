import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { createGame, gameEvent, ropeDebug, startGame, kit } from '../public/js/ch2b.js';
import { createProfile, mergeProfile, seedMemory, neededSeeds } from '../public/js/profile.js';
import { createInventory, addStone, stoneCount } from '../public/js/hotbar.js';
import { moveSide, planDropStones } from '../public/js/sideview.js';

const content = JSON.parse(await readFile(new URL('../content/chapter2b.json', import.meta.url), 'utf8'));
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

test('掉落规划：əʊ/p 已由记忆石补位则不再落地；落点全部在墙左可达处', () => {
  const inv = createInventory();
  addStone(inv, 'əʊ'); addStone(inv, 'p');
  const plan = planDropStones(content.words.rope, inv, content.flows.rope.drop, content.geometry.wallX);
  assert.deepEqual(plan.map(s => s.ipa), ['r']);                        // əʊ/p 是旧识，不再掉
  const wallL = content.geometry.wallX - 14;                            // 玩家最多贴到墙左 14px
  for (const s of plan) assert.ok(s.x < wallL, `石头 ${s.ipa} 落进墙里 x=${s.x}`);
  const fresh = planDropStones(content.words.rope, createInventory(), content.flows.rope.drop, content.geometry.wallX);
  assert.deepEqual(fresh.map(s => s.ipa), ['r', 'əʊ', 'p']);            // 无书档新档：三颗都落地
});

test('窗户以下没有空气墙：地面可走进墙下，墙顶平台语义保留', () => {
  const mk = blockGround => ({
    player: { x: 880, y: 620, vy: 0, airborne: false, climbing: false, dir: 'right', facing: 1, walkT: 0, moving: false },
    geo: { groundY: 620 },
    keys: new Set(['r']),
    cfg: { wall: blockGround === false
      ? { X: 900, W: 110, topY: 120, blockGround: false }
      : { X: 900, W: 110, topY: 120 } }
  });
  const open = mk(false);
  for (let i = 0; i < 12; i++) moveSide(open, 0.016);
  assert.ok(open.player.x > 920, `地面应能一路走进墙下，x=${open.player.x}`);
  assert.equal(open.player.y, 620);                                     // 墙下地面不被抬升
  const top = mk(false);
  top.player.x = 935; top.player.y = 120; top.keys = new Set();
  moveSide(top, 0.016);
  assert.equal(top.player.y, 120);                                      // 墙顶平台仍然站得住
  const solid = mk(true);
  for (let i = 0; i < 6; i++) moveSide(solid, 0.016);
  assert.ok(solid.player.x <= 886.5, `默认语义仍挡在墙左，x=${solid.player.x}`);
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
  let r2 = gameEvent(g, 'HOLD_ITEM', 'rope');
  assert.ok(!r2.some(i => i.t === 'speak'));
  r2 = gameEvent(g, 'USE', { word: 'rope', target: 'door' });       // 用错目标
  assert.ok(r2.some(i => i.t === 'mutter'));
  r2 = gameEvent(g, 'USE', { word: 'rope', target: 'rope' });
  assert.ok(!r2.some(i => i.t === 'speak'));
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

test('无缝交接：崖壁走到尽头声明后继为第三间房（暗河），且可动态载入其 kit', async () => {
  assert.equal(kit.next?.chapter, 3);
  assert.equal(typeof kit.next.load, 'function');
  const nextKit = await kit.next.load();          // 真实动态导入，守住 ch3.js 必须导出 kit
  assert.equal(nextKit.chapter, 3);
  assert.equal(typeof nextKit.createGame, 'function');
});
