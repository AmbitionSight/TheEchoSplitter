# 第二章《越过去》实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把第二关（裂谷 2a + 崖壁 2b）从"材质测试间"补到与第一关同级的完成度——陈设、光法则、演出、音频、活物、指针可通、命名一致，全部按 `docs/superpowers/specs/2026-10-03-ch2-design.md` 施工。

**Architecture:** 只改第二关；共享件仅在"通用、无章节几何"前提下增改。新增能力一律复用现成系统：`#reveal` 卡、浮尘/余烬池、`wind()`、ch1 的矢量拱/挖孔抖动、`interiors32` 图集、既有 Sfx 原语。每阶段结束都可玩、可测。

**Tech Stack:** 原生 ESM、Canvas 2D、DOM/CSS、Web Speech、WebAudio、`node:test`（零依赖）。

**已定开放问题**（规格 §15）：① 红叉**保留**并登记为唯一例外；② 2a 标题符文 = **ᚵ**；③ 跨章命名**只动第二关**；④ 揭示卡**合成后 +0.9s**；⑤ 触屏 = **点哪走哪 + 点对岸自动跳**。

---

## 文件结构（目标态）

| 文件 | 职责 |
|---|---|
| `public/js/masonry.js` | 石匠材质上色 + **像素光晕/渐变**（自 ch2.js 上移，全关共用） |
| `public/js/sideview.js` | 横版共用件 + **拱/走位/烛锚/接触影/浮尘余烬** |
| `public/js/sprites.js` | SPR 表 ±4 条 |
| `public/js/audio.js` | Sfx +4 方法 |
| `public/js/ui.js` | reveal 参数化、summary 第二参 |
| `public/js/shell.js` | veil label、summaryFirst |
| `public/js/ch2.js` | 2a：陈设/纵深/LIGHTS2/演出/输入/猫 |
| `public/js/ch2b.js` | 2b：陈设/塔结构/矢量绳窗/面纱/演出/输入/结算 |
| `content/chapter2.json` / `chapter2b.json` | listening/reveal/decoys/benchX/命名 |
| `public/chapter2.html` / `chapter2b.html` | `#reveal` 块、`#btn-jump`、静态文案 |
| `public/css/style.css` | `#btn-jump`、`touch-action` |

---

# 阶段 0 · 共享基础

### Task 1: 像素光晕/渐变上移共享

**Files:** Modify `public/js/masonry.js`、`public/js/ch2.js`；Test `test/masonry.test.js`

- [ ] **Step 1: 写失败测试** — 在 `test/masonry.test.js` 追加：

```js
test('pixelGradientV：色带量化 + 拜耳抖动（mock ctx 不抛错）', () => {
  const x = mockCtx();
  assert.doesNotThrow(() => pixelGradientV(x, 0, 100, 0, 60, [[0, '#000000'], [1, '#ffffff']]));
});
test('pixelGlow：抖动光斑（mock ctx 不抛错）', () => {
  const x = mockCtx();
  assert.doesNotThrow(() => pixelGlow(x, 50, 50, 40, [255, 198, 112], 0.3));
});
```

- [ ] **Step 2: 跑测试确认失败** — `node --test test/masonry.test.js` → FAIL（未导出）
- [ ] **Step 3: 实现** — 把 `ch2.js` 的 `BAYER4` / `pixelGradientV` / `pixelGlow` 三个定义**原样剪切**到 `masonry.js` 并 `export`（`pixelGlow` 内的 `SIDE` 依赖改为参数：`pixelGlow(x, cx, cy, r, rgb, a)` 已无 SIDE 依赖，仅 `pixelGradientV` 无 SIDE 依赖——核对后照搬）；`ch2.js` 顶部改为 `import { shade, paintMasonry, paintSlabs, BAYER4, pixelGradientV, pixelGlow } from './masonry.js';`
- [ ] **Step 4: 跑测试** — `npm test` → 全绿
- [ ] **Step 5: 提交** — `git add -A && git commit -m "refactor: 像素光晕与渐变上移共享（masonry.js）"`

### Task 2: sideview.js 新增通用件

**Files:** Modify `public/js/sideview.js`；Test `test/kit.test.js`（冒烟）

- [ ] **Step 1: 写失败测试** — `test/kit.test.js` 追加：

```js
import { drawArchSide, stepWalkTo, benchCandle, AMBIENT } from '../public/js/sideview.js';
test('sideview 新增件存在且可调用', () => {
  assert.equal(typeof drawArchSide, 'function');
  assert.equal(typeof stepWalkTo, 'function');
  assert.deepEqual(benchCandle(520, 620), { x: 582, y: 530 });
  assert.equal(AMBIENT.grade, 0.24);
  const w = { player: { x: 0, y: 0, dir: 'right', facing: 1, walkT: 0 }, walkTo: { x: 60 }, keys: new Set(), cfg: { speed: 300 } };
  stepWalkTo(w, 0.1);
  assert.ok(w.player.x > 0 && w.player.x <= 30);
});
```

- [ ] **Step 2: 跑测试确认失败** — `node --test test/kit.test.js` → FAIL
- [ ] **Step 3: 实现** — 追加到 `sideview.js`：

```js
export const AMBIENT = { grade: 0.24, vignette: 0.42 };   // 与 ch1 对齐（原两章 .30/.50）
export function benchCandle(bx, gy) { return { x: bx + 62, y: gy - 90 }; }
// 点哪走哪（第一关 walkTarget 的横版移植；调在 moveSide 之后）
export function stepWalkTo(w, dt) {
  const t = w.walkTo; if (!t || w.keys.size) return;
  const p = w.player, sp = w.cfg.walkSpeed ?? w.cfg.speed ?? 300, dx = t.x - p.x;
  if (Math.abs(dx) <= 6) { w.walkTo = null; p.moving = false; return; }
  p.x += Math.sign(dx) * Math.min(Math.abs(dx), sp * dt);
  p.dir = p.facing = dx > 0 ? 'right' : 'left'; p.moving = true; p.walkT += dt;
}
// 落地接触影（全关统一）
export function groundShadow(x, cx, gy, rx, ry = 7, a = 0.26) {
  x.fillStyle = `rgba(0,0,0,${a})`;
  x.beginPath(); x.ellipse(cx, gy + 4, rx, ry, 0, 0, 7); x.fill();
}
// 侧视矢量石拱（与 ch1 门拱同族；纯矢量、无章节几何）
export function drawArchSide(x, cx, baseY, { w = 120, h = 230, opening = 76, mouth = '#141824', rune = null, runeSize = 26, runeColor = 'rgba(30,32,44,.85)', runeGlow = 0 } = {}) {
  const hw = w / 2, top = baseY - h, ow = opening / 2, oh = h - 40;
  x.save();
  x.fillStyle = shade('#7b7669', 0.02);
  x.beginPath();
  x.moveTo(cx - hw, baseY); x.lineTo(cx - hw, top + 30);
  x.quadraticCurveTo(cx, top - 8, cx + hw, top + 30);
  x.lineTo(cx + hw, baseY); x.closePath(); x.fill();
  x.lineWidth = 5; x.strokeStyle = PAL.ink; x.stroke();
  x.fillStyle = mouth;
  x.beginPath();
  x.moveTo(cx - ow, baseY); x.lineTo(cx - ow, top + 44);
  x.quadraticCurveTo(cx, top + 16, cx + ow, top + 44);
  x.lineTo(cx + ow, baseY); x.closePath(); x.fill();
  x.fillStyle = shade('#7b7669', 0.12);                       // 拱心石
  x.fillRect(cx - 10, top + 18, 20, 20); x.strokeRect(cx - 10, top + 18, 20, 20);
  x.fillStyle = 'rgba(0,0,0,.28)'; x.fillRect(cx + hw - 16, top + 30, 16, baseY - top - 30);  // 右柱沉影
  if (rune) {
    if (runeGlow > 0) {
      const g = x.createRadialGradient(cx, top + 6, 4, cx, top + 6, 44);
      g.addColorStop(0, `rgba(84,224,200,${0.35 * runeGlow})`); g.addColorStop(1, 'rgba(84,224,200,0)');
      x.fillStyle = g; x.beginPath(); x.arc(cx, top + 6, 44, 0, 7); x.fill();
    }
    x.fillStyle = runeColor; x.font = `${runeSize}px serif`; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(rune, cx, top + 6);
  }
  x.restore();
}
```

- [ ] **Step 4: 跑测试** — `npm test` → 全绿（`AMBIENT` 改值后若 ch2/ch2b 仍写死 `.30/.50` 不受影响；本任务只加件不改调用）
- [ ] **Step 5: 提交** — `git commit -am "feat: sideview 新增拱/走位/烛锚/接触影通用件"`

### Task 3: SPR ±4 条

**Files:** Modify `public/js/sprites.js`；Test `test/sprites.test.js`

- [ ] **Step 1: 写失败测试** — `test/sprites.test.js` 追加：

```js
test('第二章新增 SPR 条目在 mi 图集内', () => {
  for (const n of ['crate_big', 'crate_sm', 'jars2', 'tree']) {
    const s = SPR[n]; assert.ok(s, `缺 ${n}`);
    assert.ok(s.x + s.w <= ATLASES[s.a].w && s.y + s.h <= ATLASES[s.a].h, `${n} 越界`);
  }
});
```

- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 实现** — `sprites.js` 的 `SPR` 增四条（源矩形已核对）：`crate_big:{a:'mi',x:258,y:1926,w:52,h:46}`、`crate_sm:{a:'mi',x:291,y:1865,w:32,h:45}`、`jars2:{a:'mi',x:3,y:2198,w:60,h:34}`、`tree:{a:'mi',x:333,y:1424,w:39,h:63}`。（删绳/窗四条留到 Task 14。）
- [ ] **Step 4: 跑测试** — `npm test` → 全绿
- [ ] **Step 5: 提交** — `git commit -am "feat: 新增木箱/陶罐/树 SPR 条目"`

### Task 4: Sfx +4

**Files:** Modify `public/js/audio.js`；Test `test/audio.test.js`

- [ ] **Step 1: 写失败测试** — `test/audio.test.js` 追加：

```js
test('Sfx 新增 hop/thud/strain/gust 可调用且不抛错', () => {
  const s = new Sfx(null);
  for (const m of ['hop', 'thud', 'strain', 'gust']) assert.equal(typeof s[m], 'function');
  assert.doesNotThrow(() => { s.hop(); s.thud(); s.strain(); s.gust(); });   // 无 ctx 时静默
});
```

- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 实现** — `audio.js` 的 `Sfx` 类追加（沿用既有 `tone/noise` 原语，与现方法同风格）：

```js
  hop() { this.tone({ f: 340, f2: 660, type: 'triangle', dur: .12, vol: .10 }); this.noise({ dur: .05, vol: .03, freq: 1800 }); }
  thud() { this.tone({ f: 96, f2: 42, dur: .22, vol: .16 }); this.noise({ dur: .10, vol: .05, freq: 160 }); }
  strain() { this.tone({ f: 130, f2: 92, type: 'sawtooth', dur: .18, vol: .06 }); this.noise({ dur: .12, vol: .03, freq: 900 }); }
  gust() { this.noise({ dur: 1.3, vol: .11, freq: 380 }); this.noise({ t: .18, dur: 1.0, vol: .07, freq: 260 }); }
```

- [ ] **Step 4: 跑测试** — `npm test` → 全绿
- [ ] **Step 5: 提交** — `git commit -am "feat: 新增 hop/thud/strain/gust 音效"`

---

# 阶段 1 · 内容与壳

### Task 5: content 数据

**Files:** Modify `content/chapter2.json`、`content/chapter2b.json`；Test `test/ch2.test.js`、`test/ch2b.test.js`

- [ ] **Step 1: 写失败测试** — `test/ch2.test.js` 追加：

```js
test('内容：听声点带 sfx、warm 在火把 (90,240)、reveal 齐备', () => {
  const warm = content.listening.find(s => s.id === 'warm');
  assert.equal(warm.y, 240); assert.equal(warm.sfx, 'crackle'); assert.equal(warm.auto, true);
  for (const s of content.listening) assert.ok(s.sfx, `${s.id} 缺 sfx`);
  assert.ok(content.words.jump.reveal?.ok, 'jump 缺 reveal');
});
```

`test/ch2b.test.js` 同理断言 `benchX===520`、`warm.y===240`、`stone.sfx==='clack'`、`high.sfx==='gust'`、`rope.reveal` 存在。

- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 实现** — 按规格 §12 改两个 JSON：2a `warm.y 180→240`（r 90、auto、sfx `crackle`）、`fall.sfx='wind'`、`shine.sfx='bloom'`、`words.jump.reveal={line:"你拼出了身体早就知道的词",sub:"文字，是冻住的声音",ok:"把这个词，用在自己身上"}`；2b `geometry.benchX 420→520`、`warm{x:240,y:240,r:90,auto,sfx:'crackle'}`、`stone.sfx='clack'`、`high.sfx='gust'`、`words.rope.reveal={line:"你拼出了墙上垂着的那个声音",sub:"文字，是冻住的声音",ok:"把这个词，还给绳子"}`。
- [ ] **Step 4: 跑测试** — `npm test` → 全绿（既有 listening 断言随坐标同步改）
- [ ] **Step 5: 提交** — `git commit -am "feat: 第二章内容（听声点坐标/sfx、揭示卡文案、benchX）"`

### Task 6: 壳与 UI

**Files:** Modify `public/js/shell.js`、`public/js/ui.js`；Test `test/kit.test.js`

- [ ] **Step 1: 写失败测试** — `test/kit.test.js` 追加：

```js
test('shell 导出 summaryFirst 分支与 veil label（源码断言）', async () => {
  const src = await readFile(new URL('../public/js/shell.js', import.meta.url), 'utf8');
  assert.match(src, /next\.label \?\?/);
  assert.match(src, /summaryFirst/);
});
```

- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 实现** — `shell.js`：① handoff 里 `veil.textContent = next.label ?? CHAPTER_DAY[next.chapter] || ''`；② `finish()` 改为：

```js
  function finish() {
    const payload = kit.summaryMerge(game, w);
    saveProfile(localStorage, mergeProfile(loadProfile(localStorage), payload));
    const showSummary = !kit.next || kit.summaryFirst;
    if (showSummary) {
      const day = el('summary').querySelector('.day'); if (day) day.textContent = CHAPTER_DAY[kit.chapter] || '';
      ui.summary(game, { words: [...game.book], stones: payload.picks ?? game.stonesPicked });
    }
    const walk = el('btn-walk');
    if (kit.next && !kit.summaryFirst) { onHandoff?.(kit.next); return; }   // 无缝交接：不弹结算
    if (kit.next) { walk.textContent = '下一间房 →'; walk.onclick = () => onHandoff?.(kit.next); }
    else { walk.textContent = '继续走走'; walk.onclick = null; kit.onFinal?.(w); }
  }
```

`ui.js`：`reveal(word)` 读 `content.words[word]?.reveal ?? {}`（`line` 缺省「你用声音打开了门」、`sub` 缺省「文字，是冻住的声音」、`ok` 缺省「把这个词，还给门」）；`el('reveal')` 不存在则静默 return；`summary(game, info = {})` 用 `info.words` 画图标。
- [ ] **Step 4: 跑测试** — `npm test` → 全绿（ch1 无 `reveal` 字段 → 回落原文案，行为不变）
- [ ] **Step 5: 提交** — `git commit -am "feat: shell/UI 支持 veil label 与章末结算（summaryFirst）"`

---

# 阶段 2 · 2a 裂谷

### Task 7: 2a 陈设与纵深（makeBg）

**Files:** Modify `public/js/ch2.js`；Test `test/ch2.test.js`（源码/结构断言）

- [ ] **Step 1: 写失败测试** — 追加：

```js
test('2a 陈设与纵深：源码含入口拱/出口拱/石桥残墩/对壁三层', async () => {
  const src = await readFile(new URL('../public/js/ch2.js', import.meta.url), 'utf8');
  for (const k of ['drawArchSide', 'drawBridgePier', 'drawFarWallLayers', 'crate_big', 'jars2', '风幡']) assert.ok(src.includes(k), `缺 ${k}`);
});
```

- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 实现** — `ch2.js` 的 `makeBg` 按规格 §5.1/§8 施工：入口拱 `drawArchSide(x, 60, 600, { rune:'ᚵ' })`；货堆/行囊/水洼/风幡（静态件）；石桥残墩（矢量砌石墩 + 向缝下 3–4 块渐隐断板）；出口拱 `drawArchSide(x, 1150, 600, { rune:'ᚱ', runeGlow:1, runeColor:'rgba(140,240,220,.6)' })` 并**删掉原 10% 渐隐带**（`ch2.js` 的出口微光段）；裂谷纵深按 §8：缝内 y200–600 叠 3 层后退岩壁（`drawFarWallLayers`）+ 岩层横纹 α≥.10 + 错位谷缘折线；巨石基色改 `#5a5f6b` 族、块格 26–34px。
- [ ] **Step 4: 跑测试 + 冒烟** — `npm test` 全绿；`node server.js` 开 `?autostart=1` 目视
- [ ] **Step 5: 提交** — `git commit -am "feat: 2a 陈设与裂谷纵深（入口/出口拱、石桥残墩、对壁三层）"`

### Task 8: 2a 光法则 LIGHTS2

**Files:** Modify `public/js/ch2.js`；Test `test/ch2.test.js`

- [ ] **Step 1: 写失败测试** — 追加：

```js
test('LIGHTS2：锚点由几何推导、烘焙=动态同源', () => {
  const L = LIGHTS2(content.geometry);
  assert.deepEqual([L.torchL.x, L.torchL.y], [90, 240]);
  assert.equal(L.torchR.x, content.geometry.chasmR + 120);
  assert.equal(L.candle.x, content.geometry.benchX + 62);
  assert.equal(L.exit.x, content.geometry.exitX);
  for (const v of Object.values(L)) assert.ok(v.r > 0 && v.s > 0 && v.s <= 1);
});
```

- [ ] **Step 2: 跑测试确认失败** — FAIL
- [ ] **Step 3: 实现** — `ch2.js` 导出 `LIGHTS2 = geo => ({...})`（规格 §6.1 表）；`makeBg` 末尾循环 `Object.values(LIGHTS2(geo))` → `pixelGlow`（删原三处硬编码，修 y220/y180 错位）；`drawTorchSide` 调用改传 `glow` 参数（Task 2 的可选第 5 参）；出口/缝口/蜡烛光晕一律读同一表。
- [ ] **Step 4: 跑测试 + 冒烟** — `npm test` 全绿
- [ ] **Step 5: 提交** — `git commit -am "feat: 2a LIGHTS2 单源光法则"`

### Task 9: 2a 动态层与粒子

**Files:** Modify `public/js/ch2.js`、`public/js/sideview.js`（浮尘 helper）；Test 冒烟

- [ ] **Step 1: 写失败测试** — 断言 `ch2.js` 源码含 `kind:'ember'` 与浮尘调用。
- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现** — `draw()` 增：出口符文呼吸 + 12 金尘上浮；水洼 2 闪粒；风幡绕顶摆动；浮尘 26 粒（暖金/冷灰分区，`rng(99)`）；余烬（每火把 0.7–1.4s 一颗，复用 `view.stars` + `kind:'ember'`）；**青声元素画在级色之后**。
- [ ] **Step 4: 跑测试 + 冒烟**
- [ ] **Step 5: 提交** — `git commit -am "feat: 2a 动态陈设与粒子（金尘/水光/幡/浮尘/余烬）"`

### Task 10: 2a 演出与音频

**Files:** Modify `public/js/ch2.js`、`public/chapter2.html`；Test `test/ch2.test.js`

- [ ] **Step 1: 写失败测试** — 断言 `gameEvent(g,'CROSS')` 后 beat 与指令；`LISTEN` 返回 `spot.sfx`；合成成功后含 `{t:'revealCard'}`。
- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现** — 事件机：`LISTEN` 用 `{t:'sfx', name: spot.sfx ?? 'glowTick'}`；合成成功首次追加 `{t:'revealCard', word}`；`CROSS` 增 `{t:'crossed'}` 演出指令。`runExtras`：`revealCard`（+0.9s `ui.reveal`）、`crossed`（预渲染暖晕 + 22 金星 + 雾脉冲 + hint 延后）、`teleport`（调试）。`chapter2.html` 补 `#reveal` 块。音效按 §7.1（`hatPuff`/`hop`/`thud`/`chime`/`wind`，`fell` 去 `mutter`）。
- [ ] **Step 4: 跑测试 + 冒烟**
- [ ] **Step 5: 提交** — `git commit -am "feat: 2a 演出与音频（揭示卡/过坑/解锁/坠落）"`

### Task 11: 2a 交互（指针/拖拽/跳键）

**Files:** Modify `public/js/ch2.js`、`public/chapter2.html`、`public/css/style.css`；Test `test/ch2.test.js`

- [ ] **Step 1: 写失败测试** — 断言 `kit.onPointerDown`、`kit.onDropItem` 存在；`tapTargetAt` 命中表纯函数（石/台/听声点/裂谷/出口/自身）。
- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现** — 按规格 §10：`onPointerDown`（命中表 → `walkTo` + `pending`；tick 到位 30px 内 `doE`）；`onKey` 清走位；过坑自动化（`cfg.speed=330`）；`onDropItem`（jump→自身 90px）；`#btn-jump`（HTML + CSS + `unlocked` 同拍显示）；`stepWalkTo` 调在 `moveSide` 后。
- [ ] **Step 4: 跑测试 + 冒烟（纯指针走一遍）**
- [ ] **Step 5: 提交** — `git commit -am "feat: 2a 指针可通（点哪走哪/拖拽/触屏跳键）"`

### Task 12: 2a 猫与环境风

**Files:** Modify `public/js/ch2.js`；Test `test/ch2.test.js`

- [ ] **Step 1: 写失败测试** — 断言 2a 有猫（`drawCat` 调用）与 `wind()` 调用点。
- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现** — 对岸猫 (1015,600)：`drawCat` + 过坑后 1s 内可点（`meow`）；`crossed` 后 `meow` 起身向右走出画面；环境风 `wind()`（8–14s，近裂口更密）。更新 `test/ch2.test.js` 中「猫只在第一关出场」的注释与断言。
- [ ] **Step 4: 跑测试**
- [ ] **Step 5: 提交** — `git commit -am "feat: 2a 橘猫与环境风"`

---

# 阶段 3 · 2b 崖壁

### Task 13: 2b 陈设与塔结构（makeBg）

**Files:** Modify `public/js/ch2b.js`；Test `test/ch2b.test.js`

- [ ] **Step 1: 写失败测试** — 源码断言含入口拱/货堆/残碑/绞盘/塔柱/窗光柱。
- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现** — 按规格 §5.2：入口拱 `drawArchSide(x,60,620,{rune:'ᚱ'})` + 暖溢光；火把 (240,240)+托架、绳位火把 (868,430)；货堆；石刻带 + 嵌壁残碑 (780,300)；绞盘 (908,620)；木架+树 (1070/1180)；塔身壁柱（不阻走）；benchX 520 + 蜡烛。
- [ ] **Step 4: 跑测试 + 冒烟**
- [ ] **Step 5: 提交** — `git commit -am "feat: 2b 陈设与塔结构"`

### Task 14: 绳与窗矢量重写

**Files:** Modify `public/js/ch2b.js`、`public/js/sprites.js`；Test `test/sprites.test.js`

- [ ] **Step 1: 写失败测试** — 断言 `ch2b.js` 不再含 `rope_broken|rope_fixed|window_closed|window_open`；`sprites.js` 不再导出这四条。
- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现** — 按规格 §11：`drawRope` 重写为 8px 双层编织（芯 #b98d55/暗边 #6e4526/高光 #d9b878 + 每 6px 斜纹 + ink 描边；断端三股散开；生长前沿青微光）；`drawWindow` 重写为矢量拱龛 + 双页木窗（开=平行四边形旋出 70° + 夜空 + 暖光点）；删 `blit/SPR` import 与 4 条 SPR。
- [ ] **Step 4: 跑测试 + 冒烟**
- [ ] **Step 5: 提交** — `git commit -am "refactor: 绳与窗改矢量（退役照片贴图）"`

### Task 15: 2b 光法则与面纱

**Files:** Modify `public/js/ch2b.js`；Test `test/ch2b.test.js`

- [ ] **Step 1: 写失败测试** — `LIGHTS2` 锚点断言（含 `veil` 字段）。
- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现** — `LIGHTS2 = geo => ({...})`（规格 §6.1 2b 表）；`makeBg` 循环烘焙光池（新增）；`makeVeil(lights)` 一次性预渲染（`rgba(8,10,20,.34)` + 四孔 destination-out + 拜耳抖动），画在级色之后、青声之前；上部墙转冷。
- [ ] **Step 4: 跑测试 + 冒烟**
- [ ] **Step 5: 提交** — `git commit -am "feat: 2b LIGHTS2 与夜色面纱"`

### Task 16: 2b 演出与音频

**Files:** Modify `public/js/ch2b.js`、`public/chapter2b.html`；Test `test/ch2b.test.js`

- [ ] **Step 1: 写失败测试** — 断言 `rope-first` 含 `strain`、`window` 含 `gust`、`kit.summaryFirst===true`、`kit.next` 仍在。
- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现** — 按规格 §3.3/§7：`rope-first`（`swayKick` + 断口青光，修绿例外）；`mend-rope`（纤维 puff + 绷直 `strain`）；`climb`（`strain` 节律 + 落尘）；`top`（`chime` + `wind` + 窗醒）；`window`（`creak` + `gust` + 光柱 1.4s + 12 风尘 + hold 1.8s + 过曝白）；`kit.summaryFirst = true`；窗台猫；`#reveal` 块。
- [ ] **Step 4: 跑测试 + 冒烟**
- [ ] **Step 5: 提交** — `git commit -am "feat: 2b 演出与音频（接绳/攀爬/推窗/结算）"`

### Task 17: 2b 交互

**Files:** Modify `public/js/ch2b.js`、`public/chapter2b.html`；Test `test/ch2b.test.js`

- [ ] **Step 1: 写失败测试** — 断言 `onPointerDown` 重写后仍可点绳、`onDropItem` 存在、绳升为正式 E 目标（`findE` 条件放宽）。
- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现** — 按规格 §10：命中表（石/台/听声点/绳/窗）；`onPointerDown` 改为「点哪走哪 + 到位 doE」（替原"任意位置直接触发"）；`onE` 补绳分支（未接+持绳=USE；未接+空手=ROPE；已接+地面=攀爬）；`onDropItem`（rope→绳带）；`#btn-jump`。
- [ ] **Step 4: 跑测试 + 冒烟（纯指针走一遍）**
- [ ] **Step 5: 提交** — `git commit -am "feat: 2b 指针可通与绳的 E 交互补齐"`

### Task 18: 2b 章末结算

**Files:** Modify `public/js/ch2b.js`、`public/js/shell.js`；Test `test/ch2b.test.js`

- [ ] **Step 1: 写失败测试** — 断言 `finish()` 路径：`kit.summaryFirst` 时先 `ui.summary` 再由按钮 `onHandoff`；`summaryMerge` 含 `picks`。
- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现** — `summaryMerge` 增 `picks: game.stonesPicked`；`kit.summaryFirst = true`；`kit.next` 指向 ch3（保留动态 import 契约）；`profile.js` 的 `mergeProfile` 累加 `picks`（缺省 0）。
- [ ] **Step 4: 跑测试**
- [ ] **Step 5: 提交** — `git commit -am "feat: 2b 章末结算卡（summaryFirst）"`

---

# 阶段 4 · 收尾

### Task 19: 命名统一与残留清零

**Files:** Modify `content/chapter2*.json`、`public/chapter2*.html`、`public/js/ch2.js`、`public/js/ch2b.js`、`public/js/shell.js`、`public/js/ch1/kit.js`（仅 titleRune 相关不动 ch1）

- [ ] **Step 1: 写失败测试** — grep 断言：`chapter2*.html|content/chapter2*.json|ch2*.js` 中 `第二间房|第三间房|ROOM THREE` 零命中。
- [ ] **Step 2: 跑测试确认失败**
- [ ] **Step 3: 实现** — meta.title/titleEn →「析声者 · 第二章 · 裂谷/崖壁」「CHAPTER TWO · RAVINE/CLIFF」；`CHAPTER_DAY[2]='第二章'`；`kit.next.label`；HTML 静态文案与 notes 同步；2a titleRune ᛚ→**ᚵ**（标题页/书钮/入口拱三处）；代码注释同步。
- [ ] **Step 4: 跑测试**
- [ ] **Step 5: 提交** — `git commit -am "docs: 第二章命名统一（第二章 · 裂谷/崖壁）"`

### Task 20: 终验

- [ ] **Step 1: 全量测试** — `npm test` → 全绿（165 + 新增）
- [ ] **Step 2: 逐条核对规格 §14** — 〔自〕项跑测试；〔手〕项 `node server.js` 开 `?autostart=1[&beat=]` 逐拍留档
- [ ] **Step 3: 纯指针通关演练** — 不碰键盘走完 2a→2b→结算
- [ ] **Step 4: 对照第一关观感** — 截图对比陈设密度/光/演出
- [ ] **Step 5: 提交** — `git commit -am "test: 第二章终验（165+ 全绿，纯指针可通）"`

---

## 回滚

每任务独立提交；出问题 `git reset --hard HEAD~1` 回到上一任务边界。全部在 `develop`，远端不受影响直到推送。
