import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { createGame, gameEvent, jumpDebug, startGame, kit, LIGHTS2, tapTargetAt, crossMargin } from '../public/js/ch2.js';
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
  assert.ok(out.some(i => i.t === 'crossed'));                          // 演出指令；hint 'exit' 由 runExtras.crossed 延后 0.9s
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

test('runExtras.crossed：22 金星 + 暖晕/雾脉冲/火把涌亮 + 声序 + hint 延后 0.9s', async () => {
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

test('runExtras.fell：wind + thud（不再 mutter）+ 尘', () => {
  const sounds = [];
  const w = {
    geo: { groundY: 600, chasmL: 700 },
    view: { puffs: [] },
    player: { x: 800, y: 900, vy: 500, airborne: true },
    sfx: { wind: () => sounds.push('wind'), thud: () => sounds.push('thud'), mutter: () => sounds.push('mutter') }
  };
  kit.runExtras.fell(w);
  assert.deepEqual(sounds, ['wind', 'thud']);
  assert.ok(w.view.puffs.length > 0);
  assert.equal(w.player.x, w.geo.chasmL - 90);
  assert.equal(w.player.airborne, false);
});

test('起跳 hop / 落地 thud / 掉石 hatPuff：音频接线（规格 §7.1）', () => {
  const g = createGame(content, ch1Profile);
  const w = kit.makeWorld({ content, profile: ch1Profile, game: g });
  w.game = g; w.content = content;
  const sounds = [];
  w.sfx = { hop: () => sounds.push('hop'), thud: () => sounds.push('thud'), hatPuff: () => sounds.push('hatPuff'),
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
  kit.runExtras.drop(w, { t: 'drop', word: 'jump' });         // chasm-try 掉石 → hatPuff
  assert.ok(sounds.includes('hatPuff'));
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
