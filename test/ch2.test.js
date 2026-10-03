import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { createGame, gameEvent, jumpDebug, startGame, kit, LIGHTS2 } from '../public/js/ch2.js';
import { createProfile, mergeProfile, seedMemory, neededSeeds } from '../public/js/profile.js';
import { createInventory, addStone, stoneCount } from '../public/js/hotbar.js';
import { planDropStones, drawTorchSide, drawBenchSide, makeDust, stepDust } from '../public/js/sideview.js';

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
  assert.deepEqual(plan.map(s => s.ipa), ['dʒ', 'ʌ', 'm', 'h', 'l']);  // p 是旧识不掉；h/l 是干扰音（须听辨排除）
  for (const s of plan) assert.ok(s.x < content.geometry.chasmL, `石头 ${s.ipa} 落进裂隙 x=${s.x}`);
  const fresh = planDropStones(content.words.jump, createInventory(), content.flows.jump.drop, content.geometry.chasmL);
  assert.deepEqual(fresh.map(s => s.ipa), ['dʒ', 'ʌ', 'm', 'p', 'h', 'l']);  // 无书档：p 仍须实地捡；含干扰音
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

test('听声点：LISTEN 返回回声指令；裂口回声随解锁跳跃变化；未知 id 安全', () => {
  const g = createGame(content, ch1Profile);
  assert.ok(gameEvent(g, 'LISTEN', 'warm').some(i => i.t === 'echo' && i.say === 'Warm.'));
  assert.ok(gameEvent(g, 'LISTEN', 'fall').some(i => i.t === 'echo' && i.say === 'Fall.'));
  gameEvent(g, 'USE', { word: 'jump', target: 'player' });        // 解锁跳跃（能过坑）
  assert.ok(gameEvent(g, 'LISTEN', 'fall').some(i => i.t === 'echo' && i.say === 'Free.'));
  assert.deepEqual(gameEvent(g, 'LISTEN', 'nope'), []);
});

test('听声点内容：每个音素都有载词（回声条能念）', () => {
  for (const spot of content.listening) {
    for (const ipa of spot.echo) assert.ok(content.carriers[ipa] || content.phonemeBook.carriers[ipa], `${spot.id} 缺载词 ${ipa}`);
  }
});

test('听声点是实体物件：findE 认得，按 E 走 LISTEN（auto 的火把不占 E）', () => {
  const g = createGame(content, ch1Profile);
  const ran = [];
  const w = { game: g, content, player: { x: 690, y: 600 }, geo: content.geometry, stones: [], run: ins => ran.push(...ins) };
  const t = kit.findE(w);
  assert.equal(t.id, 'fall');                                   // 站在裂口边，E 目标是听声点
  kit.onE(w, t);
  assert.ok(ran.some(i => i.t === 'echo' && i.say === 'Fall.'));
  assert.equal(kit.findE({ ...w, player: { x: 90, y: 600 } }), null);   // 火把是 auto 环境声，不是 E 目标
});

test('内容：听声点带 sfx、warm 在火把 (90,240)、reveal 齐备', () => {
  const warm = content.listening.find(s => s.id === 'warm');
  assert.equal(warm.y, 240); assert.equal(warm.sfx, 'crackle'); assert.equal(warm.auto, true);
  for (const s of content.listening) assert.ok(s.sfx, `${s.id} 缺 sfx`);
  assert.ok(content.words.jump.reveal?.ok, 'jump 缺 reveal');
});

test('2a 陈设与纵深：源码含入口拱/出口拱/石桥残墩/对壁三层', async () => {
  const src = await readFile(new URL('../public/js/ch2.js', import.meta.url), 'utf8');
  for (const k of ['drawArchSide', 'drawBridgePier', 'drawFarWallLayers', 'crate_big', 'jars2', '风幡']) assert.ok(src.includes(k), `缺 ${k}`);
});

test('LIGHTS2：锚点由几何推导、烘焙=动态同源', () => {
  const L = LIGHTS2(content.geometry);
  assert.deepEqual([L.torchL.x, L.torchL.y], [90, 240]);
  assert.equal(L.torchR.x, content.geometry.chasmR + 120);
  assert.equal(L.candle.x, content.geometry.benchX + 62);
  assert.equal(L.exit.x, content.geometry.exitX);
  for (const v of Object.values(L)) assert.ok(v.r > 0 && v.s > 0 && v.s <= 1);
  // 规格 §6.1 2a 表逐项锁定（五锚、几何推导、半径/强度）
  assert.deepEqual(Object.keys(L).sort(), ['candle', 'chasm', 'exit', 'torchL', 'torchR']);
  assert.deepEqual([L.torchR.y, L.torchL.r, L.torchL.s, L.torchR.r, L.torchR.s], [240, 170, 0.24, 170, 0.24]);
  assert.deepEqual([L.candle.y, L.candle.r, L.candle.s], [content.geometry.groundY - 90, 90, 0.20]);
  assert.deepEqual([L.chasm.x, L.chasm.y, L.chasm.r, L.chasm.s],
    [(content.geometry.chasmL + content.geometry.chasmR) / 2, content.geometry.groundY - 70, 300, 0.16]);
  assert.deepEqual([L.exit.y, L.exit.r, L.exit.s], [content.geometry.groundY - 180, 260, 0.12]);
});

test('drawTorchSide：第 5 参 glow 缺省＝现状 r110，传入后按表取 r', () => {
  const radii = [];
  const mk = () => new Proxy({}, {
    get(t, k) {
      if (k === 'createRadialGradient') return () => ({ addColorStop() {} });
      if (k === 'arc') return (_cx, _cy, r) => radii.push(r);
      return () => undefined;
    },
    set() { return true; }
  });
  drawTorchSide(mk(), 100, 200, 1);
  assert.ok(radii.includes(110), '缺省光晕半径 110（ch2b/ch3 行为不变）');
  radii.length = 0;
  drawTorchSide(mk(), 100, 200, 1, { r: 170, a: 0.24 });
  assert.ok(radii.includes(170), '传入 glow 后光晕读表 r');
});

test('drawBenchSide：opts.candle 缺省关闭、开启后不抛错（mock ctx）', () => {
  const mk = () => new Proxy({}, {
    get(t, k) {
      if (k === 'createRadialGradient') return () => ({ addColorStop() {} });
      return () => undefined;
    },
    set() { return true; }
  });
  assert.doesNotThrow(() => drawBenchSide(mk(), null, 420, 600, false, null));
  assert.doesNotThrow(() => drawBenchSide(mk(), null, 420, 600, false, null, { candle: true, t: 1.2 }));
});

test('2a 光法则单源：光池烘焙读表、蜡烛陈设开启（源码断言）', async () => {
  const src = await readFile(new URL('../public/js/ch2.js', import.meta.url), 'utf8');
  assert.match(src, /Object\.values\(w\.lights\)/, 'makeBg 光池循环锚点表');
  assert.ok(!/pixelGlow\(x, 90, 240/.test(src), '火把光池不得再硬编码');
  assert.match(src, /candle: true/, 'ch2 合成台开启 ch1 同款蜡烛陈设');
});

test('2a 动态层与粒子：金尘/水光/幡摆/浮尘 26/余烬复用星星池（源码断言）', async () => {
  const src = await readFile(new URL('../public/js/ch2.js', import.meta.url), 'utf8');
  assert.match(src, /makeDust\(26, 99\)/, '浮尘 26 粒、rng(99) 确定布局');
  assert.match(src, /stepDust\(/, '浮尘在动态层步进（y<160 回 700）');
  assert.match(src, /kind:'ember'/, '余烬复用星星池并打 kind 标');
  assert.match(src, /drawWindBanner\(x, 1030, geo\.groundY,/, '风幡绕顶摆动在动态层（±0.06rad）');
  assert.match(src, /drawPuddleGlints/, '水洼 2 闪粒');
  assert.match(src, /drawExitBeacon/, '出口 ᚱ 呼吸 + 12 金尘');
});

test('浮尘 helper：rng(99) 确定布局、y<160 回 700（规格 §6.4）', () => {
  const a = makeDust(26, 99), b = makeDust(26, 99);
  assert.equal(a.length, 26);
  assert.deepEqual(a[0], b[0]);                                  // 同种子同布局（可复现）
  assert.ok(a.every(d => d.y >= 160 && d.y <= 700));
  const d = a[0]; d.y = 161; d.v = 1000;
  stepDust(a, 0.1);
  assert.equal(d.y, 700);                                        // 上浮出顶 → 回到底部
});

test('makeWorld：浮尘 26 / 出口金尘 12 / 双火把余烬计时就绪', () => {
  const g = createGame(content, ch1Profile);
  const w = kit.makeWorld({ content, profile: ch1Profile, game: g });
  assert.equal(w.view.dust.length, 26);
  assert.equal(w.view.gold.length, 12);
  assert.equal(w.view.emberT.length, 2);
});

test('余烬：双火把各按 0.7–1.4s 节奏上飘，进星星池并带 ember 标', () => {
  const g = createGame(content, ch1Profile);
  const w = kit.makeWorld({ content, profile: ch1Profile, game: g });
  w.game = g; w.content = content;                               // 壳在 makeWorld 后补挂（同 shell.js）
  w.keys = new Set(); w.run = () => {}; w.sfx = { click() {}, glowTick() {}, mutter() {} };
  kit.tick(w, 1.5);                                              // 一次性推进 1.5s：两颗必出（间隔上限 1.4s）
  const embers = w.view.stars.filter(s => s.kind === 'ember');
  assert.equal(embers.length, 2);
  assert.ok(w.view.emberT.every(t => t >= 0.7 && t < 1.4));      // 下一颗间隔回到 0.7–1.4s
});
