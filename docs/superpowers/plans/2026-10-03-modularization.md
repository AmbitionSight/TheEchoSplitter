# 三大文件按层模块化 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 main.js/scene.js/ch4.js 按层拆进 ch1/、ch4/ 目录，入口纯重导出，HTML 与现有测试 import 路径零改动，130 测试全绿并补新单元测试。

**Architecture:** 纯结构重构，树内容不变式=行为不变。分三层派发（ch1 拆分 → ch4 拆分 → 测试与文档），每层独立提交。依赖单向：planners ← physics ← render ← kit；event 只依赖 chapter.js。

**Tech Stack:** 原生 ESM、node:test。

**设计稿:** `docs/superpowers/specs/2026-10-03-git-conventions-design.md`（本次为其后继：设计已口头确认，方案 A 按层拆分）

---

## 文件结构（目标态）

```
public/js/ch1/planners.js   ← scene.js 规划器段（LAYOUT..slabPlan，行 1-96 纯函数）
public/js/ch1/physics.js    ← scene.js 物理段（resolveCollisions..magnetStep）
public/js/ch1/render.js     ← scene.js 渲染段（BENCH_SOCKETS..drawOverlay）
public/js/ch1/event.js      ← main.js 事件机段（createGame..jump）
public/js/ch1/kit.js        ← main.js 浏览器 kit 段
public/js/ch4/event.js      ← ch4.js 事件机段
public/js/ch4/render.js     ← ch4.js 绘制段（drawRoom..drawBubble）
public/js/ch4/kit.js        ← ch4.js kit 段
main.js / scene.js / ch4.js → 纯重导出入口
```

依赖方向：planners 无依赖；physics→planners；render→planners/physics/sprites/art；ch1/event→chapter.js 公共件；ch1/kit→event/render/physics/shell 系；ch4/event→chapter 公共件；ch4/render→sprites/art/sideview；ch4/kit→event/render。**任何新模块禁止 import 入口文件**（防循环）。

入口重导出注意：scene.js 当前导出符号与 main.js 有公共子集（如 kit 由 main 导出），重导出必须显式列名（`export { LAYOUT, rng, clamp, … } from './ch1/…'`），不得用 `export *`（多源同名冲突静默覆盖）。

## 任务

### Task 1: 拆 ch1/——planners + physics（源自 scene.js）

**Files:**
- Create: `public/js/ch1/planners.js`、`public/js/ch1/physics.js`
- Modify: `public/js/scene.js` → 纯重导出入口

- [ ] **Step 1:** 建目录，把 scene.js 行 1-96（`// —— 布局` 至 slabPlan 结束，含 LAYOUT/rng/clamp/WALL_SEAM/LIGHTS/masonryPlan/slabPlan）原样移入 `ch1/planners.js`，保留节注释。
- [ ] **Step 2:** 把 scene.js `resolveCollisions/screenToLogical/moveToward/makeStone/stepStone/magnetStep`（含"石物理""磁吸"节注释）移入 `ch1/physics.js`，顶部 `import { LAYOUT, clamp } from './planners.js'`（按实际引用）。
- [ ] **Step 3:** scene.js 改为显式重导出这两个文件的全部原导出符号（对照 git 原版 `git show HEAD:public/js/scene.js | grep '^export'` 清单，一个不少）。
- [ ] **Step 4:** `node --test test/scene.bg.test.js test/game.test.js` 全绿；`grep -rE "from '.*scene" public/js/ | grep -v ch1/` 确认无内部模块改从别处 import scene。
- [ ] **Step 5:** 提交 `refactor: scene 规划器与物理抽为 ch1 模块`

### Task 2: 拆 ch1/render + event + kit

**Files:**
- Create: `public/js/ch1/render.js`、`public/js/ch1/event.js`、`public/js/ch1/kit.js`
- Modify: `public/js/scene.js`、`public/js/main.js` → 纯重导出入口

- [ ] **Step 1:** scene.js 剩余渲染段（BENCH_SOCKETS..drawOverlay，含场景对象 createScene/initScene/updateScene）移入 `ch1/render.js`，import planners/physics/sprites/art。
- [ ] **Step 2:** main.js 事件机段（`createGame/startGame/chooseTease/gameEvent/jump`，含调试图）移入 `ch1/event.js`；kit 段移入 `ch1/kit.js`（import event/render/physics + shell/workbench/chapter 公共件）。
- [ ] **Step 3:** scene.js、main.js 均改为显式重导出入口（对照原导出清单逐个核对）。
- [ ] **Step 4:** `npm test` 全绿（130）。
- [ ] **Step 5:** 提交 `refactor: main 事件机与俯视 kit 抽为 ch1 模块，scene 渲染层归位`

### Task 3: 拆 ch4/——event + render + kit

**Files:**
- Create: `public/js/ch4/event.js`、`public/js/ch4/render.js`、`public/js/ch4/kit.js`
- Modify: `public/js/ch4.js` → 纯重导出入口

- [ ] **Step 1:** ch4.js 事件机段（seedOpening..ch4Debug，行 ~21-277）移入 `ch4/event.js`。
- [ ] **Step 2:** 绘制段（currentGround 之后的 drawRoom..drawBubble）移入 `ch4/render.js`（currentGround/placeRoom 若 kit 与 render 共用则留在 kit 并 export，render 从 kit import；若仅 render 用则留在 render）。
- [ ] **Step 3:** kit 段移入 `ch4/kit.js`；ch4.js 改显式重导出（导出清单对照原 `^export` 行）。
- [ ] **Step 4:** `node --test test/ch4.test.js` + `npm test` 全绿。
- [ ] **Step 5:** 提交 `refactor: ch4 事件机与 kit 分层`

### Task 4: 新增单元测试（直接 import 分层模块）

**Files:**
- Create: `test/ch1-planners.test.js`、`test/ch1-physics.test.js`、`test/ch4-event.test.js`

- [ ] **Step 1:** planners 测试：同 seed masonryPlan/slabPlan 输出全等；边界（W=0、faceH 极小）不抛错；输出行/列结构合法（每行 y 单调、砖块不越界）。
- [ ] **Step 2:** physics 测试：resolveCollisions 边界推出、moveToward 恰好到达钳制、stepStone 静止条件、magnetStep 进入 46px 半径后加速逼近。
- [ ] **Step 3:** ch4-event 测试：直接 `import { createGame, gameEvent } from '../public/js/ch4/event.js'`，跑三房间主线 happy path（跨关词收集→bank→craft→use→raft→结算），断言 room/结算字段。
- [ ] **Step 4:** `npm test` 全绿（130 + 新增）。
- [ ] **Step 5:** 提交 `test: ch1/ch4 分层模块直接单测`

### Task 5: CLAUDE.md 同步 + 终验

- [ ] **Step 1:** CLAUDE.md「Architecture」的 chapter entry points 段落更新为分章目录结构说明（入口重导出 + ch1/ch4 分层职责）。
- [ ] **Step 2:** 终验：`npm test` 全绿；`grep -rn "import.*from" test/ | wc -l` 与拆前一致（测试 import 路径零改动）；浏览器冒烟（autostart=1 四章节能开、window.__errors 为空——需要真机时由用户确认）。
- [ ] **Step 3:** 提交 `docs: CLAUDE.md 同步 ch1/ch4 分层结构`

## 回滚

每任务独立提交，出问题 `git reset --hard HEAD~1` 即回到上一任务边界；全部在 develop，远端不受影响直到推送。
