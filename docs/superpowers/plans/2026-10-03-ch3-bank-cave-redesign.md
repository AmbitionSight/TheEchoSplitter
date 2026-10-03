# 第三关·岸边场景洞穴化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把第三关岸边（`room === 'bank'`）的墙地换成洞穴版程序化生成 + 预烘焙，河流换成流动水，裂隙口去门化，木筏/原木/巨石补结构细节与落地影。

**Architecture:** 新建纯函数模块 `ch3/cave.js` 产出岩面/钟乳石规划数据（Node 可测），`ch3/render.js` 负责上色与一次性烘焙成离屏图；`ch3/kit.js` 持有场景对象并在 boot 时烘焙岸边静态层。运行期每帧只 `drawImage` 一次背景，其余为动态层（水、物件、阴影）。**没有烘焙层的房间自动回退旧代码路径**，裂隙房与深水房本轮不动。

**Tech Stack:** 原生 ES Modules、Canvas 2D、`node:test` + `node:assert/strict`。零依赖、无构建步骤。

**Spec:** `docs/superpowers/specs/2026-10-03-ch3-bank-cave-redesign.md`

## Global Constraints

- 零依赖、零构建：不得新增 `package.json` 依赖，不得引入打包步骤。
- 只动画面层：`public/js/ch3/event.js` **零改动**；`content/chapter3.json` 的 `geometry` 数值不动。
- 不碰 `public/js/ch1/*`、`public/js/sideview.js`、`public/js/chapter.js`、`public/js/workbench.js`、`public/js/hotbar.js`。
- 浏览器专属全局（`document`、`window`、canvas）必须关在函数或浏览器入口内，模块 import 期不得执行 —— 见 CLAUDE.md 的测试边界约定。
- 复用 `sideview.js` 已导出的 `shade(hex, f)` 做明度微调；**不**从 `ch1/planners.js` 导入 `rng`（避免 ch3 → ch1 反向耦合），`cave.js` 自带同款 LCG。
- 上色数值必须与第一关一致：逐块明度 `shade(base, t - 1)`、受光边 `+0.16`、沉影边 `-0.22`、苔藓 2×2 拜耳抖动、洞顶沉暗渐变、墙脚落地阴影。
- 无主动光源：阴影一律环境遮蔽式（无方向偏移），不得新增光池/遮罩/火焰。
- 本轮只做岸边；裂隙房（`room === 'crevice'`）与深水房（`room === 'deep'`）的绘制输出必须与改动前**逐像素一致**。
- 现有 155 个测试不得减少，不得改断言来迁就实现。
- 提交信息带 type 前缀（`feat/fix/docs/refactor/test/chore/ui`），主题 ≤ 32 汉字，一事一提交 —— 见 `docs/CONTRIBUTING.md`。

## Review Focus

以下五类输入/失效模式是 spec 隐含、但没有哪个任务的测试直接覆盖的，按最可能出问题的顺序排列。每一条都要落到拥有该代码的任务里：

1. **图集加载失败**（`loadAtlases()` 返回 `null`）——岸边仍须完整渲染出岩壁与地面（岩壁是纯矢量，不依赖图集）；家具静默缺席即可，不得白屏或抛错。
2. **`document` 不存在的环境**（Node 测试 import `ch3.js`）——import 期不得触碰 `document`；烘焙只能在 `initScene` 被显式调用时发生。
3. **三间房来回切换**（bank → crevice → bank）——烘焙层复用同一张离屏图，不得重复烘焙、不得内存泄漏；切回岸边画面必须与首次一致。
4. **玩家站在裂隙口正前方**——绘制顺序必须是「背景 → 裂缝/巨石 → 物件 → 玩家」，玩家精灵永远压在裂缝之上，不能被裂缝盖住。
5. **窄窗口/非整数缩放**——烘焙层固定 1280×720，`drawImage` 必须 1:1 绘制（不缩放、不模糊），与 `#stage` 的 CSS 缩放解耦。

---

### Task 1: cave.js —— 种子随机与抖动网格岩面规划器

**Files:**
- Create: `public/js/ch3/cave.js`
- Test: `test/ch3-cave.test.js`

**Interfaces:**
- Consumes: 无（本任务不导入任何项目模块）
- Produces:
  - `rng(seed: number) -> () => number` —— LCG，返回 `[0, 1)`；与 `ch1/planners.js` 同款常量 `1664525 / 1013904223`
  - `cavePlan(seed: number, W: number, H: number, opts?: CaveOpts) -> CavePlan`
  - `CaveOpts = { cols?: number, rows?: number, jitter?: number, wetRange?: [number, number], crackRate?: number }`，默认 `{ cols: 7, rows: 5, jitter: 0.18, wetRange: [0.15, 0.15], crackRate: 0.16 }`
  - `CavePlan = { cols, rows, verts: [[x, y], ...], faces: CaveFace[] }`
  - `CaveFace = { c: number, r: number, pts: [[x, y], [x, y], [x, y], [x, y]], t: number, wet: number, crack: boolean, speck: number }`
  - `verts` 长度 = `(cols + 1) * (rows + 1)`，索引 `v = r * (cols + 1) + c`
  - `faces` 长度 = `cols * rows`，第 `(r, c)` 个面的四角是顶点 `v(r,c) / v(r,c+1) / v(r+1,c+1) / v(r+1,c)`

- [ ] **Step 1: 写失败测试**

```js
// test/ch3-cave.test.js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rng, cavePlan } from '../public/js/ch3/cave.js';

test('rng：同种子同序列，值域 [0,1)，异种子序列不同', () => {
  const a = rng(41), b = rng(41), c = rng(42);
  const sa = Array.from({ length: 8 }, () => a());
  const sb = Array.from({ length: 8 }, () => b());
  const sc = Array.from({ length: 8 }, () => c());
  assert.deepEqual(sa, sb);
  assert.notDeepEqual(sa, sc);
  for (const v of sa) assert.ok(v >= 0 && v < 1, `越界 ${v}`);
});

test('cavePlan：同种子输出全等，异种子布局不同', () => {
  assert.deepEqual(cavePlan(41, 1280, 590), cavePlan(41, 1280, 590));
  assert.notDeepEqual(cavePlan(41, 1280, 590), cavePlan(42, 1280, 590));
});

test('cavePlan 结构：顶点数/面数正确，面四角取自共享顶点', () => {
  const p = cavePlan(41, 1280, 590, { cols: 7, rows: 5 });
  assert.equal(p.verts.length, (7 + 1) * (5 + 1));
  assert.equal(p.faces.length, 7 * 5);
  const key = ([x, y]) => `${x},${y}`;
  const vset = new Set(p.verts.map(key));
  for (const f of p.faces) {
    assert.equal(f.pts.length, 4);
    for (const pt of f.pts) assert.ok(vset.has(key(pt)), `面角不在共享顶点表里：${key(pt)}`);
  }
});

test('cavePlan 无缝隙：每个网格单元的四个角都被某个面引用', () => {
  const cols = 7, rows = 5;
  const p = cavePlan(41, 1280, 590, { cols, rows });
  const used = new Set(p.faces.flatMap(f => f.pts.map(([x, y]) => `${x},${y}`)));
  assert.equal(used.size, p.verts.length, '每个共享顶点都必须被至少一个面用到');
});

test('cavePlan 面属性：t ∈ (0.9,1.1)、wet ∈ [0,1]、crack 为布尔、speck 为非负整数', () => {
  for (const f of cavePlan(41, 1280, 590).faces) {
    assert.ok(f.t > 0.9 && f.t < 1.1, `t=${f.t}`);
    assert.ok(f.wet >= 0 && f.wet <= 1, `wet=${f.wet}`);
    assert.equal(typeof f.crack, 'boolean');
    assert.ok(Number.isInteger(f.speck) && f.speck >= 0, `speck=${f.speck}`);
  }
});

test('cavePlan 边界：W=0 / H=0 / cols=1 都不抛错', () => {
  assert.doesNotThrow(() => cavePlan(41, 0, 590));
  assert.doesNotThrow(() => cavePlan(41, 1280, 0));
  assert.doesNotThrow(() => cavePlan(41, 1280, 590, { cols: 1, rows: 1 }));
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/ch3-cave.test.js`
Expected: FAIL —— `Cannot find module '../public/js/ch3/cave.js'`

- [ ] **Step 3: 实现 `rng` 与 `cavePlan`**

文件头写模块职责注释（沿用仓库风格：`// —— 析声者 · 第三关洞穴岩面规划器（纯函数，Node 可测）——`）。算法约束：

- 顶点：`(cols+1) × (rows+1)` 规则网格，步长 `W/cols`、`H/rows`，每个内部顶点按 `±jitter × min(stepX, stepY)` 抖动（**边界顶点只沿切线方向抖动**，保证不越出 `[0,W]×[0,H]`）。
- 面：遍历 `r ∈ [0,rows)`、`c ∈ [0,cols)`，四角取共享顶点（**不复制坐标**，直接引用 `verts` 里的数组对象），保证相邻面严丝合缝。
- `t = 0.9 + rng() * 0.2`；`speck = Math.floor(rng() * 6)`。
- `wet`：按面中心 x 在 `wetRange` 之间线性插值，再叠 `rng() * 0.15`，最后 `clamp` 到 `[0, 1]`。
- `crack = rng() < crackRate`。
- `W <= 0` 或 `H <= 0` 时返回 `{ cols, rows, verts: [], faces: [] }`（不抛错）。

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test test/ch3-cave.test.js`
Expected: PASS（6 个测试）

- [ ] **Step 5: 提交**

```bash
git add public/js/ch3/cave.js test/ch3-cave.test.js
git commit -m "feat: 第三关洞穴岩面规划器"
```

---

### Task 2: cave.js —— 钟乳石规划与湿度梯度

**Files:**
- Modify: `public/js/ch3/cave.js`
- Test: `test/ch3-cave.test.js`

**Interfaces:**
- Consumes: `rng`（Task 1）
- Produces:
  - `stalactitePlan(seed: number, W: number, topY: number, count: number) -> Stalactite[]`
  - `Stalactite = { x: number, w: number, h: number, lean: number }` —— `x` 是锥顶中心、`w` 顶部半宽、`h` 下垂高度、`lean` 横向倾斜（`-1..1`）
  - `CAVE_SEEDS = { bank: 41, crevice: 47, deep: 53 }`
  - `CAVE_PAL = { rockA, rockB, rockDark, floor, moss, mossHi, damp }`（十六进制字符串，冷湿调）

- [ ] **Step 1: 写失败测试**

```js
// 追加到 test/ch3-cave.test.js
import { stalactitePlan, CAVE_SEEDS, CAVE_PAL } from '../public/js/ch3/cave.js';

test('stalactitePlan：数量正确、同种子全等、全部落在 [0,W] 内', () => {
  const a = stalactitePlan(41, 1280, 0, 9);
  assert.equal(a.length, 9);
  assert.deepEqual(a, stalactitePlan(41, 1280, 0, 9));
  assert.notDeepEqual(a, stalactitePlan(42, 1280, 0, 9));
  for (const s of a) {
    assert.ok(s.x >= 0 && s.x <= 1280, `x=${s.x}`);
    assert.ok(s.h > 0, `h=${s.h}`);
    assert.ok(s.w > 0, `w=${s.w}`);
    assert.ok(s.lean >= -1 && s.lean <= 1, `lean=${s.lean}`);
  }
});

test('stalactitePlan：count=0 返回空数组，不抛错', () => {
  assert.deepEqual(stalactitePlan(41, 1280, 0, 0), []);
});

test('CAVE_SEEDS：三间房各有一个不同种子；CAVE_PAL 全是合法十六进制色', () => {
  const seeds = Object.values(CAVE_SEEDS);
  assert.equal(new Set(seeds).size, seeds.length);
  for (const v of Object.values(CAVE_PAL)) assert.match(v, /^#[0-9a-f]{6}$/i);
});

test('湿度梯度：wetRange 左低右高时，右半面平均 wet 高于左半面', () => {
  const p = cavePlan(41, 1280, 590, { cols: 8, rows: 2, wetRange: [0.05, 0.75] });
  const mid = 1280 / 2;
  const left = p.faces.filter(f => f.pts[0][0] < mid);
  const right = p.faces.filter(f => f.pts[0][0] >= mid);
  const avg = a => a.reduce((s, f) => s + f.wet, 0) / a.length;
  assert.ok(avg(right) > avg(left), `左 ${avg(left)} 右 ${avg(right)}`);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/ch3-cave.test.js`
Expected: FAIL —— `stalactitePlan is not a function`

- [ ] **Step 3: 实现 `stalactitePlan`、`CAVE_SEEDS`、`CAVE_PAL`**

- `stalactitePlan`：按 `x` 均分 `count` 段，每段内抖动中心位置；`w = 8 + rng() * 22`、`h = 40 + rng() * 120`、`lean = (rng() - 0.5) * 2`。**抖动后必须把 `x` clamp 回 `[0, W]`**，否则首尾钟乳石会出画、越界断言先挂。`count <= 0` 返回 `[]`。
- `CAVE_SEEDS`：三间房不同种子，岸边用 `41`。
- `CAVE_PAL`：冷湿岩色。基色比第一关的暖灰石（`#7b7669` / `#6b675c`）更冷更暗，且**明度不低于第一关石面**——保证无光源前提下仍可辨。

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test test/ch3-cave.test.js`
Expected: PASS（10 个测试）

- [ ] **Step 5: 提交**

```bash
git add public/js/ch3/cave.js test/ch3-cave.test.js
git commit -m "feat: 第三关钟乳石规划与洞穴色板"
```

---

### Task 3: render.js —— 接触阴影助手与洞穴岩面上色器

**Files:**
- Modify: `public/js/ch3/render.js`
- Test: `test/ch3-cave.test.js`

**Interfaces:**
- Consumes: `cavePlan` / `stalactitePlan` / `CAVE_PAL`（Task 1、2）、`shade`（`../sideview.js`）
- Produces:
  - `contactShadow(x: Ctx, cx: number, cy: number, rx: number, ry?: number) -> void` —— `ry` 默认 `rx * 0.28`；一枚 `rgba(0,0,0,.25)` 椭圆 + 填充，无方向偏移
  - `drawCaveWall(x: Ctx, plan: CavePlan, opts: { base: string, moss: string, mossHi: string }) -> void`
  - `drawCaveFloor(x: Ctx, plan: CavePlan, opts: { base: string }) -> void`
  - `drawStalactites(x: Ctx, plan: Stalactite[], topY: number, base: string) -> void`

- [ ] **Step 1: 写失败测试**

```js
// 追加到 test/ch3-cave.test.js
import { contactShadow, drawCaveWall, drawCaveFloor, drawStalactites } from '../public/js/ch3/render.js';
import { CAVE_PAL } from '../public/js/ch3/cave.js';

function recordingCtx() {                 // 记录型 canvas 桩，同 test/art.test.js 风格
  const calls = { fill: 0, stroke: 0, ellipse: 0, arc: 0, moveTo: 0, lineTo: 0, fillRect: 0, quadraticCurveTo: 0 };
  const grad = { addColorStop() {} };
  return new Proxy({ __calls: calls }, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
      return () => { if (k in calls) calls[k]++; };
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

test('contactShadow：恰好一枚椭圆 + 一次填充，且不改 globalAlpha 之外的状态', () => {
  const x = recordingCtx();
  contactShadow(x, 640, 590, 60);
  assert.equal(x.__calls.ellipse, 1);
  assert.equal(x.__calls.fill, 1);
  assert.equal(x.__calls.arc, 0);
});

test('drawCaveWall：每个岩面至少一次填充（逐块上色）', () => {
  const plan = cavePlan(41, 1280, 590, { cols: 4, rows: 3 });
  const x = recordingCtx();
  drawCaveWall(x, plan, { base: CAVE_PAL.rockA, moss: CAVE_PAL.moss, mossHi: CAVE_PAL.mossHi });
  assert.ok(x.__calls.fill >= plan.faces.length, `fill=${x.__calls.fill} 面数=${plan.faces.length}`);
});

test('drawCaveFloor：不抛错且至少一次填充', () => {
  const plan = cavePlan(41, 1280, 200, { cols: 4, rows: 2 });
  const x = recordingCtx();
  assert.doesNotThrow(() => drawCaveFloor(x, plan, { base: CAVE_PAL.floor }));
  assert.ok(x.__calls.fill >= 1);
});

test('drawStalactites：每根至少一次填充；空数组不抛错', () => {
  const x = recordingCtx();
  const plan = stalactitePlan(41, 1280, 0, 5);
  drawStalactites(x, plan, 0, CAVE_PAL.rockDark);
  assert.ok(x.__calls.fill >= plan.length);
  assert.doesNotThrow(() => drawStalactites(recordingCtx(), [], 0, CAVE_PAL.rockDark));
});

test('drawCaveWall：苔藓只画在 wet>0 的面上（wet 全 0 时不做苔藓填充）', () => {
  const dry = cavePlan(41, 1280, 590, { cols: 3, rows: 2, wetRange: [0, 0] });
  const wet = cavePlan(41, 1280, 590, { cols: 3, rows: 2, wetRange: [0.9, 0.9] });
  const xd = recordingCtx(), xw = recordingCtx();
  drawCaveWall(xd, dry, { base: CAVE_PAL.rockA, moss: CAVE_PAL.moss, mossHi: CAVE_PAL.mossHi });
  drawCaveWall(xw, wet, { base: CAVE_PAL.rockA, moss: CAVE_PAL.moss, mossHi: CAVE_PAL.mossHi });
  assert.ok(xw.__calls.fill > xd.__calls.fill, `湿 ${xw.__calls.fill} 应多于干 ${xd.__calls.fill}`);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/ch3-cave.test.js`
Expected: FAIL —— `contactShadow is not a function`

- [ ] **Step 3: 实现四个绘制函数**

- `contactShadow`：`ellipse(cx, cy, rx, ry, 0, 0, 7)` + `fill()`，填充 `rgba(0,0,0,.25)`。**不要**用 `globalAlpha` 之外的 save/restore 包裹。
- `drawCaveWall`：底填 `shade(base, -0.35)`；逐面按 `pts` 走 `moveTo/lineTo` 闭合成多边形，填 `shade(base, f.t - 1)`；沿多边形**上半段描受光边** `shade(base, f.t - 1 + 0.16)`、**下半段描沉影边** `shade(base, f.t - 1 - 0.22)`（lineWidth 2）；`f.crack` 时在面内画一条折线裂缝（`rgba(30,28,34,.55)`）；`f.wet > 0` 时自该面**下缘向上**做 2×2 拜耳抖动苔藓，高度 `Math.round(6 + f.wet * 16)`，密度阈值与 ch1 一致（`BAYER` 表 `[[0,2],[3,1]]`，`dens * (0.3 + th * 0.9) > 0.30`）；`f.speck` 个 1px 亮点随机撒在面内。最后叠洞顶沉暗线性渐变（顶部 `rgba(6,8,14,.45)` → 中段透明）。
- `drawCaveFloor`：同款逐面上色，但受光边在**顶缘**、沉影边在**底缘**，并叠墙脚落地阴影渐变（`rgba(0,0,0,.30)` → 透明）。
- `drawStalactites`：每根从 `(x, topY)` 向 `(x + lean * h * 0.3, topY + h)` 画一个闭合的锥形多边形（顶部 `w` 半宽、尖端收窄到 2px），填 `base`，左缘提亮、右缘压暗。

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test test/ch3-cave.test.js`
Expected: PASS（15 个测试）

- [ ] **Step 5: 提交**

```bash
git add public/js/ch3/render.js test/ch3-cave.test.js
git commit -m "feat: 洞穴岩面上色器与接触阴影"
```

---

### Task 4: render.js + kit.js —— 场景生命周期与岸边预烘焙

**Files:**
- Modify: `public/js/ch3/render.js`, `public/js/ch3/kit.js`
- Test: `test/ch3-cave.test.js`

**Interfaces:**
- Consumes: `drawCaveWall` / `drawCaveFloor` / `drawStalactites`（Task 3）、`cavePlan` / `stalactitePlan` / `CAVE_SEEDS` / `CAVE_PAL`（Task 1、2）
- Produces:
  - `createScene() -> { baked: {} }`
  - `initScene(sc, atlases, geo) -> void` —— 烘焙 `sc.baked.bank`（`document.createElement('canvas')`，1280×720）。
    **`geo` 是 `content.geometry`**：第一关有模块级 `LAYOUT` 常量，第三关几何在 content JSON 里，render.js 拿不到 `groundY`，所以必须由调用方传入
  - `drawScene(x: Ctx, sc, w) -> void` —— 有烘焙层则 `drawImage(baked, 0, 0)`，否则调 `drawRoom(w, x)` 回退。**本任务不调用 `drawWater`**（Task 7 才加），避免水面画两遍。
  - `drawRoom(w, x) -> void` 保持现有签名与行为（裂隙/深水仍在用；岸边水面段本任务保留，Task 7 抽走）

- [ ] **Step 1: 写失败测试**

```js
// 追加到 test/ch3-cave.test.js
import { createScene, initScene, drawScene } from '../public/js/ch3/render.js';

test('createScene：初始 baked 为空对象', () => {
  const sc = createScene();
  assert.deepEqual(sc.baked, {});
});

test('initScene 在无 document 环境下不抛错，且不产生烘焙层', () => {
  const sc = createScene();
  assert.doesNotThrow(() => initScene(sc, null, { bank: { groundY: 590 } }));
  assert.equal(sc.baked.bank, undefined);
});

test('drawScene：无烘焙层时回退到旧路径且不抛错', () => {
  const sc = createScene();
  const w = { currentRoom: 'crevice', view: { t: 0 }, geo: { crevice: { groundY: 590 } } };
  assert.doesNotThrow(() => drawScene(mockCtx(), sc, w));
});

test('drawScene：三间房轮流绘制都不抛错（回退路径覆盖全房间）', () => {
  const sc = createScene();
  for (const room of ['bank', 'crevice', 'deep']) {
    const w = { currentRoom: room, view: { t: 0 }, geo: { [room]: { groundY: 590 } } };
    assert.doesNotThrow(() => drawScene(mockCtx(), sc, w), `${room} 抛错`);
  }
});

test('drawScene：重复绘制复用同一场景对象，不累积状态', () => {
  const sc = createScene();
  const w = { currentRoom: 'crevice', view: { t: 0 }, geo: { crevice: { groundY: 590 } } };
  drawScene(mockCtx(), sc, w);
  const snapshot = JSON.stringify(sc);
  drawScene(mockCtx(), sc, w);
  assert.equal(JSON.stringify(sc), snapshot, '场景对象在绘制后不应被改写');
});
```

第三条覆盖 Review Focus #3（换房复用）中可在 Node 验证的部分：场景对象不被绘制改写。真正的「不重复烘焙」在 Task 9 Step 3 用浏览器验证。

`mockCtx` 用 `test/scene.bg.test.js` 的宽松版（任何方法可调、任何属性可写，只断言不抛）。

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/ch3-cave.test.js`
Expected: FAIL —— `createScene is not a function`

- [ ] **Step 3: 实现场景生命周期并接进 kit**

- `createScene` / `initScene` / `drawScene` 按上面的 Interfaces 实现。`initScene` 首行 `if (typeof document === 'undefined') return;`（覆盖 Review Focus #2），随后 `try/catch` 包住烘焙（覆盖 Review Focus #1）。
- `prerenderBank()`（内部函数）：建 1280×720 离屏 canvas，`imageSmoothingEnabled = false`，依次画「岩壁 `cavePlan(CAVE_SEEDS.bank, SIDE.W, groundY)` → 钟乳石 `stalactitePlan(CAVE_SEEDS.bank + 1, SIDE.W, 0, 9)` → 地面 `cavePlan(CAVE_SEEDS.bank + 2, SIDE.W, SIDE.H - groundY, { wetRange: [0.05, 0.05] })`」。
- `kit.js`：`makeWorld({ content, game, cv, atlases })` 里 `const sc = createScene(); initScene(sc, atlases, content.geometry);` 并把 `sc` 挂到 `w.sc`。
- `kit.js` 的 `draw()`：把 `drawRoom(w, x)` 换成 `drawScene(x, sc, w)`。
- **`drawRoom` 里 `room === 'bank'` 的水面段保留不动**（Task 7 再抽走），确保本任务后岸边视觉 = 新岩壁 + 旧水面，可单独验证。

- [ ] **Step 4: 跑测试确认通过 + 全量回归**

Run: `node --test test/ch3-cave.test.js && npm test`
Expected: 新测试 PASS；`npm test` 全绿且总数 ≥ 155

- [ ] **Step 5: 浏览器确认岸边已换岩壁**

```bash
PORT=3111 node server.js &
"/c/Program Files/Google/Chrome/Application/chrome.exe" --headless --disable-gpu --hide-scrollbars \
  --virtual-time-budget=9000 --window-size=1280,720 \
  --screenshot=/tmp/bank-baked.png "http://127.0.0.1:3111/chapter3.html?autostart=1"
```
用 Read 打开 `/tmp/bank-baked.png`：应看到不规则岩面 + 逐块明暗 + 苔藓 + 钟乳石，且**旧水面与旧门仍在**（本任务只换背景）。确认后杀掉服务。

- [ ] **Step 6: 提交**

```bash
git add public/js/ch3/render.js public/js/ch3/kit.js test/ch3-cave.test.js
git commit -m "feat: 岸边背景预烘焙接入"
```

---

### Task 5: render.js —— 裂隙口替换岸边门

**Files:**
- Modify: `public/js/ch3/render.js`
- Test: `test/ch3-cave.test.js`

**Interfaces:**
- Consumes: `contactShadow`（Task 3）、`rng` / `CAVE_PAL`（Task 1、2）
- Produces:
  - `drawCrack(x: Ctx, cx: number, gy: number, seed: number, opts?: { h?: number, halfBottom?: number, halfTop?: number }) -> void`
  - 默认 `{ h: 170, halfBottom: 35, halfTop: 12 }`
  - 删除 `drawBankObjects` 里的门梯形段（现 `render.js:41-44` 的两条 `beginPath` 门块）

- [ ] **Step 1: 写失败测试**

```js
// 追加到 test/ch3-cave.test.js
import { drawCrack } from '../public/js/ch3/render.js';

test('drawCrack：不抛错，且至少一次填充 + 一次描边（唇口受光边）', () => {
  const x = recordingCtx();
  drawCrack(x, 650, 590, 41);
  assert.ok(x.__calls.fill >= 1);
  assert.ok(x.__calls.stroke >= 1);
});

test('drawCrack：同种子几何确定（调用序列长度一致）', () => {
  const a = recordingCtx(), b = recordingCtx();
  drawCrack(a, 650, 590, 41);
  drawCrack(b, 650, 590, 41);
  assert.deepEqual(a.__calls, b.__calls);
});

test('drawCrack：默认高度 170、底宽 70（半宽 35）、顶宽 24（半宽 12）', () => {
  const x = recordingCtx();
  drawCrack(x, 650, 590, 41);
  // 记录型桩额外记录 moveTo/lineTo 的点，用于断言包围盒
  const xs = x.__pts.map(p => p[0]), ys = x.__pts.map(p => p[1]);
  assert.ok(Math.abs(Math.min(...ys) - (590 - 170)) < 2, `顶部 y=${Math.min(...ys)}`);
  assert.ok(Math.abs(Math.min(...xs) - (650 - 35)) < 8, `左缘 x=${Math.min(...xs)}`);
  assert.ok(Math.abs(Math.max(...xs) - (650 + 35)) < 8, `右缘 x=${Math.max(...xs)}`);
});
```

第三条测试需要 `recordingCtx` 同时记录 `moveTo`/`lineTo` 的点到 `__pts`——在本任务里给桩加上这个记录（扩展现有桩，不改动其他断言）。

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/ch3-cave.test.js`
Expected: FAIL —— `drawCrack is not a function`

- [ ] **Step 3: 实现 `drawCrack` 并替换岸边门**

- 左右两缘各由 `rng(seed)` 生成一串折点，从 `(cx ∓ halfBottom, gy)` 收到 `(cx ∓ halfTop, gy - h)`；两缘之间用一条近黑多边形填充（`#0a0d12`），内部叠竖向纵深渐变（上端更暗）。
- 沿**左缘**描受光边、**右缘**描沉影边（与岩面的受光方向一致）。
- 唇口撒 3–5 块小多边形碎石，用 `CAVE_PAL.rockB`，每块带 `contactShadow`。
- `drawBankObjects` 中删除门的两段梯形绘制，改为 `drawCrack(x, geo.doorX, geo.groundY, CAVE_SEEDS.bank + 3)`。
- **`kit.js` 的 `creviceDoor` 目标坐标与半径（`x = geo.bank.doorX`, `y = geo.bank.groundY`, `r = 110`）不动。**
- **绘制顺序保证（Review Focus #4）**：裂缝画在 `drawBankObjects` 里，而 `kit.draw()` 的顺序是「`drawScene` → `drawBankObjects` → 玩家 → 石头」，所以玩家精灵天然压在裂缝之上。**不要**把 `drawCrack` 移进 `drawScene` 或烘焙层，否则玩家会被裂缝盖住。

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test test/ch3-cave.test.js && npm test`
Expected: 全绿，总数 ≥ 155

- [ ] **Step 5: 浏览器确认**

截图 `?autostart=1`，用 Read 打开：裂隙口应读作「一道能进去的缝」，而不是一扇门；巨石与门重叠的灰块问题此时仍在（Task 6 处理）。

- [ ] **Step 6: 提交**

```bash
git add public/js/ch3/render.js test/ch3-cave.test.js
git commit -m "feat: 岸边裂隙口替换石门"
```

---

### Task 6: render.js —— 洞穴巨石替换石墩

**Files:**
- Modify: `public/js/ch3/render.js`
- Test: `test/ch3-cave.test.js`

**Interfaces:**
- Consumes: `contactShadow`（Task 3）、`cavePlan` / `CAVE_PAL` / `rng`（Task 1、2）
- Produces:
  - `drawBoulder(x: Ctx, cx: number, gy: number, seed: number, w?: number) -> void` —— 默认 `w = 90`，左缘 `cx - w/2`、右缘 `cx + w/2`
  - 删除 `drawBankObjects` 里的石墩段（`#67727d` 圆角方块 + `#b28a58` 木条）

> **定位方式**：本计划里 `drawBankObjects` 相关的行号（石墩 `:38-40`、门 `:41-44`、系泊块 `:50`）取自**改动前的原始工作区**。Task 5 先删门、Task 6 再删石墩，每步都会让后续行号漂移。**一律按内容定位**（`#67727d` 圆角方块、`#2d3941` 的 8×8 方块、两条门梯形），不要按行号。

- [ ] **Step 1: 写失败测试**

```js
// 追加到 test/ch3-cave.test.js
import { drawBoulder } from '../public/js/ch3/render.js';

test('drawBoulder：不抛错，至少一次填充，且落影独立于石体', () => {
  const x = recordingCtx();
  drawBoulder(x, 515, 590, 41);
  assert.ok(x.__calls.fill >= 1);
  assert.equal(x.__calls.ellipse, 1, '恰好一枚落地影');
});

test('drawBoulder：同种子确定', () => {
  const a = recordingCtx(), b = recordingCtx();
  drawBoulder(a, 515, 590, 41);
  drawBoulder(b, 515, 590, 41);
  assert.deepEqual(a.__calls, b.__calls);
});

test('drawBoulder：水平范围不越出 [cx-45, cx+45]', () => {
  const x = recordingCtx();
  drawBoulder(x, 515, 590, 41, 90);
  const xs = x.__pts.map(p => p[0]);
  assert.ok(Math.min(...xs) >= 515 - 45 - 1, `左 ${Math.min(...xs)}`);
  assert.ok(Math.max(...xs) <= 515 + 45 + 1, `右 ${Math.max(...xs)}`);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/ch3-cave.test.js`
Expected: FAIL —— `drawBoulder is not a function`

- [ ] **Step 3: 实现 `drawBoulder` 并替换石墩**

- 用一个 `cavePlan(seed, w, 90, { cols: 2, rows: 2 })` 的岩面数据画不规则巨石轮廓：底部贴合 `gy`，顶部起伏，左右收窄；逐面用 `CAVE_PAL.rockA/rockB` 上色并描受光/沉影边；顶部几处崩口（小多边形，`CAVE_PAL.rockDark`）。
- 先 `contactShadow(x, cx, gy + 4, w * 0.55)` 再画石体。
- `drawBankObjects` 中删除石墩段，改为 `drawBoulder(x, 515, geo.groundY, CAVE_SEEDS.bank + 4)`（左缘 470、右缘 560，与合成台 284–436、裂隙口 595–705 各留 ~34px 空隙）。
- 巨石无碰撞、无交互、不进 `TARGETS`。

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test test/ch3-cave.test.js && npm test`
Expected: 全绿

- [ ] **Step 5: 浏览器确认**

截图 `?autostart=1`：巨石与裂隙口应**完全分离**、不再糊成一团；巨石有落地影。

- [ ] **Step 6: 提交**

```bash
git add public/js/ch3/render.js test/ch3-cave.test.js
git commit -m "feat: 岸边石墩改为洞穴巨石"
```

---

### Task 7: render.js —— 流动水面

**Files:**
- Modify: `public/js/ch3/render.js`
- Test: `test/ch3-cave.test.js`

**Interfaces:**
- Consumes: `CAVE_PAL`、`rng`（Task 1、2）
- Produces:
  - `drawWater(x: Ctx, w, t: number) -> void` —— 只处理 `w.currentRoom === 'bank'`；水面 x 从 `w.geo.bank.waterX` 到 `SIDE.W`
  - `drawRoom` 中岸边的水面段**删除**（现 `render.js:28-32`），改由 `drawScene` 调 `drawWater`

- [ ] **Step 1: 写失败测试**

```js
// 追加到 test/ch3-cave.test.js
import { drawWater } from '../public/js/ch3/render.js';

function bankWorld() {
  return { currentRoom: 'bank', geo: { bank: { groundY: 590, waterX: 760 } }, view: { t: 0 }, raft: { x: 880, y: 584 } };
}

test('drawWater：不抛错，且随 t 变化（动画确实在动）', () => {
  const a = recordingCtx(), b = recordingCtx();
  drawWater(a, bankWorld(), 0);
  drawWater(b, bankWorld(), 1.7);
  assert.ok(a.__calls.fill > 0);
  assert.notDeepEqual(a.__pts, b.__pts, 't 不同时波点位置应不同');
});

test('drawWater：同一 t 下输出确定（可复现）', () => {
  const a = recordingCtx(), b = recordingCtx();
  drawWater(a, bankWorld(), 2.5);
  drawWater(b, bankWorld(), 2.5);
  assert.deepEqual(a.__pts, b.__pts);
});

test('drawWater：只画在水面 x 范围内（不越到左岸）', () => {
  const x = recordingCtx();
  drawWater(x, bankWorld(), 1);
  for (const [px] of x.__pts) assert.ok(px >= 760 - 1, `波点越到岸上 x=${px}`);
});

test('drawWater：非岸边房间不绘制任何东西', () => {
  const x = recordingCtx();
  const w = bankWorld(); w.currentRoom = 'deep';
  drawWater(x, w, 1);
  assert.equal(x.__calls.fill, 0);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/ch3-cave.test.js`
Expected: FAIL —— `drawWater is not a function`

- [ ] **Step 3: 实现 `drawWater`**

三层，全部只用 `fill`/`fillRect`/`quadraticCurveTo` 的组合（**不引入 `filter`/`shadowBlur`**，保持与项目其余部分一致的廉价绘制）：

1. **底**：`createLinearGradient(waterX, 0, SIDE.W, 0)`，近岸浅 → 河心深。
2. **中**：4 层流动波。每层 `phase = t * speed[i]`，沿 x 每 40px 取一点，`y = baseY[i] + Math.sin(x * 0.012 + phase) * amp[i]`，用 `moveTo/lineTo` 连成折线并描边；各层 `speed` 与 `amp` 不同（例如 `speed = [0.6, 1.1, 0.35, 1.6]`、`amp = [3, 2, 5, 1.5]`）。
3. **表**：岸线泡沫（在 `waterX` 处一排小椭圆，随 `t` 微动）+ 高光碎点（`rng(CAVE_SEEDS.bank + 5)` 生成的固定点阵，亮度随 `Math.sin(t * rate + phase)` 闪烁）。

**倒影**：把洞顶与裂隙口位置在水面拉出 2–3 道柔和的竖向色块（`rgba(...,.06)` 级），不画任何新光源。

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test test/ch3-cave.test.js && npm test`
Expected: 全绿

- [ ] **Step 5: 浏览器确认**

隔 1 秒截两张 `?autostart=1`，对比水面波点位置应不同（证明在动）。

- [ ] **Step 6: 提交**

```bash
git add public/js/ch3/render.js test/ch3-cave.test.js
git commit -m "feat: 岸边河流改为流动水面"
```

---

### Task 8: render.js —— 木筏与原木结构

**Files:**
- Modify: `public/js/ch3/render.js`
- Test: `test/ch3-cave.test.js`

**Interfaces:**
- Consumes: `contactShadow`（Task 3）、`CAVE_PAL`
- Produces:
  - `drawRaft(x: Ctx, cx: number, cy: number, t: number, state?: string) -> void` —— `state` 默认 `'parked'`；**签名向后兼容**，`drawDeepObjects` 现有的四参调用不变
  - `drawLog(x: Ctx, cx: number, cy: number, rot?: number) -> void` 签名不变，内部加结构细节
  - `drawMooring(x: Ctx, cx: number, gy: number) -> void` —— 系泊石桩；`cx` 取 `geo.bank.waterX - 4`

- [ ] **Step 1: 写失败测试**

```js
// 追加到 test/ch3-cave.test.js
import { drawRaft, drawLog } from '../public/js/ch3/render.js';

test('drawRaft：不抛错，结构比旧版复杂（≥10 次填充）', () => {
  const x = recordingCtx();
  drawRaft(x, 880, 584, 0);
  assert.ok(x.__calls.fill >= 10, `fill=${x.__calls.fill}`);
});

test('drawRaft：默认 state=parked，四参调用与五参显式 parked 等价', () => {
  const a = recordingCtx(), b = recordingCtx();
  drawRaft(a, 880, 584, 1.2);
  drawRaft(b, 880, 584, 1.2, 'parked');
  assert.deepEqual(a.__calls, b.__calls);
});

test('drawRaft：有落地/吃水影（至少一枚椭圆）', () => {
  const x = recordingCtx();
  drawRaft(x, 880, 584, 0);
  assert.ok(x.__calls.ellipse >= 1);
});

test('drawLog：签名不变，结构细节增加（≥4 次填充）', () => {
  const x = recordingCtx();
  drawLog(x, 740, 574, -0.08);
  assert.ok(x.__calls.fill >= 4, `fill=${x.__calls.fill}`);
});

test('drawMooring：系泊石桩有落地影与体积（≥1 椭圆、≥2 填充）', () => {
  const x = recordingCtx();
  drawMooring(x, 756, 590);
  assert.ok(x.__calls.ellipse >= 1);
  assert.ok(x.__calls.fill >= 2);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/ch3-cave.test.js`
Expected: FAIL —— `fill=2`（旧版只有圆角条 + 端面）

- [ ] **Step 3: 实现结构版 `drawRaft` 与 `drawLog`**

`drawRaft`：
- 吃水影 `contactShadow(x, cx, cy + 10, 74, 10)`。
- 5 根木板：每根 `roundRect` 填充 + 木纹折线（3–4 段 `lineTo`）+ 左端年轮（2 个同心 `ellipse`）。
- 2 根横梁：跨在板上，比板深一档的色。
- 绳索：4 处 `X` 形缠绕（两条 `moveTo/lineTo`）+ 绳结（小 `arc`）。
- 整体叠 `Math.sin(t * 2.2) * (state === 'parked' ? 2 : 4)` 的浮沉。

`drawLog`：保持现有圆角条 + 端面年轮，补木纹折线、两端年轮、一条树皮暗边。

**系泊块**（`drawBankObjects` 末尾的 `x.fillRect(geo.waterX - 4, geo.groundY - 4, 8, 8)`，`render.js:50`）：8×8 的裸方块太小、且没有落地影。改为一块有体积的系泊石桩（顶面受光、侧面沉影、入水处湿痕），先 `contactShadow` 再画石体。加一条测试：

- [ ] **Step 4: 跑测试确认通过**

Run: `node --test test/ch3-cave.test.js && npm test`
Expected: 全绿（`drawDeepObjects` 的四参调用未受影响）

- [ ] **Step 5: 浏览器确认**

截图 `?autostart=1&beat=assembled`：木筏应有板缝、横梁、绳结；三根原木有木纹。

- [ ] **Step 6: 提交**

```bash
git add public/js/ch3/render.js test/ch3-cave.test.js
git commit -m "feat: 木筏与原木结构细节"
```

---

### Task 9: 回归验证与浏览器验收

**Files:**
- Modify: 无（只验证；发现问题回到对应任务修）

**Interfaces:**
- Consumes: 前八个任务的全部产出
- Produces: 验收结论

- [ ] **Step 1: 全量测试 + 计数**

Run: `npm test`
Expected: 全绿；测试总数 ≥ 155 + 新增数（`node --test` 输出里的 `# pass` 行）

- [ ] **Step 2: 跨章回归**

Run: `node --test test/ch1-physics.test.js test/ch1-planners.test.js test/scene.test.js test/scene.bg.test.js test/ch2.test.js test/ch2b.test.js`
Expected: 全绿 —— 证明未碰坏 `ch1` 与共享件

- [ ] **Step 3: 裂隙房/深水房逐像素未变**

Run:
```bash
git stash && PORT=3111 node server.js &   # 先取改动前的基线
# 截 crevice / deep 两房，存为 before-*.png；再 git stash pop 重截 after-*.png，比对
```
Expected: 两房**景物**画面一致（本轮的 `drawRoom` 回退路径保证这一点）。若有差异，说明回退路径被改坏了，回到 Task 4 修。

**但木筏与原木区域要遮罩掉再比。** `drawRaft` 被 `drawDeepObjects` 调用、`drawLog` 被 `drawCreviceObjects` 调用，两者是共享函数，Task 8 加的结构细节会同时出现在这两间房——这是**想要的**（同一个物体在哪都该是同一样子），不是回归。比对时遮罩木筏/原木的包围盒，其余景物（岩壁、地面、水面、岩画、壁龛）必须逐像素一致。

- [ ] **Step 4: 浏览器验收（Read 打开截图逐条核对）**

```bash
PORT=3111 node server.js &
CH="/c/Program Files/Google/Chrome/Application/chrome.exe"
"$CH" --headless --disable-gpu --hide-scrollbars --virtual-time-budget=9000 --window-size=1280,720 \
  --screenshot=/tmp/acc-bank.png "http://127.0.0.1:3111/chapter3.html?autostart=1"
"$CH" --headless --disable-gpu --hide-scrollbars --virtual-time-budget=9000 --window-size=1280,720 \
  --screenshot=/tmp/acc-raft.png "http://127.0.0.1:3111/chapter3.html?autostart=1&beat=assembled"
```
逐条核对 spec 的判据：岩壁可辨逐块明暗与苔藓 ✓；裂隙口一眼读作「可以进去的地方」✓；水面有流动与高光 ✓；物件不再悬浮 ✓；巨石与裂隙口不糊在一起 ✓。
另核 Review Focus：玩家站在裂隙口正前方时精灵压在裂缝之上（可用 `?beat=assembled` 后走到 650 附近确认）。

- [ ] **Step 5: 无图集兜底验证**

Run: 临时把 `loadAtlases` 的返回改成 `null`（或断网打开 `chapter3.html`）
Expected: 岸边仍渲染出岩壁与地面（纯矢量），家具缺席，**不白屏、`window.__errors` 无新增**。

- [ ] **Step 6: 换房复用验证（Review Focus #3）**

打开 `chapter3.html?autostart=1`，用 `window.G.jump('logged')` 进裂隙房、再 `window.G.jump('assembled')` 回岸边，反复两次。每次回到岸边截图，与首次岸边截图**逐像素一致**；DevTools 里确认没有重复的离屏 canvas 堆积（`performance.memory` 无持续增长）。
Expected: 画面一致、无重复烘焙、无泄漏。

- [ ] **Step 7: 窄窗口验证（Review Focus #5）**

```bash
"$CH" --headless --disable-gpu --hide-scrollbars --virtual-time-budget=9000 --window-size=600,900 \
  --screenshot=/tmp/acc-narrow.png "http://127.0.0.1:3111/chapter3.html?autostart=1"
```
Expected: 烘焙层按 `#stage` 等比缩放，**不变形、不模糊、不裁切**；与第一关同样条件下观感一致。

- [ ] **Step 8: 提交验收结论**

若第 3 步发现裂隙房/深水房有差异，先修回退路径再提交。

```bash
git add -A
git commit -m "test: 岸边洞穴化回归与验收"
```

---

## 后续（不在本计划内）

- **裂隙房轮**：把 `render.js:56-64` 的内联大裂缝换成 `drawCrack` 的不同参数；清除 `'◼  ◼  ◼'` 文字占位；岩壁用 `CAVE_SEEDS.crevice`。
- **深水房轮**：岩画与壁龛重画；清除 `'石壁上的撑篙图'` 文字占位；木筏 `riding` / `poling` 状态与撑篙演出（消费现在还是死变量的 `poleT`）。
