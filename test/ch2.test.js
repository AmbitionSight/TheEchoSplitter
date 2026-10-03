import { test } from 'node:test';
import assert from 'node:assert';
import { readFile, readdir } from 'node:fs/promises';
import { createGame, gameEvent, jumpDebug, startGame, kit, LIGHTS2, tapTargetAt, crossMargin,
         CAT, catClickable, stepCat, windDelay, windNow, lightScales, stepFellSlide,
         makeRubble, stepRubble, HINT_UNLOCKED } from '../public/js/ch2.js';
import { createProfile, mergeProfile, seedMemory, neededSeeds } from '../public/js/profile.js';
import { createInventory, addStone, stoneCount } from '../public/js/hotbar.js';
import { planDropStones, drawTorchSide, drawBenchSide, makeDust, stepDust, SIDE } from '../public/js/sideview.js';
import { CHAPTER_DAY } from '../public/js/shell.js';

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
  assert.ok(out.some(i => i.t === 'crossed'));                          // 演出指令；hint 'exit' 由 runExtras.crossed 延后 0.9s
  out = gameEvent(g, 'EXIT');
  assert.ok(out.some(i => i.t === 'summary'));
  assert.equal(g.exited, true);
});

test('FELL：软重生无惩罚（提示）；TICK 链按进度给提示', () => {
  const g = createGame(content, ch1Profile);
  const out = gameEvent(g, 'FELL');
  assert.ok(out.some(i => i.t === 'fell'));
  assert.ok(!out.some(i => i.t === 'meow'));                          // 坠落不惊动猫（2a 猫只随 crossed 离场，规格 §9）
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

test('调试拍名：§3.6 总表正名逐拍可 G.jump（chasm-try/craft-jump/use-jump/fell/exit-2a/listen-*）', () => {
  const mk = () => {
    const g = createGame(content, ch1Profile);
    seedMemory(g.inv, addStone, ch1Profile.everPicked);        // p 记忆石（同真实开局）
    return g;
  };
  // 正名 chasm-try 与旧别名 drop 等价
  for (const b of ['chasm-try', 'drop']) {
    const g = mk();
    assert.ok(jumpDebug(g, b).some(i => i.t === 'drop' && i.word === 'jump'), `${b} → 掉石`);
    assert.equal(g.attempted, true, `${b} → chasm-try 状态`);
  }
  // 正名 craft-jump 与旧别名 crafted 等价（+0.9s 揭示卡 = reveal-jump 拍）
  for (const b of ['craft-jump', 'crafted']) {
    const g = mk();
    assert.ok(jumpDebug(g, b).some(i => i.t === 'revealCard' && i.word === 'jump'), `${b} → 揭示卡`);
    assert.ok(g.book.has('jump'), `${b} → 合成成功`);
  }
  // use-jump / unlocked：同一条路（解锁跳跃）
  for (const b of ['use-jump', 'unlocked']) {
    const g = mk();
    jumpDebug(g, b);
    assert.equal(g.jumpUnlocked, true, `${b} → 解锁跳跃`);
  }
  // fell：坠落演出（wind + thud + 崖缘滑回由 runExtras.fell 给）
  const gf = mk();
  assert.ok(jumpDebug(gf, 'fell').some(i => i.t === 'fell'), 'fell → 坠落演出');
  // exit-2a：位置依赖拍 → 传送到出口（规格 §3.5）
  const ge = mk();
  assert.deepEqual(jumpDebug(ge, 'exit-2a'),
    [{ t: 'teleport', x: content.geometry.exitX, y: content.geometry.groundY }], 'exit-2a → 传送出口');
  // listen-*：三个听声点拍可直接跳
  for (const id of ['warm', 'fall', 'shine']) {
    const g = mk();
    assert.ok(jumpDebug(g, 'listen-' + id).some(i => i.t === 'echo'), `listen-${id} → 回声`);
  }
});

test('无缝交接：裂谷声明后继为崖壁（第二章后半），且可动态载入其 kit', async () => {
  assert.equal(kit.next?.chapter, 2);
  assert.equal(kit.next?.label, '第二章 · 崖壁');       // veil 文案（规格 §11）
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

test('makeWorld：浮尘 26 / 出口金尘 12 / 双火把余烬计时就绪 / 谷底碎石流 3 粒', () => {
  const g = createGame(content, ch1Profile);
  const w = kit.makeWorld({ content, profile: ch1Profile, game: g });
  assert.equal(w.view.dust.length, 26);
  assert.equal(w.view.gold.length, 12);
  assert.equal(w.view.emberT.length, 2);
  assert.equal(w.view.rubble.length, 3);                        // 谷底碎石流（规格 §8）
  assert.equal(w.view.torchBeatT, 0);                           // 光响应拍计时就绪（规格 §6.3）
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

// ================= Task 10：2a 演出与音频（规格 §3.2 / §7） =================

test('LISTEN 音效读 spot.sfx；无 sfx 的听声点回落 glowTick', () => {
  const g = createGame(content, ch1Profile);
  assert.ok(gameEvent(g, 'LISTEN', 'warm').some(i => i.t === 'sfx' && i.name === 'crackle'));
  assert.ok(gameEvent(g, 'LISTEN', 'fall').some(i => i.t === 'sfx' && i.name === 'wind'));
  assert.ok(gameEvent(g, 'LISTEN', 'shine').some(i => i.t === 'sfx' && i.name === 'bloom'));
  const gc = createGame({ ...content, listening: [{ id: 'x', x: 0, y: 0, r: 10, echo: [], say: '' }] }, ch1Profile);
  assert.ok(gameEvent(gc, 'LISTEN', 'x').some(i => i.t === 'sfx' && i.name === 'glowTick'));
});

test('CRAFT 首次成功追加 revealCard；未集齐与重复合成不再弹', () => {
  const g = createGame(content, ch1Profile);
  assert.ok(!gameEvent(g, 'CRAFT', 'jump').some(i => i.t === 'revealCard'));   // 石未齐 → 无卡
  seedMemory(g.inv, addStone, ch1Profile.everPicked);
  for (const ipa of ['dʒ', 'ʌ', 'm']) { gameEvent(g, 'PICKUP', ipa); gameEvent(g, 'BANK'); }
  const out = gameEvent(g, 'CRAFT', 'jump');
  assert.ok(out.some(i => i.t === 'revealCard' && i.word === 'jump'));
  assert.ok(!gameEvent(g, 'CRAFT', 'jump').some(i => i.t === 'revealCard'));   // 词具不消耗但只揭示一次
});

test('CROSS：首次给 crossed 演出指令与 beat，重复不再触发', () => {
  const g = createGame(content, ch1Profile);
  const out = gameEvent(g, 'CROSS');
  assert.ok(out.some(i => i.t === 'crossed'));
  assert.ok(out.some(i => i.t === 'beat' && i.beat === 'crossed'));
  assert.deepEqual(gameEvent(g, 'CROSS'), []);
});

test('调试拍 crossed：teleport 到对岸并触发 crossed 演出', () => {
  const g = createGame(content, ch1Profile);
  const out = jumpDebug(g, 'crossed');
  const tp = out.find(i => i.t === 'teleport');
  assert.ok(tp && tp.x > content.geometry.chasmR, '先传送到对岸');
  assert.ok(out.some(i => i.t === 'crossed'));
});

test('runExtras.revealCard：+0.9s 卡开 chime + ui.reveal(word)', async () => {
  const sounds = [], cards = [];
  const w = { sfx: { chime: () => sounds.push('chime') }, ui: { reveal: word => { cards.push(word); return Promise.resolve(); } } };
  kit.runExtras.revealCard(w, { t: 'revealCard', word: 'jump' });
  await new Promise(r => setTimeout(r, 50));
  assert.deepEqual(sounds, []);
  assert.deepEqual(cards, []);                                // 卡不提前弹
  await new Promise(r => setTimeout(r, 900));
  assert.deepEqual(sounds, ['chime']);                        // 揭示卡开 chime（规格 §7.1）
  assert.deepEqual(cards, ['jump']);
});

test('runExtras.crossed：22 金星 + 暖晕/雾脉冲/火把涌亮 + 猫离场倒计时 + 声序 + hint 延后 0.9s', async () => {
  const sounds = [], spoke = [], hints = [];
  const w = {
    geo: { groundY: 600 },
    view: { stars: [], puffs: [], torchSurge: 0 },            // 同 makeWorld 初值
    player: { x: 960, y: 600, squash: 0 },
    sfx: { chime: () => sounds.push('chime'), wind: () => sounds.push('wind') },
    speak: (text, who) => spoke.push([who, text]),
    ui: { setHint: key => hints.push(key) }
  };
  kit.runExtras.crossed(w, { t: 'crossed' });
  assert.equal(w.view.stars.length, 22);                      // 22 金星
  assert.equal(w.view.glowT, 1.2);                            // 预渲染暖晕涌起计时（1.2s 光涌）
  assert.equal(w.view.torchSurge, 0);                         // 火把池涌亮按 §3.4 排在 t+0.5s
  assert.equal(w.view.catLeaveT, 1.0);                        // 猫：落地起 1s 可点窗口，t+1.0s 起身走远（规格 §9）
  assert.ok(w.player.squash > 0);                             // 落地 squash
  assert.equal(w.view.puffs.length, 2);                       // 尘环
  assert.deepEqual(sounds, ['chime']);                        // t0 落地 chime
  assert.deepEqual(hints, []);
  await new Promise(r => setTimeout(r, 260));
  assert.deepEqual(spoke, [['child', 'Jump!']]);              // t+0.2s 童声喊 "Jump!"
  await new Promise(r => setTimeout(r, 220));
  assert.deepEqual(sounds, ['chime', 'wind']);                // t+0.4s 风一阵
  assert.ok(w.view.mistPulse > 0);                            // 谷雾被吹散
  await new Promise(r => setTimeout(r, 120));
  assert.equal(w.view.torchSurge, 0.8);                       // t+0.5s 对岸火把池 0.8s 涌亮
  await new Promise(r => setTimeout(r, 400));
  assert.deepEqual(hints, ['exit']);                          // hint 延后 0.9s
});

test('runExtras.teleport：调试传送清干净运动态', () => {
  const w = { player: { x: 0, y: 0, vy: 99, airborne: true, moving: true }, walkTo: { x: 5 } };
  kit.runExtras.teleport(w, { t: 'teleport', x: 1015, y: 600 });
  assert.deepEqual([w.player.x, w.player.y], [1015, 600]);
  assert.deepEqual([w.player.vy, w.player.airborne, w.player.moving, w.walkTo], [0, false, false, null]);
});

test('runExtras.fell：wind + thud（不再 mutter）+ 尘 + 暗角收拢 + 崖缘滑回（非瞬移）', () => {
  const sounds = [];
  const w = {
    geo: { groundY: 600, chasmL: 700 },
    view: { puffs: [], fellSlide: null, squeezeT: 0 },
    player: { x: 800, y: 900, vy: 500, airborne: true, walkT: 0 },
    walkTo: { x: 900 }, pending: { kind: 'chasm' },
    sfx: { wind: () => sounds.push('wind'), thud: () => sounds.push('thud'), mutter: () => sounds.push('mutter') }
  };
  kit.runExtras.fell(w);
  assert.deepEqual(sounds, ['wind', 'thud']);
  assert.ok(w.view.puffs.length > 0);
  assert.ok(w.view.squeezeT > 0, '暗角收拢（规格 §3.2）');
  assert.ok(w.view.chasmDipT > 0, '缝口暖光眨眼式压暗（规格 §6.3）');
  assert.ok(w.view.fellSlide, '滑回 tween 就位（非瞬移）');
  assert.ok(w.player.x >= w.geo.chasmL - 40, '先放在崖缘');
  assert.notEqual(w.player.x, w.geo.chasmL - 90);
  assert.equal(w.player.airborne, false);
  assert.equal(w.walkTo, null); assert.equal(w.pending, null);       // 落谷清走位
  for (let i = 0; i < 30; i++) stepFellSlide(w, 1 / 60);             // 0.4s 后
  assert.equal(w.view.fellSlide, null);
  assert.equal(w.player.x, w.geo.chasmL - 90, '滑回安全点');
  assert.equal(w.player.y, w.geo.groundY);
  assert.equal(w.player.airborne, false);
});

test('起跳 hop / 落地 thud / 掉石 hatPuff：音频接线（规格 §7.1）', () => {
  const g = createGame(content, ch1Profile);
  const w = kit.makeWorld({ content, profile: ch1Profile, game: g });
  w.game = g; w.content = content;
  const sounds = [];
  w.sfx = { hop: () => sounds.push('hop'), thud: () => sounds.push('thud'), hatPuff: () => sounds.push('hatPuff'),
            wind: () => sounds.push('wind'),
            glowTick: () => sounds.push('glowTick'), click: () => sounds.push('click'), chime: () => sounds.push('chime') };
  w.ui = { setHint() {} };
  w.run = () => {};
  w.cfg.onLand(300);                                          // 普通落地 → thud
  assert.deepEqual(sounds, ['thud']);
  g.jumpUnlocked = true;
  kit.onSpace(w);                                             // 空格起跳 → hop
  assert.deepEqual(sounds, ['thud', 'hop']);
  assert.ok(w.player.airborne);
  kit.runExtras.effect(w, { t: 'effect', name: 'jumpUnlock', full: true });   // use-jump 首次示范跳 → hop
  assert.deepEqual(sounds, ['thud', 'hop', 'hop']);
  assert.equal(w.player.vy, -740);
  kit.runExtras.drop(w, { t: 'drop', word: 'jump' });         // chasm-try 掉石 → hatPuff + 一次性风
  assert.ok(sounds.includes('hatPuff'));
  assert.ok(sounds.includes('wind'));                         // chasm-try 一次性风（规格 §9）
  assert.ok(w.stones.length > 0);
});

test('chapter2.html 的 #reveal 块与 index.html 同构（揭示卡可弹）', async () => {
  const read = f => readFile(new URL('../public/' + f, import.meta.url), 'utf8');
  const [idx, ch2] = await Promise.all([read('index.html'), read('chapter2.html')]);
  const block = s => s.split('<div id="reveal"')[1]?.split('<div id="summary"')[0].replace(/\s+/g, ' ').trim();
  assert.ok(block(idx), 'index.html 有 #reveal 块');
  assert.equal(block(ch2), block(idx));
});

// ================= Task 11：2a 交互（指针/拖拽/跳键，规格 §10） =================

// 逻辑画布 1280×720 的 mock：client 坐标 = 逻辑坐标（scale 1）
function mockCV() {
  return { style: {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }) };
}

test('指针命中表：石/台/听声点/裂谷/出口/自身（顺序镜像 findE）', () => {
  const geo = content.geometry;
  const base = {
    geo, content,
    player: { x: 140, y: geo.groundY },
    stones: [{ ipa: 'dʒ', x: 400, y: geo.groundY - 14, state: 'idle' }],
    game: { hand: null }
  };
  assert.equal(tapTargetAt(base, { x: 402, y: 584 }).kind, 'stone');
  assert.equal(tapTargetAt(base, { x: 470, y: 520 }).id, 'bench');
  assert.equal(tapTargetAt(base, { x: 690, y: 580 }).id, 'fall');           // 裂口左缘听声点
  const gap = tapTargetAt(base, { x: 760, y: 380 });                        // 本侧点裂口 = 要过去
  assert.equal(gap.kind, 'chasm');
  assert.equal(gap.x, geo.chasmL - 28);                                     // 助跑止点 chasmL−28
  assert.equal(tapTargetAt(base, { x: 950, y: 580 }).kind, 'chasm');        // 对岸听声点隔着裂口，先读作过坑
  assert.equal(tapTargetAt(base, { x: 1100, y: 400 }).kind, 'chasm');       // 对岸出口同样先读作过坑
  const right = { ...base, player: { x: 1000, y: geo.groundY } };           // 过坑后：对岸一切可达
  assert.equal(tapTargetAt(right, { x: 950, y: 580 }).id, 'shine');
  assert.equal(tapTargetAt(right, { x: 1150, y: 560 }).id, 'exit');
  assert.equal(tapTargetAt(base, { x: 300, y: 300 }), null);                // 空处：无目标 → 只走位
  assert.equal(tapTargetAt(base, { x: 148, y: 560 }), null);                // 空手点自己无目标
  const held = { ...base, game: { hand: { kind: 'item', word: 'jump' } } };
  assert.equal(tapTargetAt(held, { x: 148, y: 560 }).id, 'self');           // 手持词具点自己 90px 内
});

test('过坑余量算术：0.99s × 330 ≈ 326px > 268px 需求，余量 ≈58px', () => {
  const m = crossMargin(content.geometry);
  assert.ok(Math.abs(m - 58) < 2, `余量 ${m}px 应 ≈58px`);
  assert.ok(crossMargin(content.geometry, 300) > 0);                        // 300 也够（≈28px 余量）
  assert.ok(crossMargin(content.geometry, 250) < 0);                        // 250 不够：这就是显式设 330 的理由
});

test('kit 导出指针入口：onPointerDown/onDropItem/onKey', () => {
  assert.equal(typeof kit.onPointerDown, 'function');
  assert.equal(typeof kit.onDropItem, 'function');
  assert.equal(typeof kit.onKey, 'function');
});

test('onPointerDown：点哪走哪 + pending；本侧点对岸钳到助跑止点', () => {
  const g = createGame(content, ch1Profile);
  const w = {
    game: g, content, geo: content.geometry, stones: [],
    player: { x: 140, y: content.geometry.groundY }
  };
  kit.onPointerDown(w, { clientX: 470, clientY: 520 }, mockCV());
  assert.equal(w.pending.id, 'bench');
  assert.equal(w.walkTo.x, content.geometry.benchX);
  kit.onPointerDown(w, { clientX: 1000, clientY: 400 }, mockCV());          // 点对岸
  assert.equal(w.pending.kind, 'chasm');
  assert.equal(w.walkTo.x, content.geometry.chasmL - 28);                   // 未解锁也先钳在本侧
  kit.onPointerDown(w, { clientX: 200, clientY: 300 }, mockCV());           // 空处：走到点击 x（钳制）
  assert.equal(w.pending, null);
  assert.equal(w.walkTo.x, 200);
});

test('onKey 清走位（pending 一并清；键盘接管移动）', () => {
  const w = { walkTo: { x: 500 }, pending: { kind: 'chasm' } };
  kit.onKey(w);
  assert.equal(w.walkTo, null);
  assert.equal(w.pending, null);
});

test('走位到位：tick 调 stepWalkTo 后按同一路径 doE（合成台）', () => {
  const g = createGame(content, ch1Profile);
  const w = kit.makeWorld({ content, profile: ch1Profile, game: g });
  w.game = g; w.content = content;
  w.keys = new Set();
  w.run = () => {};
  w.sfx = { thud() {}, hop() {}, click() {}, glowTick() {}, mutter() {}, chime() {}, wind() {}, hatPuff() {} };
  w.ui = { setHint() {} };
  const done = [];
  w.doE = t => done.push(t);
  kit.onPointerDown(w, { clientX: 420, clientY: 560 }, mockCV());
  for (let i = 0; i < 120 && !done.length; i++) kit.tick(w, 1 / 60);
  assert.ok(done.some(t => t.id === 'bench'), '到位后走 doE（与按 E 同一条路径）');
  assert.equal(w.pending, null);
  assert.equal(w.walkTo, null);
});

test('onDropItem：jump 拖到自己 90px 内 = USE(player)，其余 = mutter', () => {
  const g = createGame(content, ch1Profile);
  const ran = [], muted = [];
  const w = {
    cv: mockCV(), game: g, player: { x: 300, y: content.geometry.groundY },
    run: ins => ran.push(...ins), sfx: { mutter: () => muted.push(1) }
  };
  kit.onDropItem(w, 'jump', 320, 560);
  assert.ok(ran.some(i => i.t === 'effect' && i.name === 'jumpUnlock' && i.full === true));
  kit.onDropItem(w, 'jump', 900, 300);                                      // 拖到远处：纹丝不动 + 咕哝
  assert.deepEqual(muted, [1]);
});

test('点对岸自动助跑跳：助跑 → 起跳 → 空中右推 → 落对岸触发 CROSS', () => {
  const g = createGame(content, ch1Profile);
  g.jumpUnlocked = true;
  const w = kit.makeWorld({ content, profile: ch1Profile, game: g });
  w.game = g; w.content = content;
  w.keys = new Set();
  w.run = () => {};
  w.sfx = { thud() {}, hop() {}, click() {}, glowTick() {}, mutter() {}, chime() {}, wind() {}, hatPuff() {} };
  w.ui = { setHint() {} };
  w.doE = () => {};
  kit.onPointerDown(w, { clientX: 1100, clientY: 400 }, mockCV());
  assert.equal(w.pending.kind, 'chasm');
  assert.equal(w.walkTo.x, content.geometry.chasmL - 28);
  for (let i = 0; i < 600 && !w.game.crossed; i++) kit.tick(w, 1 / 60);
  assert.ok(w.game.crossed, '自动跳过坑（CROSS 已触发）');
  assert.ok(w.player.x > w.geo.chasmR, '落在对岸');
  assert.ok(!w.keys.has('r') && !w.autoCross, '落地收回空中右推');
});

test("hint 'unlocked' 文案不再绑定空格（触屏跳键/点对岸同一条路）", () => {
  const hints = [];
  const w = { ui: { setHint: k => hints.push(k) } };
  kit.runExtras.hint(w, { t: 'hint', key: 'unlocked' });
  kit.runExtras.hint(w, { t: 'hint', key: 'start' });
  assert.ok(!/空格/.test(hints[0]), `unlocked 提示不应提空格：${hints[0]}`);
  assert.equal(hints[1], 'start');                                          // 其余提示仍走内容键
});

test('chapter2.html：#btn-jump 触屏跳键（初始隐藏）与 style.css 接线', async () => {
  const read = f => readFile(new URL('../public/' + f, import.meta.url), 'utf8');
  const [html, css, src] = await Promise.all([read('chapter2.html'), read('css/style.css'), read('js/ch2.js')]);
  assert.match(html, /<button id="btn-jump"[^>]*class="[^"]*hidden/, '#btn-jump 初始隐藏（unlocked 同拍显示）');
  assert.match(css, /#btn-jump\{/, 'style.css 有 #btn-jump 定位');
  assert.match(css, /#game\{[^}]*touch-action:none/, '画布禁浏览器手势（点哪走哪）');
  assert.match(src, /iconURL\('jump'\)/, '跳键图标 = jump');
});

// ================= Task 12：2a 猫与环境风（规格 §9） =================

test('2a 对岸橘猫与环境风：源码含 drawCat 调用与 wind() 调用点', async () => {
  const src = await readFile(new URL('../public/js/ch2.js', import.meta.url), 'utf8');
  assert.match(src, /drawCat\(/, '复用 actors.js drawCat 画对岸猫');
  assert.match(src, /sfx\.wind\(\)/, 'wind() 有真实调用点（规格 §9）');
  assert.match(src, /CAT = \{ x: 1015/, '猫坐对岸 (1015,600)');
});

test('makeWorld：猫坐对岸 (1015,600) 待命；环境风计时 8–14s 就绪', () => {
  const g = createGame(content, ch1Profile);
  const w = kit.makeWorld({ content, profile: ch1Profile, game: g });
  assert.deepEqual([w.actors.cat.x, w.actors.cat.y], [CAT.x, content.geometry.groundY]);
  assert.equal(w.actors.cat.seated, true);
  assert.equal(w.actors.cat.gone, false);
  assert.ok(w.view.windT >= 8 && w.view.windT <= 14, '出生点远离裂口：常态间隔');   // 规格 §9
  assert.equal(w.view.catLeaveT, 0);                            // 未过坑：无离场倒计时
});

test('环境风调度：常态 8–14s；近裂口（±300px）间隔减半更密', () => {
  const geo = content.geometry;
  assert.equal(windDelay(140, geo, () => 0), 8);                // 远处下限
  assert.equal(windDelay(140, geo, () => 1), 14);               // 远处上限
  assert.equal(windDelay(geo.chasmL, geo, () => 0), 4);         // 裂口边：减半
  assert.equal(windDelay(geo.chasmR + 120, geo, () => 1), 7);
});

test('环境风：tick 到点吹一阵并重置；windNow 一次性风重置计时', () => {
  const g = createGame(content, ch1Profile);
  const w = kit.makeWorld({ content, profile: ch1Profile, game: g });
  w.game = g; w.content = content; w.keys = new Set(); w.run = () => {};
  const sounds = [];
  w.sfx = { wind: () => sounds.push('wind'), thud() {}, hop() {}, click() {}, glowTick() {}, mutter() {}, chime() {}, hatPuff() {} };
  w.ui = { setHint() {} };
  w.view.windT = 0.05;
  kit.tick(w, 0.1);
  assert.deepEqual(sounds, ['wind']);                           // 到点一阵
  assert.ok(w.view.windT >= 4, '吹完重置为下一段间隔');
  sounds.length = 0;
  w.view.windT = 100;
  windNow(w);                                                   // chasm-try/fell/crossed 一次性
  assert.deepEqual(sounds, ['wind']);
  assert.ok(w.view.windT >= 4 && w.view.windT <= 14, '一次性风把环境风计时重置');
});

test('猫可点窗口：crossed 落地后 1s 内可点；未过坑/已起身/已走远不可点', () => {
  const w = { actors: { cat: { seated: true, gone: false } }, view: { catLeaveT: 0 } };
  assert.equal(catClickable(w), false);                         // 未过坑
  w.view.catLeaveT = 1.0;
  assert.equal(catClickable(w), true);                          // 落地 1s 窗口内
  w.view.catLeaveT = 0;
  assert.equal(catClickable(w), false);                         // 窗口已过
  w.view.catLeaveT = 0.5; w.actors.cat.seated = false;
  assert.equal(catClickable(w), false);                         // 已起身走远
  w.actors.cat.seated = true; w.actors.cat.gone = true;
  assert.equal(catClickable(w), false);                         // 已走出画面
});

test('猫离场：crossed 后满 1s 喵一声起身，向右走出画面后 gone', () => {
  const w = {
    actors: { cat: { x: CAT.x, y: 600, seated: true, gone: false, vx: 0 } },
    view: { catLeaveT: CAT.leaveDelay }
  };
  assert.deepEqual(stepCat(w, 0.6), []);                        // 窗口内：仍坐着（可点）
  assert.deepEqual(stepCat(w, 0.4), [{ t: 'meow' }]);           // 满 1s：起身喵一声（壳给竖耳）
  assert.equal(w.actors.cat.seated, false);
  assert.ok(w.actors.cat.vx > 0, '向右走');
  const x0 = w.actors.cat.x;
  stepCat(w, 1);
  assert.ok(w.actors.cat.x > x0);
  for (let i = 0; i < 40; i++) stepCat(w, 0.5);                 // 一路向右
  assert.equal(w.actors.cat.gone, true);                        // exit-2a 前已走出画面
});

test('tick 驱动猫离场：crossed 1s 后 meow、约 3s 后走出画面', () => {
  const g = createGame(content, ch1Profile);
  const w = kit.makeWorld({ content, profile: ch1Profile, game: g });
  w.game = g; w.content = content; w.keys = new Set();
  const ran = [];
  w.run = ins => ran.push(...ins);
  w.sfx = { wind() {}, thud() {}, hop() {}, click() {}, glowTick() {}, mutter() {}, chime() {}, meow() {}, hatPuff() {} };
  w.ui = { setHint() {} };
  w.view.catLeaveT = CAT.leaveDelay;                            // 模拟 crossed 演出已开
  for (let i = 0; i < 60 * 4; i++) kit.tick(w, 1 / 60);
  assert.ok(ran.some(i => i.t === 'meow'), '1s 后猫自己喵一声');
  assert.equal(w.actors.cat.gone, true, '4s 内走出画面');
});

test('点猫：1s 窗口内点击 → meow（不占走位）；窗口外走普通命中表', () => {
  const g = createGame(content, ch1Profile);
  const w = kit.makeWorld({ content, profile: ch1Profile, game: g });
  w.game = g; w.content = content;
  const ran = [];
  w.run = ins => ran.push(...ins);
  w.view.catLeaveT = CAT.leaveDelay;                            // 落地窗口内
  kit.onPointerDown(w, { clientX: 1015, clientY: 570 }, mockCV());
  assert.ok(ran.some(i => i.t === 'meow'), '窗口内点猫 → meow + 竖耳（壳）');
  assert.equal(w.pending, null, '点猫不占用走位');
  ran.length = 0;
  w.view.catLeaveT = 0;                                         // 窗口外：猫不在命中表
  kit.onPointerDown(w, { clientX: 1015, clientY: 570 }, mockCV());
  assert.ok(!ran.some(i => i.t === 'meow'));
  assert.equal(w.pending.kind, 'chasm', '本侧点对岸仍读作过坑');
});

test('CAT：事件机返回 meow 指令（竖耳由壳的 meow 分支给）', () => {
  const g = createGame(content, ch1Profile);
  assert.deepEqual(gameEvent(g, 'CAT'), [{ t: 'meow' }]);
});

test('summaryMerge 含 picks：2a 声音石拾取数进书档（两半合计，规格 §12）', () => {
  const g = createGame(content, ch1Profile);
  assert.equal(kit.summaryMerge(g).picks, 0, '未拾取：0');
  gameEvent(g, 'CHASM');                                              // 首次尝试：掉 dʒ/ʌ/m + 干扰 h/l
  gameEvent(g, 'PICKUP', 'dʒ');
  const payload = kit.summaryMerge(g);
  assert.equal(payload.picks, 1, '捡起 1 块 → picks=1（2b 结算再累加）');
  assert.equal(payload.chapter, 2);
  assert.deepEqual(payload.abilities, ['jump'], '2a 结算给下一半 jump 能力');
});

// ================= 2a 补漏（审计：光响应/坠谷滑回/谷底碎石/unlocked 落地/重复用词） =================

test('光响应节拍：lightScales 缩放 LIGHTS2 的 s（chasm-try/unlocked/crossed/fell，规格 §6.3）', () => {
  const base = { torchBeatT: 0, torchBeatM: 1, chasmBreathT: 0, chasmBoostT: 0, chasmBoostM: 1, chasmDipT: 0 };
  assert.deepEqual(lightScales(base, false), { torchL: 1, torchR: 1, chasm: 1, exit: 1 });
  const tryB = lightScales({ ...base, torchBeatT: 0.3, torchBeatM: 1.25 }, false);
  assert.equal(tryB.torchL, 1.25); assert.equal(tryB.torchR, 1.25);            // chasm-try：双火焰 ×1.25
  const mid = lightScales({ ...base, chasmBreathT: 0.8 }, false);              // 呼吸半程 = 峰值
  assert.ok(Math.abs(mid.chasm - 1.5) < 1e-9, '缝口呼吸峰值 .16→.24（×1.5）');
  const start = lightScales({ ...base, chasmBreathT: 1.6 }, false);            // 起止回基线
  assert.ok(Math.abs(start.chasm - 1) < 1e-9);
  const unlock = lightScales({ ...base, torchBeatT: 0.3, torchBeatM: 1.3, chasmBoostT: 0.3, chasmBoostM: 1.2 }, false);
  assert.equal(unlock.torchL, 1.3); assert.ok(Math.abs(unlock.chasm - 1.2) < 1e-9);   // unlocked：火把 ×1.3、缝口 +20%
  const dip = lightScales({ ...base, chasmDipT: 0.3 }, false);
  assert.equal(dip.chasm, 0.5);                                                // fell：×0.5
  const cross = lightScales(base, true);
  assert.ok(Math.abs(cross.exit - 0.20 / 0.12) < 1e-9, 'crossed：出口 .12→.20');
  assert.ok(Math.abs(cross.chasm - 1.25) < 1e-9, 'crossed：缝口 +.04（×1.25）');
});

test('chasm-try 光响应：shrug 触发双火焰 ×1.25/0.5s 与缝口 1.6s 呼吸（规格 §6.3）', () => {
  const w = { player: {}, view: {} };
  kit.runExtras.shrug(w);
  assert.equal(w.player.squash, 0.9);
  assert.equal(w.view.torchBeatM, 1.25);
  assert.equal(w.view.torchBeatT, 0.5);
  assert.equal(w.view.chasmBreathT, 1.6);
});

test('坠谷滑回保险：超大 dt 也一次到位（软重生绝不卡死）', () => {
  const w = {
    geo: { groundY: 600, chasmL: 700 },
    view: { puffs: [], fellSlide: null, squeezeT: 0 },
    player: { x: 800, y: 900, vy: 500, airborne: true, walkT: 0 },
    sfx: { wind() {}, thud() {} }
  };
  kit.runExtras.fell(w);
  stepFellSlide(w, 10);                                                      // 一帧跨完 0.4s
  assert.equal(w.view.fellSlide, null);
  assert.equal(w.player.x, w.geo.chasmL - 90);
  assert.equal(w.player.y, w.geo.groundY);
  assert.equal(w.player.airborne, false);
});

test('谷底碎石流：2–3 粒、只在谷底 120px、落出重生（规格 §8）', () => {
  const geo = content.geometry;
  const list = makeRubble(geo);
  assert.equal(list.length, 3);
  const bandTop = SIDE.H - 120;
  for (const m of list) {
    assert.ok(m.x > geo.chasmL && m.x < geo.chasmR, '碎石只在裂谷内');
    assert.ok(m.y >= bandTop && m.y <= SIDE.H, '初始在谷底 120px 内');
  }
  const m = list[0]; m.y = SIDE.H + 10;
  stepRubble(list, 0.1, geo);
  assert.equal(m.y, bandTop, '落出谷底 → 回上沿重生');
  assert.ok(m.x > geo.chasmL && m.x < geo.chasmR);
});

test('unlocked 拍：14 金星 + 脚下青色声环 + 光响应，hint 延到落地（规格 §3.2 拍 10）', () => {
  const g = createGame(content, ch1Profile);
  const w = kit.makeWorld({ content, profile: ch1Profile, game: g });
  w.game = g; w.content = content; w.keys = new Set(); w.run = () => {};
  const hints = [];
  w.sfx = { hop() {}, thud() {}, chime() {}, wind() {}, glowTick() {}, hatPuff() {}, click() {}, mutter() {} };
  w.ui = { setHint: k => hints.push(k) };
  kit.runExtras.effect(w, { t: 'effect', name: 'jumpUnlock', full: true });
  assert.equal(w.view.stars.length, 14, '14 金星（原 10）');
  assert.deepEqual(hints, [], 'hint 不立即出：延到落地');
  assert.ok(w.view.ringT > 0, '玩家脚下青色声环就位');
  assert.equal(w.view.torchBeatM, 1.3); assert.equal(w.view.chasmBoostM, 1.2);
  const puffs0 = w.view.puffs.length;
  w.cfg.onLand(w.player.x);                                          // 示范跳落地
  assert.deepEqual(hints, [HINT_UNLOCKED], '落地才给 unlocked 提示');
  assert.ok(w.view.puffs.length > puffs0, '落地尘');
  assert.equal(w.view.demoLand, false);
});

test('重复 USE jump：glowTick 之外再念一次词（child 童声，规格 §4）', () => {
  const g = createGame(content, ch1Profile);
  const first = gameEvent(g, 'USE', { word: 'jump', target: 'player' });
  assert.ok(first.some(i => i.t === 'effect' && i.full === true));
  assert.ok(!first.some(i => i.t === 'speak'), '首次是示范跳，不重复念');
  const again = gameEvent(g, 'USE', { word: 'jump', target: 'player' });
  assert.ok(again.some(i => i.t === 'effect' && i.full === false), 'glowTick 轻反应仍在');
  assert.ok(again.some(i => i.t === 'speak' && i.who === 'child' && i.text === 'Jump.'), '再念一次');
});

test('2a 补漏接线：draw 读 lightScales、tick 推滑回与碎石（源码断言）', async () => {
  const src = await readFile(new URL('../public/js/ch2.js', import.meta.url), 'utf8');
  for (const k of ['lightScales(', 'drawLightDelta(', 'drawSoundRing(', 'drawRubble(',
                   'drawFellSqueeze(', 'stepFellSlide(w, dt)', 'stepRubble(']) {
    assert.ok(src.includes(k), `缺 ${k}`);
  }
  assert.match(src, /sc\.torchL/, '火把动态光晕 s 按拍缩放（不复制坐标）');
});

// ================= Task 19：命名统一与残留清零（规格 §11 / §14） =================

const pageSrc = f => readFile(new URL('../public/' + f, import.meta.url), 'utf8');
const jsonSrc = f => readFile(new URL('../content/' + f, import.meta.url), 'utf8').then(JSON.parse);

test('命名统一：meta / HTML 静态文案 / kit 标牌 / CHAPTER_DAY 齐步（第二章 · 裂谷/崖壁）', async () => {
  const [html2, html2b, c2, c2b] = await Promise.all([
    pageSrc('chapter2.html'), pageSrc('chapter2b.html'), jsonSrc('chapter2.json'), jsonSrc('chapter2b.json')
  ]);
  // meta 命名（规格 §11）；titleEn 前缀断言（规格 §14）
  assert.equal(c2.meta.title, '析声者 · 第二章 · 裂谷');
  assert.equal(c2.meta.titleEn, 'CHAPTER TWO · RAVINE');
  assert.equal(c2b.meta.title, '析声者 · 第二章 · 崖壁');
  assert.equal(c2b.meta.titleEn, 'CHAPTER TWO · CLIFF');
  for (const c of [c2, c2b]) assert.ok(c.meta.titleEn.startsWith('CHAPTER TWO'), 'titleEn 前缀 CHAPTER TWO');
  const pick = (s, re) => s.match(re)?.[1];
  for (const [html, c] of [[html2, c2], [html2b, c2b]]) {
    assert.equal(pick(html, /<title>(.*?)<\/title>/), c.meta.title, '<title> 与 meta.title 对齐');
    assert.equal(pick(html, /<div id="title"[\s\S]*?<p class="sub">(.*?)<\/p>/), c.meta.titleEn, '标题页 .sub 与 meta.titleEn 对齐');
    const pro = html.split('<div id="prologue"')[1].split('<p class="tap">')[0];   // 序章三句逐句 = meta.intro（2b 第三句曾走样）
    assert.deepEqual(pro.match(/<p>(.*?)<\/p>/g).map(s => s.replace(/<\/?p>/g, '')), c.meta.intro, '序章 = meta.intro');
  }
  // 结算卡：.day = CHAPTER_DAY[2]；.next = 下一章悬念
  assert.equal(pick(html2, /<p class="day">(.*?)<\/p>/), '第二章');
  assert.equal(pick(html2b, /<p class="day">(.*?)<\/p>/), '第二章');
  assert.ok(pick(html2, /<p class="next">(.*?)<\/p>/).includes('第二章 · 崖壁'), '2a 下一章悬念');
  assert.ok(pick(html2b, /<p class="next">(.*?)<\/p>/).includes('第三章'), '2b 下一章悬念（第三章合法，非「第三间房」）');
  // kit 标牌：titleRune ᚵ；CHAPTER_DAY[2] 供 veil 缺省文案
  assert.equal(kit.titleRune, 'ᚵ');
  assert.equal(CHAPTER_DAY[2], '第二章');
  // 2a 标题符文三处同步：标题页 / 书钮（HTML）+ 入口拱（ch2.js）
  assert.equal(pick(html2, /<div class="rune-float"[^>]*>(.*?)<\/div>/), 'ᚵ');
  assert.equal(pick(html2, /<button class="rune-btn" id="btn-book"[^>]*>(.*?)<\/button>/), 'ᚵ');
  assert.match(await pageSrc('js/ch2.js'), /drawArchSide\(x, 60, gy, \{ rune: 'ᚵ' \}\)/, '入口拱 ᚵ 阴刻');
});

test('残留清零：chapter2*.html / content/chapter2*.json / ch2*.js 零命中（含代码注释）', async () => {
  const found = [];
  for (const [dir, re] of [['public', /^chapter2.*\.html$/], ['content', /^chapter2.*\.json$/], ['public/js', /^ch2.*\.js$/]]) {
    for (const f of await readdir(new URL('../' + dir + '/', import.meta.url))) {
      if (re.test(f)) found.push([dir + '/' + f, new URL('../' + dir + '/' + f, import.meta.url)]);
    }
  }
  assert.deepEqual(found.map(([p]) => p).sort(), ['content/chapter2.json', 'content/chapter2b.json',
    'public/chapter2.html', 'public/chapter2b.html', 'public/js/ch2.js', 'public/js/ch2b.js'], '扫描范围即规格 §11 清单');
  for (const [p, u] of found) {
    const src = await readFile(u, 'utf8');
    assert.ok(!/第二间房|第三间房|ROOM THREE/.test(src), `${p} 残留旧命名`);
  }
});

// ================= Task 20：铁律静态扫描与顺序无关合成（规格 §1 / §14） =================

const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;    // 与 test/content.test.js:50 同正则
const latinWords = s => s.match(/[A-Za-z]+/g) ?? [];
const allStrings = o => typeof o === 'string' ? [o]
  : Array.isArray(o) ? o.flatMap(allStrings)
  : (o && typeof o === 'object') ? Object.values(o).flatMap(allStrings) : [];

test('铁律静态扫描：无 emoji、无红叉/评分/错误/弹窗、无英语字幕（全大写只余揭示卡词）', async () => {
  const raw = await readFile(new URL('../content/chapter2.json', import.meta.url), 'utf8');
  const c = JSON.parse(raw);
  const htmlRaw = await readFile(new URL('../public/chapter2.html', import.meta.url), 'utf8');
  const htmlText = htmlRaw.replace(/<script[\s\S]*?<\/script>/gi, ' ')
                           .replace(/<style[\s\S]*?<\/style>/gi, ' ')
                           .replace(/<!--[\s\S]*?-->/g, ' ')
                           .replace(/<[^>]+>/g, ' ');                     // 只看 HTML 文本（标签/属性不进扫描）
  // 1) 无 emoji（铁律 5）
  assert.ok(!EMOJI_RE.test(raw), 'content 出现 emoji');
  assert.ok(!EMOJI_RE.test(htmlRaw), 'chapter2.html 出现 emoji');
  // 2) 无红叉/评分/错误/弹窗字样（铁律 3；红叉例外只在 ch2.js 画法里，不得进文案）
  assert.doesNotMatch(raw, /红叉|评分|错误|弹窗/);
  assert.doesNotMatch(htmlRaw, /红叉|评分|错误|弹窗/);
  // 3) 无英语字幕：拉丁词只允许 IPA 载词/词名/titleEn/揭示卡词（单字母大写 = 键盘键名）
  const allowed = new Set(latinWords(c.meta.titleEn));
  const wordNames = [...Object.keys(c.words), ...Object.keys(c.lexicon ?? {})];
  for (const w of wordNames) allowed.add(w);
  for (const s of Object.values(c.carriers ?? {})) latinWords(s).forEach(w => allowed.add(w));
  for (const s of Object.values(c.phonemeBook.carriers)) latinWords(s).forEach(w => allowed.add(w));
  for (const f of Object.values(c.flows)) for (const k of ['listen', 'puzzled']) latinWords((f[k] ?? []).join(' ')).forEach(w => allowed.add(w));
  for (const s of c.listening) {
    latinWords(s.say ?? '').forEach(w => allowed.add(w));
    if (s.after) latinWords(s.after.say).forEach(w => allowed.add(w));
  }
  for (const w of Object.values(c.words)) {
    for (const ipa of [...w.phonemes.map(p => p[0]), ...(w.decoys ?? [])]) latinWords(ipa).forEach(x => allowed.add(x));
  }
  for (const ipa of [...c.phonemeBook.groups.flatMap(g => g.items), ...Object.keys(c.phonemeBook.runes)]) latinWords(ipa).forEach(x => allowed.add(x));
  const card = htmlRaw.match(/id="reveal-word"[^>]*>([^<]*)</)?.[1]?.trim();   // 揭示卡词（运行时 = word.toUpperCase()）
  const revealWords = new Set([card, ...wordNames.map(w => w.toUpperCase())]);
  for (const w of revealWords) allowed.add(w);
  assert.ok(card && revealWords.has(card), 'chapter2.html 的 #reveal-word 必须是揭示卡词');
  const noTitle = s => s.split(c.meta.titleEn).join(' ');              // titleEn 单独放行（§14）
  // 句子级：内容全值 + HTML 文本里不得出现多词拉丁串（英语字幕的最小特征）
  const sentences = [...allStrings(c), htmlText].flatMap(s => noTitle(s).match(/[A-Za-z]+(?:[\s·]+[A-Za-z]+)+/g) ?? []);
  assert.deepEqual(sentences, [], `出现英语句子: ${sentences.join(' | ')}`);
  // 词级：玩家可见文本里的拉丁词必须登记在册
  const text = [c.meta.titleEn, ...c.meta.intro, ...Object.values(c.hints ?? {}),
    ...Object.values(c.words).flatMap(w => Object.values(w.reveal ?? {})),
    ...c.listening.flatMap(s => [s.say, s.after?.say].filter(Boolean)),
    ...Object.values(c.carriers ?? {}), ...Object.values(c.phonemeBook.carriers),
    ...Object.values(c.flows).flatMap(f => [...(f.listen ?? []), ...(f.puzzled ?? [])]),
    htmlText].join('\n');
  for (const w of latinWords(noTitle(text))) {
    assert.ok(allowed.has(w) || /^[A-Z]$/.test(w), `未登记拉丁词（疑似英语字幕）: ${w}`);
  }
  // 4) 全大写拉丁词（≥2 字母）只能是揭示卡词
  const caps = [...new Set([...allStrings(c), htmlText].flatMap(s => noTitle(s).match(/(?<![A-Za-z])[A-Z]{2,}(?![A-Za-z])/g) ?? []))];
  for (const w of caps) assert.ok(revealWords.has(w), `全大写拉丁词只允许揭示卡词，发现: ${w}`);
  assert.ok(caps.includes(card), '扫描应至少命中揭示卡词本身');
});

test('听声点数量：2a 三个（warm/fall/shine，规格 §12）', () => {
  assert.equal(content.listening.length, 3);
  assert.deepEqual(content.listening.map(s => s.id), ['warm', 'fall', 'shine']);
});

test('任意合成顺序无死局：jump 四音素多种捡取顺序均能合成、库存不为负（规格 §1 第 6 条）', () => {
  const orders = [
    ['dʒ', 'ʌ', 'm', 'p'],                                          // 掉落原序
    ['ʌ', 'm', 'dʒ', 'p'],                                          // 相邻两两对调
    ['m', 'dʒ', 'ʌ', 'p'],                                          // 非相邻：m 跨过 dʒ/ʌ 先捡
    ['p', 'm', 'ʌ', 'dʒ'],                                          // 记忆石 p 先捡 + 整体逆序
  ];
  for (const order of orders) {
    const g = createGame(content, ch1Profile);
    seedMemory(g.inv, addStone, ch1Profile.everPicked);             // p 记忆石（同真实开局）
    gameEvent(g, 'CHASM');                                          // 首次掉石
    for (const ipa of order) {
      gameEvent(g, 'PICKUP', ipa);
      assert.equal(g.hand?.ipa, ipa, `${order.join('→')}：手上应是 ${ipa}`);
      gameEvent(g, 'BANK');
      assert.equal(g.hand, null, '存石后手上清空');
      for (const n of g.inv.stones.values()) assert.ok(n >= 0, `${order.join('→')}：库存出现负数`);
    }
    for (const ipa of ['dʒ', 'ʌ', 'm', 'p']) assert.ok(stoneCount(g.inv, ipa) >= 1, `${order.join('→')}：合成前缺 ${ipa}`);
    const out = gameEvent(g, 'CRAFT', 'jump');
    assert.ok(g.book.has('jump') && g.inv.items.has('jump'), `${order.join('→')} 应能合成 jump`);
    assert.ok(out.some(i => i.t === 'resonate' && i.word === 'jump'));
    for (const n of g.inv.stones.values()) assert.ok(n >= 0, '合成后库存不得为负');
  }
});

test('回归：makeWorld 阶段不得读 w.game（shell 在 makeWorld 返回后才挂 game；曾致第二关黑屏）', () => {
  const g = createGame(content, ch1Profile);
  const saved = globalThis.document;
  // 复现浏览器条件：document 存在且 #btn-jump 命中（Node 无 document 时 wireJumpBtn 会提前返回，掩盖此 bug）
  globalThis.document = { getElementById: () => ({ classList: { add() {}, remove() {} }, addEventListener() {}, innerHTML: '' }) };
  try {
    let w;
    assert.doesNotThrow(() => { w = kit.makeWorld({ content, profile: ch1Profile, game: g, cv: { style: {}, addEventListener() {} }, signal: undefined }); });
    assert.equal(w.game, undefined, 'makeWorld 返回时 w.game 尚未挂上');
    assert.equal(w.cfg.canJump, g.jumpUnlocked);
  } finally { globalThis.document = saved; }
});
