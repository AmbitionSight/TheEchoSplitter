import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { createGame, gameEvent, ropeDebug, startGame, kit, RUNE_BAND, ARCH_SPILL, LIGHTS2, makeVeil, CATB } from '../public/js/ch2b.js';
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
  assert.deepEqual(plan.map(s => s.ipa), ['r', 'h', 'm']);             // əʊ/p 是旧识不掉；h/m 是干扰音（须听辨排除）
  const wallL = content.geometry.wallX - 14;                            // 玩家最多贴到墙左 14px
  for (const s of plan) assert.ok(s.x < wallL, `石头 ${s.ipa} 落进墙里 x=${s.x}`);
  const fresh = planDropStones(content.words.rope, createInventory(), content.flows.rope.drop, content.geometry.wallX);
  assert.deepEqual(fresh.map(s => s.ipa), ['r', 'əʊ', 'p', 'h', 'm']); // 无书档：全部落地；含干扰音
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

test('听声点：LISTEN 返回回声指令（纯听觉，不进库存）；未知 id 安全', () => {
  const g = createGame(content, ch2Profile);
  const out = gameEvent(g, 'LISTEN', 'stone');
  assert.ok(out.some(i => i.t === 'echo' && i.say === 'Stone.'));
  assert.ok(!out.some(i => i.t === 'bank' || i.t === 'drop'));    // 不掉石、不进库存
  assert.deepEqual(gameEvent(g, 'LISTEN', 'nope'), []);
});

test('听声点内容：每个音素都有载词（回声条能念）', () => {
  for (const spot of content.listening) {
    for (const ipa of spot.echo) assert.ok(content.carriers[ipa] || content.phonemeBook.carriers[ipa], `${spot.id} 缺载词 ${ipa}`);
  }
});

test('听声点是实体物件：findE 认得，按 E 走 LISTEN（非走过即响）', () => {
  const g = createGame(content, ch2Profile);
  const ran = [];
  const w = { game: g, content, player: { x: 780, y: 620 }, geo: content.geometry, stones: [], run: ins => ran.push(...ins) };
  const t = kit.findE(w);
  assert.equal(t.id, 'stone');
  kit.onE(w, t);
  assert.ok(ran.some(i => i.t === 'echo' && i.say === 'Stone.'));
});

test('内容：benchX=520、warm 在火把 (240,240)、sfx 与 reveal 齐备', () => {
  const warm = content.listening.find(s => s.id === 'warm');
  assert.equal(warm.x, 240); assert.equal(warm.y, 240); assert.equal(warm.sfx, 'crackle'); assert.equal(warm.auto, true);
  assert.equal(content.geometry.benchX, 520);
  assert.equal(content.listening.find(s => s.id === 'stone').sfx, 'clack');
  assert.equal(content.listening.find(s => s.id === 'high').sfx, 'gust');
  for (const s of content.listening) assert.ok(s.sfx, `${s.id} 缺 sfx`);
  assert.ok(content.words.rope.reveal?.ok, 'rope 缺 reveal');
});

// ================= Task 13：2b 陈设与塔结构（makeBg，规格 §5.2） =================

test('2b 石刻带常量：8 枚符文 x300–664 y≈310，含 ᚱ/ᚩ/ᛈ；拱口暖光 60→220', () => {
  assert.equal(RUNE_BAND.runes.length, 8);
  for (const g of ['ᚱ', 'ᚩ', 'ᛈ']) assert.ok(RUNE_BAND.runes.includes(g), `石刻带缺 ${g}`);
  assert.equal(RUNE_BAND.x0, 300);
  assert.equal(RUNE_BAND.x0 + (RUNE_BAND.runes.length - 1) * RUNE_BAND.step, 664);   // 8 枚铺满 300–664
  assert.equal(RUNE_BAND.y, 310);
  assert.deepEqual([ARCH_SPILL.x0, ARCH_SPILL.x1], [60, 220]);        // 入口拱暖溢光（出生区照明）
});

test('2b 陈设与塔结构：入口拱/货堆/残碑/绞盘/塔柱/窗光柱烘进 makeBg（源码断言）', async () => {
  const src = await readFile(new URL('../public/js/ch2b.js', import.meta.url), 'utf8');
  for (const k of ['drawArchSide', 'drawCrates', 'drawRuinTablet', 'drawWinch', 'drawPilasters', 'drawWindowShaft']) {
    assert.ok(src.includes(k), `缺 ${k}`);
  }
  const bgAt = src.indexOf('function makeBg');
  for (const call of ['drawArchSide(x, 60, gy', 'drawArchSpill(x, geo)', 'drawCrates(x, w.atlases, gy)',
                      'drawRuinTablet(x, 780, 300)', 'drawWinch(x, 908, gy)',
                      'drawPilasters(x, geo)', 'drawWindowShaft(x, geo)']) {
    assert.ok(src.indexOf(call, bgAt) !== -1, `静态件 ${call} 应画在 makeBg 内`);
  }
  assert.match(src, /drawArchSide\(x, 60, gy, \{ rune: 'ᚱ' \}\)/, '入口拱 (60,620) ᚱ 阴刻（与 2a 出口同构）');
  assert.match(src, /'crate_big'[\s\S]*?'crate_sm'[\s\S]*?'jars2'/, '货堆 = 大木箱 + 叠小箱 + 陶罐组');
  assert.match(src, /blit\(x, w\.atlases, 'shelf'/, '木架 blit shelf (1070)');
  assert.match(src, /blit\(x, w\.atlases, 'tree'/, '盆栽树 blit tree (1180)');
  assert.match(src, /drawTorchSide\(x, L\.torch\.x, L\.torch\.y/, '左火把动态光晕读 LIGHTS2 锚点（(240,240) 由 LIGHTS2 表锁）');
  assert.match(src, /drawTorchSide\(x, L\.rope\.x, L\.rope\.y/, '绳位火把动态光晕读 LIGHTS2 锚点（(868,430) 由 LIGHTS2 表锁）');
  assert.match(src, /drawBenchSide\([^;]*\{ candle: true, t: v\.t \}\)/, 'benchX 520 合成台开蜡烛（ch1 同款）');
  assert.match(src, /blockGround: false/, '塔身壁柱只画不挡走（物理层仍 blockGround:false）');
});

// ================= Task 15：2b 光法则与夜色面纱（规格 §6.1 2b 表 / §6.2） =================

test('LIGHTS2：四锚由几何推导、含 veil 字段（规格 §6.1 2b 表）', () => {
  const L = LIGHTS2(content.geometry);
  assert.deepEqual(Object.keys(L).sort(), ['candle', 'rope', 'torch', 'window']);
  assert.deepEqual([L.torch.x, L.torch.y, L.torch.r, L.torch.s], [240, 240, 180, 0.26]);
  assert.deepEqual([L.rope.x, L.rope.y, L.rope.r, L.rope.s], [868, 430, 170, 0.20]);
  assert.deepEqual([L.candle.x, L.candle.y], [content.geometry.benchX + 62, content.geometry.groundY - 90]);
  assert.deepEqual([L.candle.r, L.candle.s], [110, 0.20]);
  assert.deepEqual([L.window.x, L.window.y], [content.geometry.exitX, content.geometry.topY]);
  assert.deepEqual([L.window.r, L.window.s], [200, 0.28]);
  const warm = content.listening.find(s => s.id === 'warm');
  assert.deepEqual([L.torch.x, L.torch.y], [warm.x, warm.y], '左火把 = warm 听声点实体');
  for (const v of Object.values(L)) {
    assert.ok(v.r > 0 && v.s > 0 && v.s <= 1);
    assert.ok(v.veil && v.veil.r > 0 && v.veil.s > 0 && v.veil.s <= 1, 'veil 字段齐备（四孔挖孔）');
  }
  assert.deepEqual([L.torch.veil.r, L.torch.veil.s, L.rope.veil.r, L.rope.veil.s], [180, 0.85, 170, 0.80]);
  assert.deepEqual([L.candle.veil.r, L.candle.veil.s, L.window.veil.r, L.window.veil.s], [120, 0.72, 230, 0.80]);
});

test('makeVeil：全屏 .34 面纱 + 四孔 destination-out 挖孔（mock 计数）', () => {
  const ops = [];
  const grad = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get(t, k) {
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => { ops.push('grad'); return grad; };
      if (k === 'fillRect') return () => ops.push('fillRect');
      if (k === 'fill') return () => ops.push('fill');
      if (k === 'createImageData' || k === 'getImageData') return (a, b, w2, h2) => {
        const w = k === 'createImageData' ? a : w2, h = k === 'createImageData' ? b : h2;
        return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
      };
      if (k === 'putImageData') return () => ops.push('putImageData');
      if (typeof k !== 'string') return undefined;
      return k in t ? t[k] : () => undefined;
    },
    set(t, k, v) { t[k] = v; return true; }
  });
  const prevDoc = globalThis.document;
  globalThis.document = { createElement: () => ({ width: 0, height: 0, getContext: () => ctx }) };
  try {
    const c = makeVeil(LIGHTS2(content.geometry));
    assert.ok(c, '返回一次性预渲染画布（draw 直接贴图）');
    assert.equal(ops.filter(o => o === 'grad').length, 4, '四孔（火把/绳位/蜡烛/高窗）');
    assert.equal(ops.filter(o => o === 'fillRect').length, 1, '全屏底色只填一次');
    assert.ok(ops.includes('putImageData'), '拜耳抖动量化后写回');
  } finally {
    globalThis.document = prevDoc;                    // 还原：冒烟测试用自己那套 mock
  }
});

test('2b 光法则单源：光池烘焙读表、面纱画在级色之后青声之前（源码断言）', async () => {
  const src = await readFile(new URL('../public/js/ch2b.js', import.meta.url), 'utf8');
  assert.match(src, /Object\.values\(w\.lights\)/, 'makeBg 光池循环锚点表（烘焙 = 动态光晕同源）');
  assert.ok(!/pixelGlow\(x, 240, 240/.test(src), '火把光池不得硬编码');
  assert.match(src, /makeVeil\(w\.lights\)/, '夜色面纱一次性预渲染（LIGHTS2 veil 锚）');
  assert.match(src, /destination-out/, '四孔 destination-out 挖孔');
  assert.match(src, /getImageData[\s\S]*?putImageData/, 'ch1 makeDarkness 同款 2px 拜耳抖动量化');
  const iGrade = src.indexOf('rgba(16,18,36,.30)');
  const iVeil = src.indexOf('drawImage(w.veil');
  const iListen = src.indexOf('drawListenSpots(x, w)');
  assert.ok(iGrade !== -1 && iVeil > iGrade && iListen > iVeil, '面纱画在级色之后、青声之前');
  assert.match(src, /上部墙转冷/, '上部墙 y<300 转冷（规格 §6.3 climb：从暖池爬进冷光）');
});

// 模拟 2D context：任何方法调用皆安全、任何属性可写（只断言"不抛"，不断言像素）；
// createImageData/getImageData 返回真数组——pixelGlow（光池烘焙）与 makeVeil（面纱抖动）要读 data
function mockCtx() {
  const grad = { addColorStop() {} };
  const bag = {};
  return new Proxy(bag, {
    get(t, k) {
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
      if (k === 'createImageData' || k === 'getImageData') return (a, b, w2, h2) => {
        const w = k === 'createImageData' ? a : w2, h = k === 'createImageData' ? b : h2;
        return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
      };
      if (typeof k !== 'string') return undefined;
      return k in t ? t[k] : () => undefined;
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

test('2b 绘制冒烟：makeBg（含全部新陈设）+ draw 三态不抛（模拟 ctx / 离屏 canvas）', () => {
  globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => mockCtx() }) };
  const g = createGame(content, ch2Profile);
  const cv = { style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }) };
  const w = kit.makeWorld({ content, profile: ch2Profile, game: g, cv, signal: undefined });
  w.content = content; w.game = g; w.atlases = null;                 // 图集未载：blit 静默兜底
  const x = mockCtx();
  assert.doesNotThrow(() => kit.draw(w, x, null), '断绳态 draw');
  g.mended = true; w.view.ropeMendT = 1.0;
  assert.doesNotThrow(() => kit.draw(w, x, { kind: 'obj', id: 'rope', x: 912, y: 620 }), '修复态 draw');
  w.player.climbing = true; w.player.y = 300;
  assert.doesNotThrow(() => kit.draw(w, x, null), '攀爬态 draw');
});

// ================= Task 16：2b 演出与音频（规格 §3.3 / §7） =================

// 模拟世界：makeWorld 骨架 + 记录指令 + 音效桩（tick 走真实逻辑，不渲染）
function stageWorld(sounds = []) {
  const g = createGame(content, ch2Profile);
  const cv = { style: {}, addEventListener() {}, getBoundingClientRect: () => ({ left: 0, top: 0, width: 1280, height: 720 }) };
  const w = kit.makeWorld({ content, profile: ch2Profile, game: g, cv, signal: undefined });
  const ran = [];
  w.content = content; w.game = g; w.atlases = null;
  w.keys = new Set();
  w.run = ins => ran.push(...ins);
  const hit = name => sounds.push(name);
  w.sfx = new Proxy({}, { get: (t, k) => (typeof k === 'string' ? () => hit(k) : undefined) });
  w.ui = { setHint() {} };
  return { w, g, ran, sounds };
}

test('rope-first：断绳含 strain 与 swayKick 演出，首次掉 r + 干扰 h/m', () => {
  const g = createGame(content, ch2Profile);
  const out = gameEvent(g, 'ROPE');
  assert.ok(out.some(i => i.t === 'sfx' && i.name === 'strain'), 'rope-first 含 strain（规格 §7.1）');
  assert.ok(out.some(i => i.t === 'ropeFirst'), 'rope-first 演出指令：绳尾一摆 + 断口纤维散开');
  assert.ok(out.some(i => i.t === 'speak' && i.who === 'door' && i.slow), '低缓低语 Rope.');
  assert.ok(out.some(i => i.t === 'speak' && i.who === 'child'), '童声 Rope?');
  assert.ok(out.some(i => i.t === 'drop' && i.word === 'rope'), '首次掉石（decoys h/m 由 planDropStones 展开）');
  assert.ok(!gameEvent(g, 'ROPE').some(i => i.t === 'drop'), '反复听不再掉');
});

test('runExtras.ropeFirst：绳尾一摆 + 断口纤维散开（青除外无未登记色）', () => {
  const w = { geo: { wallX: 900, topY: 120 }, view: { swayKick: 0, fibres: [] } };
  kit.runExtras.ropeFirst(w, { t: 'ropeFirst' });
  assert.ok(w.view.swayKick > 0, 'swayKick 摆起');
  assert.ok(w.view.fibres.length > 0, '断口纤维散开');
});

test('runExtras.effect mendRope：itemIn → +0.9s 绷直 strain（生长 0.9s）', async () => {
  const sounds = [];
  const w = {
    cv: { style: {} }, view: { ropeMendT: 0, swayKick: 0, tautT: 0 },
    sfx: { itemIn: () => sounds.push('itemIn'), glowTick: () => sounds.push('glowTick'), strain: () => sounds.push('strain') },
    ui: { setHint() {} }
  };
  kit.runExtras.effect(w, { t: 'effect', name: 'mendRope', full: true });
  assert.deepEqual(sounds, ['itemIn'], '生长开始 itemIn（规格 §7.1）');
  assert.equal(w.view.ropeMendT, 1.2, '重编 0.9s 动画计时');
  await new Promise(r => setTimeout(r, 950));
  assert.deepEqual(sounds, ['itemIn', 'strain'], '绷直一沉 strain（规格 §3.3 拍 7）');
  assert.ok(w.view.tautT > 0, '绷直：摆幅骤减');
});

test('climb：strain 节律每 0.6s 一次（封顶 ≤6）+ 每拍落尘', () => {
  const { w, sounds } = stageWorld();
  w.player.climbing = true;
  w.player.x = content.geometry.wallX + 12;
  for (let i = 0; i < 100; i++) {                       // 模拟 5s：节律 8 次 → 封顶 6
    w.player.y = 300;                                   // 悬在半空，不到顶
    kit.tick(w, 0.05);
  }
  assert.equal(sounds.filter(s => s === 'strain').length, 6, 'strain 节律 ≤6（规格 §3.3 拍 8）');
  assert.ok(w.view.puffs.length > 0, '每拍落尘');
});

test('onE 绳下起爬：strain 节律清零（第二次攀爬重新计数）', () => {
  const { w, g } = stageWorld();
  g.mended = true;
  w.view.climbStrain = 5; w.view.climbT = 0.5;             // 上一段攀爬残留
  kit.onE(w, { kind: 'obj', id: 'rope', x: content.geometry.wallX + 12, y: content.geometry.groundY });
  assert.equal(w.player.climbing, true, '绳下按 E 起爬');
  assert.equal(w.view.climbStrain, 0, '节律清零');
  assert.equal(w.view.climbT, 0);
});

test('CLIMBED：首次给 topReached 演出（chime + wind + 窗醒），重复不再触发', () => {
  const g = createGame(content, ch2Profile);
  const out = gameEvent(g, 'CLIMBED');
  assert.ok(out.some(i => i.t === 'hint' && i.key === 'top'));
  assert.ok(out.some(i => i.t === 'topReached'));
  assert.deepEqual(gameEvent(g, 'CLIMBED'), []);
  const sounds = [];
  const w = { sfx: { chime: () => sounds.push('chime'), wind: () => sounds.push('wind') } };
  kit.runExtras.topReached(w, { t: 'topReached' });
  assert.deepEqual(sounds, ['chime', 'wind'], '登顶 chime + wind（更大了）');
});

test('runExtras.windowExit：creak + gust + 12 风尘扑入 + 猫先钻出窗（meow）', async () => {
  const sounds = [];
  const w = {
    geo: content.geometry, view: { winOpen: false, winT: 0, motes: [], catGo: false },
    actors: { cat: { x: 935, y: 120, earT: 0, meowT: 0, gone: false } },
    sfx: { creak: () => sounds.push('creak'), gust: () => sounds.push('gust'), meow: () => sounds.push('meow') }
  };
  kit.runExtras.windowExit(w, { t: 'windowExit' });
  assert.ok(w.view.winOpen, '窗开');
  assert.equal(w.view.winT, 0, 'hold 计时从 0 起');
  assert.equal(w.view.motes.length, 12, '12 风尘扑入（规格 §3.3 拍 10）');
  assert.equal(w.view.catGo, true, '猫先钻出窗');
  assert.ok(w.actors.cat.meowT > 0, '钻窗前喵一声');
  assert.deepEqual(sounds, ['creak', 'meow']);
  await new Promise(r => setTimeout(r, 350));
  assert.deepEqual(sounds, ['creak', 'meow', 'gust'], '窗开 → 当面风 gust');
});

test('window：光柱 1.4s + hold 1.8s 后自动 EXIT（结算），hold 未满不出卡', () => {
  const { w, g, ran } = stageWorld();
  g.mended = true;
  kit.runExtras.windowExit(w, { t: 'windowExit' });
  for (let i = 0; i < 30; i++) kit.tick(w, 0.05);        // 1.5s：未满 1.8s
  assert.ok(!ran.some(i => i.t === 'summary'), 'hold 未满不出结算');
  assert.ok(w.view.winT > 1.4 && w.view.winT < 1.8, '光柱 1.4s 已过、hold 未满');
  for (let i = 0; i < 10; i++) kit.tick(w, 0.05);        // 累计 2.0s
  assert.ok(ran.some(i => i.t === 'summary'), 'hold 1.8s 后自动 EXIT → 结算卡（规格 §3.3 拍 11）');
});

test('窗台猫：坐 (935,120) 先到一步；window 拍走到窗边即出画', () => {
  assert.deepEqual([CATB.x, CATB.speed], [935, 90]);
  const { w } = stageWorld();
  assert.equal(w.actors.cat.x, 935);
  assert.equal(w.actors.cat.y, content.geometry.topY);
  w.view.catGo = true;
  for (let i = 0; i < 40; i++) kit.tick(w, 0.05);        // 2s：从 935 走到窗 (980) 并出画
  assert.ok(w.actors.cat.gone, 'window 拍猫先钻出窗');
});

test('CRAFT 首次成功追加 revealCard；未集齐与重复合成不再弹（规格 §7.3）', () => {
  const g = createGame(content, ch2Profile);
  assert.ok(!gameEvent(g, 'CRAFT', 'rope').some(i => i.t === 'revealCard'));   // 石未齐 → 无卡
  seedMemory(g.inv, addStone, ch2Profile.everPicked);                          // əʊ、p 记忆补位
  gameEvent(g, 'PICKUP', 'r'); gameEvent(g, 'BANK');
  const out = gameEvent(g, 'CRAFT', 'rope');
  assert.ok(out.some(i => i.t === 'revealCard' && i.word === 'rope'));
  assert.ok(!gameEvent(g, 'CRAFT', 'rope').some(i => i.t === 'revealCard'));   // 词具不消耗但只揭示一次
});

test('runExtras.revealCard：+0.9s 卡开 chime + ui.reveal(rope)', async () => {
  const sounds = [], cards = [];
  const w = { sfx: { chime: () => sounds.push('chime') }, ui: { reveal: word => { cards.push(word); return Promise.resolve(); } } };
  kit.runExtras.revealCard(w, { t: 'revealCard', word: 'rope' });
  await new Promise(r => setTimeout(r, 50));
  assert.deepEqual(sounds, []);
  assert.deepEqual(cards, []);                            // 卡不提前弹
  await new Promise(r => setTimeout(r, 900));
  assert.deepEqual(sounds, ['chime']);                    // 揭示卡开 chime（规格 §7.1）
  assert.deepEqual(cards, ['rope']);
});

test('2b 演出接线：summaryFirst 仍无缝交接、#reveal 块齐备（源码断言）', async () => {
  assert.equal(kit.summaryFirst, true, '章末先出结算卡再交接（规格 §7.4）');
  assert.equal(kit.next?.chapter, 3, 'kit.next 仍在（动态 import 契约）');
  const src = await readFile(new URL('../public/js/ch2b.js', import.meta.url), 'utf8');
  assert.match(src, /swayKick/, '断绳一摆');
  assert.match(src, /winT >= 1\.8/, 'hold 1.8s 后自动 EXIT');
  assert.match(src, /drawCat/, '窗台猫（规格 §9）');
  assert.match(src, /rgba\(84,224,200/, '断口青（修绿例外，规格 §11）');
  assert.ok(!src.includes('123,216,143'), '不得回退旧绿 #7bd88f');
  const read = f => readFile(new URL('../public/' + f, import.meta.url), 'utf8');
  const [idx, html] = await Promise.all([read('index.html'), read('chapter2b.html')]);
  const block = s => s.split('<div id="reveal"')[1]?.split('<div id="summary"')[0].replace(/\s+/g, ' ').trim();
  assert.ok(block(idx), 'index.html 有 #reveal 块');
  assert.equal(block(html), block(idx), 'chapter2b.html 的 #reveal 块与 index.html 同构（规格 §7.3）');
});

test('2b 绘制冒烟：推窗光柱/风尘/过曝白与窗台猫不抛（模拟 ctx）', () => {
  globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => mockCtx() }) };
  const { w, g } = stageWorld();
  g.mended = true;
  kit.runExtras.windowExit(w, { t: 'windowExit' });
  const x = mockCtx();
  w.view.winT = 0.7;                                     // 光柱下泄中
  assert.doesNotThrow(() => kit.draw(w, x, null), '光柱 + 风尘态 draw');
  w.view.winT = 1.5;                                     // 过曝白峰值
  assert.doesNotThrow(() => kit.draw(w, x, null), '过曝白态 draw');
});
