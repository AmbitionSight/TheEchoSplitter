// 第一间房 kit 的浏览器路径回归：鼠标「走过去自动交互」（tick 内）；合成台共用件见 workbench.test.js
import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { createGame, kit } from '../public/js/main.js';
import { createActors } from '../public/js/actors.js';
import { drawArchSide, stepWalkTo, benchCandle, AMBIENT } from '../public/js/sideview.js';

const content = JSON.parse(await readFile(new URL('../content/chapter1.json', import.meta.url), 'utf8'));

function makeW() {
  const game = createGame(content);
  const w = {
    game, content,
    view: { t: 0, lit: 0, doorState: 'closed', doorPulse: 0, doorOpen: 0,
            bloomed: false, hatOn: false, switchOn: false, benchHot: false },
    sc: { lit: 0, dust: [] },
    ritual: { active: false, t: 0, seated: 0 },
    actors: createActors(),
    stones: [],
    keys: new Set(),
    walkTarget: null, pendingInteract: null, lastPX: 0, lastPY: 0, stuckT: 0,
    sfx: { click() {}, glowTick() {}, itemIn() {} },
    ui: { setHint() {} },
    hb: null,
    ran: [], doeGot: null,
    run(ins) { this.ran.push(...ins); },
    doE(t) { this.doeGot = t; this.sfx.click(); kit.onE(this, t); }   // 与 shell.js 的 doE 等价
  };
  return w;
}

test('回归：鼠标点物件，走到后自动触发交互（原 w.doEFor 幽灵调用）', () => {
  const w = makeW();
  const p = w.actors.player;
  p.x = 400; p.y = 490;                                   // 目标 npc(310,490) 旁边
  w.walkTarget = { x: p.x, y: p.y };                      // 立即到达
  w.pendingInteract = { kind: 'obj', id: 'npc' };
  assert.doesNotThrow(() => kit.tick(w, 1 / 60));
  assert.deepEqual(w.doeGot, { kind: 'obj', id: 'npc' });
  assert.equal(w.game.helloDropped, true);                // INTERACT npc 真正执行
  assert.equal(w.pendingInteract, null);
  assert.equal(w.walkTarget, null);
});

test('回归：鼠标点石头，走到后自动拾取', () => {
  const w = makeW();
  const p = w.actors.player;
  p.x = 600; p.y = 600;
  w.stones.push({ ipa: 'h', x: 600, y: 600, state: 'idle', to: null, phase: 0 });
  w.walkTarget = { x: 600, y: 600 };
  w.pendingInteract = { kind: 'stone', ipa: 'h' };
  assert.doesNotThrow(() => kit.tick(w, 1 / 60));
  assert.equal(w.stones.length, 0);
  assert.deepEqual(w.game.hand, { kind: 'stone', ipa: 'h' });
});

test('节奏掉落：石头按音素时长依次弹出，从左到右排成声音顺序线', () => {
  const w = makeW();
  kit.runExtras.drop(w, { t: 'drop', word: 'hello' });
  const ss = w.stones.slice(-4);
  assert.deepEqual(ss.map(s => s.x), [334, 378, 422, 466]);          // drop[0]=400：一条 44px 间距的线
  const at = ss.map(s => -s.t);                                       // makeStone 的 t=-delay
  assert.ok(at[0] < at[1] && at[1] < at[2] && at[2] < at[3], '依次弹出');
  assert.ok(Math.abs(at[3] - 1.5) < 1e-9);                            // 最后一块（最长的 əʊ）在 1.5s
  assert.ok(at[3] - at[2] > at[1] - at[0], '音素越长，间隔越大（70/90/80/200ms 的节奏）');
  assert.ok(ss.every(s => s.vx === 0 && s.floorY === 526));           // 直上直落、同一排落地，顺序不被打乱
});

test('sideview 新增件存在且可调用', () => {
  assert.equal(typeof drawArchSide, 'function');
  assert.equal(typeof stepWalkTo, 'function');
  assert.deepEqual(benchCandle(520, 620), { x: 582, y: 530 });
  assert.equal(AMBIENT.grade, 0.24);
  const w = { player: { x: 0, y: 0, dir: 'right', facing: 1, walkT: 0 }, walkTo: { x: 60 }, keys: new Set(), cfg: { speed: 300 } };
  stepWalkTo(w, 0.1);
  assert.ok(w.player.x > 0 && w.player.x <= 30);
});

test('shell 导出 summaryFirst 分支与 veil label（源码断言）', async () => {
  const src = await readFile(new URL('../public/js/shell.js', import.meta.url), 'utf8');
  assert.match(src, /next\.label \?\?/);
  assert.match(src, /summaryFirst/);
});

test('shell 保留无 kit.next 章节的既有结算路径（ch1 跳章 / ch3 收尾）', async () => {
  const src = await readFile(new URL('../public/js/shell.js', import.meta.url), 'utf8');
  assert.match(src, /CHAPTER_NEXT\[kit\.chapter\]/);                        // ch1：结算后按钮整页跳 chapter2.html
  assert.match(src, /kit\.onFinal\?\.\(w\)/);                               // ch3：结算后收尾回调
  assert.match(src, /ui\.summary\(game, \{ words: \[\.\.\.game\.book\]/);    // 结算图标仍取本局词表
});

test('ui.js：揭示卡参数化与缺省回落（源码断言）', async () => {
  const src = await readFile(new URL('../public/js/ui.js', import.meta.url), 'utf8');
  assert.match(src, /content\.words\[word\]\?\.reveal \?\? \{\}/);
  assert.match(src, /你用声音打开了门/);                                      // line 缺省
  assert.match(src, /文字，是冻住的声音/);                                    // sub 缺省
  assert.match(src, /把这个词，还给门/);                                      // ok 缺省
  assert.match(src, /if \(!screen\) return/);                                // 章节无 #reveal 时静默
  assert.match(src, /info\.words/);                                          // summary(game, info) 用 info.words 画图标
});

test('环境光对齐 ch1：AMBIENT 被 ch2/ch2b 消费、暗角几何 = ch1（规格 §6.4）', async () => {
  assert.deepEqual(AMBIENT, { grade: 0.24, vignette: 0.42 });
  const side = await readFile(new URL('../public/js/sideview.js', import.meta.url), 'utf8');
  assert.match(side, /createRadialGradient\(640, 360, 380, 640, 360, 780\)/, '暗角中心 (640,360)、380→780');
  assert.match(side, /\$\{AMBIENT\.vignette\}/, '暗角 α 读 AMBIENT.vignette（不再写死 .5）');
  for (const f of ['ch2.js', 'ch2b.js']) {
    const src = await readFile(new URL(`../public/js/${f}`, import.meta.url), 'utf8');
    assert.match(src, /AMBIENT\.grade/, `${f} 黄昏级色读 AMBIENT.grade`);
    assert.doesNotMatch(src, /rgba\(16,18,36,\.30\)/, `${f} 不再写死 .30`);
  }
});

test('ui.js：结算卡读 info.words/info.stones，跨半场词经 lexicon 解析图标（规格 §3.3 拍 11）', async () => {
  const src = await readFile(new URL('../public/js/ui.js', import.meta.url), 'utf8');
  assert.match(src, /info\.words \?\? \[\.\.\.g\.book\]/, '词表：info.words 优先');
  assert.match(src, /info\.stones \?\? g\.stonesPicked/, '石数：info.stones 优先');
  assert.match(src, /words\.length/, '词数按传入词表计（2b = 本章两词）');
  assert.match(src, /content\.lexicon/, 'jump 不在 2b 本章 words → 前几章词库补图标');
});

test('铁律：ch1 kit 的 OPEN 揭示卡只调一次 ui.reveal（规格 §14「ch1 OPEN 各一次」）', async () => {
  const src = await readFile(new URL('../public/js/ch1/kit.js', import.meta.url), 'utf8');
  const calls = src.match(/ui\.reveal\(/g) ?? [];
  assert.equal(calls.length, 1, '拼写时刻（OPEN 揭示卡）必须且只弹一次');
  assert.match(src, /await w\.ui\.reveal\('open'\)/, '揭示的是 ch1 的 open');
});
