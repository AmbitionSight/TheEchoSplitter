# 第一关背景《石匠像素》实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 第一关背景从照片材质换成程序生成的像素砌石墙 + 大石板地，统一光法则与透形暗区（spec: docs/superpowers/specs/2026-10-03-ch1-background-redesign.md）。

**Architecture:** 纯函数规划器（masonryPlan/slabPlan，种子确定、Node 可测）+ prerenderStatic 照单烘焙；光锚点常量 LIGHTS 单源供 makeDarkness/drawScene；级色移到 drawOverlay 首层。LAYOUT、content、事件机不碰。

**Tech Stack:** 原生 ESM Canvas，node:test。

---

### Task 1: 常量与纯规划器（TDD）

**Files:**
- Modify: `public/js/scene.js`（顶部新增导出）
- Test: `test/scene.bg.test.js`（新建）

- [ ] 写失败测试 `test/scene.bg.test.js`：

```js
import { test } from 'node:test';
import assert from 'node:assert';
import { WALL_SEAM, LIGHTS, LAYOUT, masonryPlan, slabPlan, resolveCollisions } from '../public/js/scene.js';

test('WALL_SEAM 带高一致：面<基线<=可行走线，碰撞下界引用同一常量', () => {
  assert.ok(WALL_SEAM.face < WALL_SEAM.base);
  assert.ok(WALL_SEAM.base <= WALL_SEAM.walk);
  const p = resolveCollisions({ x: 640, y: 100 });
  assert.ok(p.y >= WALL_SEAM.walk);
});

test('masonryPlan 同种子确定、错缝覆盖全宽、含苔藓与裂纹标记', () => {
  const a = masonryPlan(23, 1280, 284), b = masonryPlan(23, 1280, 284);
  assert.deepEqual(a, b);
  for (const row of a) {
    let end = row.x0;
    for (const blk of row.blocks) {
      assert.ok(blk.w >= 60 && blk.w <= 96);
      assert.equal(blk.x, end);            // 无缝 contiguous
      end = blk.x + blk.w;
      assert.ok(blk.t > 0.85 && blk.t < 1.15);
      assert.ok(blk.moss >= 0 && blk.moss <= 1);
    }
    assert.ok(Math.abs(end - (row.x0 + row.width)) < 1);
  }
  assert.ok(a.length >= 5);                // 284/行高≈42 → 6~7 行
  assert.ok(a.some(r => r.blocks.some(b => b.crack)));
  assert.ok(a.some(r => r.blocks.some(b => b.moss > 0.3)));
});

test('masonryPlan 异种子布局不同（非壁纸）', () => {
  const a = masonryPlan(23, 1280, 284), c = masonryPlan(24, 1280, 284);
  assert.notDeepEqual(a, c);
});

test('井区（x<300）苔藓密度均值高于远端（x>700）', () => {
  const rows = masonryPlan(23, 1280, 284);
  const near = [], far = [];
  for (const r of rows) for (const b of r.blocks) (b.x < 300 ? near : b.x > 700 ? far : []).push(b.moss);
  const avg = arr => arr.reduce((s, v) => s + v, 0) / arr.length;
  assert.ok(avg(near) > avg(far));
});

test('slabPlan 同种子确定、板宽 150–220、覆盖全宽', () => {
  const a = slabPlan(31, 1280, 300, 420), b = slabPlan(31, 1280, 300, 420);
  assert.deepEqual(a, b);
  for (const row of a) {
    let end = row.x0;
    for (const s of row.blocks) { assert.ok(s.w >= 150 && s.w <= 220); end = s.x + s.w; }
    assert.ok(Math.abs(end - (row.x0 + row.width)) < 1);
  }
});

test('LIGHTS 光锚点与视觉光源对齐（窗心=330,160；火盆≈障碍圆心）', () => {
  assert.equal(LIGHTS.window.x, 330); assert.ok(Math.abs(LIGHTS.window.y - 160) <= 2);
  const bz = LAYOUT.obstacles.find(o => o.id === 'brazier');
  assert.ok(Math.hypot(LIGHTS.brazier.x - bz.x, LIGHTS.brazier.y - bz.y) <= 10);
  for (const k of ['window', 'brazier', 'candle', 'switch']) {
    assert.ok(LIGHTS[k].r > 0 && LIGHTS[k].s > 0 && LIGHTS[k].s <= 1);
  }
});
```

- [ ] 跑 `node --test test/scene.bg.test.js` 确认失败（导出不存在）。
- [ ] `scene.js` 顶部（LAYOUT 之后）实现：

```js
// —— 墙地带高唯一事实源（渲染/碰撞共用；此前 284/300/292–336/340 四处字面量）——
export const WALL_SEAM = { face: 284, base: 300, foot: 336, walk: 340 };

// —— 光锚点：静态光源=暗海挖孔=动态光晕，单源（设计稿 §4 光法则）——
export const LIGHTS = {
  window:  { x: 330, y: 160, r: 320, s: 0.95 },   // 月窗 sprite 50x40 @ (305,140) 的中心
  brazier: { x: 520, y: 393, r: 240, s: 0.95 },   // 火盆障碍圆心 (520,395)
  candle:  { x: 702, y: 455, r: 160, s: 0.85 },   // 蜡烛座 (698..706,456..470)
  switch:  { x: 660, y: 285, r: 130, s: 0.62 }
};

// —— 砌石规划（纯函数，种子确定；渲染层照单上色）——
export function masonryPlan(seed, W, faceH) {
  const r = rng(seed), rows = [];
  const ROW_H = 42;
  for (let y = 0, i = 0; y < faceH; y += ROW_H, i++) {
    const blocks = [];
    const x0 = i % 2 ? -30 : 0;
    let x = x0, width = W - x0;
    while (x < x0 + width) {
      let w = 60 + Math.floor(r() * 37);           // 60..96
      if (x + w > x0 + width - 60) w = x0 + width - x;   // 末块收口
      const moisture = x < 300 ? 0.45 : x > 700 ? 0.12 : 0.22;  // 井区湿气重
      blocks.push({
        x, y, w, t: 0.9 + r() * 0.2,
        moss: r() < moisture ? 0.35 + r() * 0.6 : 0,
        crack: r() < 0.14
      });
      x += w;
    }
    rows.push({ x0, y, width, blocks });
  }
  return rows;
}

// —— 地面大石板规划（150..220 宽，错缝大阶）——
export function slabPlan(seed, W, y0, H) {
  const r = rng(seed), rows = [];
  let y = y0, i = 0;
  while (y < y0 + H) {
    const h = 96 + Math.floor(r() * 30);
    const blocks = [];
    const x0 = i % 2 ? -80 : 0;
    let x = x0, width = W - x0;
    while (x < x0 + width) {
      let w = 150 + Math.floor(r() * 71);          // 150..220
      if (x + w > x0 + width - 150) w = x0 + width - x;
      blocks.push({ x, y, w, h: Math.min(h, y0 + H - y), t: 0.92 + r() * 0.16, crack: r() < 0.12 });
      x += w;
    }
    rows.push({ x0, y: Math.min(y, y0 + H), width, blocks });
    y += h; i++;
  }
  return rows;
}
```

- [ ] `resolveCollisions` 的 `clamp(p.y, 340, ...)` 改为 `clamp(p.y, WALL_SEAM.walk, ...)`。
- [ ] 跑测试全绿。Commit: `feat: 墙地带高/光锚点常量与砌石·石板纯规划器`。

### Task 2: prerenderStatic 换血（墙/地/基座/苔藓/矢量门拱/回声物青晕）

**Files:** Modify `public/js/scene.js:137-281`、Check `public/js/sprites.js`（blit/tile 对 null atlases 的行为）

- [ ] 确认 `blit/tile` 在 `atlases=null` 时安全跳过（读 sprites.js；若不跳过，在 prerenderStatic 里 `if (atlases)` 包住家具段）。矢量墙地与门不再依赖图集。
- [ ] 删除：`drawWallTextures`、`floor_brick` tile、`wall_base` tile、`if (!atlases)` 纯色兜底、`door_open` blit、结尾黄昏压色块。
- [ ] 新 painting（放 prerenderStatic 内，替换原墙地段）：

```js
// —— 墙：像素砌石（石匠生成器，seed 23）——
drawMasonry(x, masonryPlan(23, LAYOUT.W, WALL_SEAM.face));
// —— 基座带（石质，替代 wall_base 白踢脚）——
x.fillStyle = '#5d5a52'; x.fillRect(0, WALL_SEAM.face, LAYOUT.W, WALL_SEAM.base - WALL_SEAM.face);
x.fillStyle = '#7b7669'; x.fillRect(0, WALL_SEAM.face, LAYOUT.W, 4);
x.fillStyle = '#3a3833'; x.fillRect(0, WALL_SEAM.base - 4, LAYOUT.W, 4);
// —— 地：大块凿石板（seed 31）——
drawSlabs(x, slabPlan(31, LAYOUT.W, WALL_SEAM.base, LAYOUT.H - WALL_SEAM.base));
```

`drawMasonry`（模块内函数，用现有 `shade()`）：

```js
const BAYER = [[0, 2], [3, 1]];
function drawMasonry(x, rows) {
  x.fillStyle = '#26232b';                                    // 灰浆
  x.fillRect(0, 0, LAYOUT.W, WALL_SEAM.face);
  for (const row of rows) for (const b of row.blocks) {
    const base = '#7b7669', t = b.t;
    x.fillStyle = shade(base, t - 1);          x.fillRect(b.x + 2, b.y + 2, b.w - 4, 40);
    x.fillStyle = shade(base, (t - 1) + 0.16); x.fillRect(b.x + 2, b.y + 2, b.w - 4, 2); x.fillRect(b.x + 2, b.y + 2, 2, 38);
    x.fillStyle = shade(base, (t - 1) - 0.22); x.fillRect(b.x + 2, b.y + 40, b.w - 4, 2); x.fillRect(b.x + b.w - 4, b.y + 4, 2, 38);
    if (b.crack) {                                            // 斜裂一道
      x.strokeStyle = 'rgba(30,28,34,.55)'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(b.x + b.w * 0.3, b.y + 6);
      x.lineTo(b.x + b.w * 0.45, b.y + 18); x.lineTo(b.x + b.w * 0.38, b.y + 34); x.stroke();
    }
    if (b.moss > 0) {                                         // 苔藓：下缘向上拜耳抖动
      const mh = Math.round(4 + b.moss * 10);
      for (let k = 0; k < mh; k += 2) {
        const dens = (b.moss * (1 - k / mh)) * 0.85;
        for (let px = b.x + 3; px < b.x + b.w - 3; px += 2) {
          const th = BAYER[((px / 2) | 0) % 2][((b.y + 40 - k) / 2 | 0) % 2] / 4;
          if (dens * (0.3 + th * 0.9) > 0.45) {
            x.fillStyle = (k < 3 && th > 0.4) ? '#3d5747' : '#4e6b52';
            x.fillRect(px, b.y + 40 - k, 2, 2);
          }
        }
      }
    }
  }
  const wsh = x.createLinearGradient(0, 0, 0, WALL_SEAM.face);   // 顶暗（保留原气氛）
  wsh.addColorStop(0, 'rgba(10,12,20,.42)'); wsh.addColorStop(0.6, 'rgba(10,12,20,0)');
  x.fillStyle = wsh; x.fillRect(0, 0, LAYOUT.W, WALL_SEAM.face);
}
```

`drawSlabs`：

```js
function drawSlabs(x, rows) {
  x.fillStyle = '#211f26';                                    // 板缝
  x.fillRect(0, WALL_SEAM.base, LAYOUT.W, LAYOUT.H - WALL_SEAM.base);
  for (const row of rows) for (const s of row.blocks) {
    const base = '#6b675c', t = s.t;
    x.fillStyle = shade(base, t - 1);     x.fillRect(s.x + 3, s.y + 3, s.w - 6, s.h - 6);
    x.fillStyle = shade(base, (t - 1) + 0.13); x.fillRect(s.x + 3, s.y + 3, s.w - 6, 4);
    x.fillStyle = shade(base, (t - 1) - 0.2);  x.fillRect(s.x + 3, s.y + s.h - 7, s.w - 6, 4);
    if (s.crack) {
      x.strokeStyle = 'rgba(30,28,34,.5)'; x.lineWidth = 3; x.beginPath();
      let cx = s.x + 20 + (s.w - 40) * 0.3, cy = s.y + 12; x.moveTo(cx, cy);
      while (cy < s.y + s.h - 12) { cx += 10 - ((cx * 7) % 20); cy += 14; x.lineTo(cx, cy); }
      x.stroke();
    }
  }
  // 墙脚落地阴影（引用 WALL_SEAM）
  const fsh = x.createLinearGradient(0, WALL_SEAM.face + 8, 0, WALL_SEAM.foot);
  fsh.addColorStop(0, 'rgba(0,0,0,.30)'); fsh.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = fsh; x.fillRect(0, WALL_SEAM.face + 8, LAYOUT.W, WALL_SEAM.foot - WALL_SEAM.face - 8);
}
```

- [ ] 月窗段：光池中心改 `LIGHTS.window.x`（y 352 不变）；其余保留。
- [ ] 回声物青晕（设计稿 §3）：家具 blit 之后加

```js
// 西墙回声物：极淡青苔光晕——「声音在场」的倾听层标记
for (const [hx, hy, hr] of [[66, 340, 30], [104, 346, 26], [148, 362, 22]]) {
  const hg = x.createRadialGradient(hx, hy, 2, hx, hy, hr);
  hg.addColorStop(0, 'rgba(84,224,200,.10)'); hg.addColorStop(1, 'rgba(84,224,200,0)');
  x.fillStyle = hg; x.beginPath(); x.arc(hx, hy, hr, 0, 7); x.fill();
}
```

- [ ] 门拱矢量重画（替换 door_open blit，几何贴合现有门光多边形 1078–1146×176–296 与门扇 1081,174,61×126）：

```js
// —— 北墙右端门洞：矢量石拱（替代 3.4x 非整数放大的 sprite）——
thick(x, 5, PAL.ink);
x.fillStyle = PAL.stone;                                       // 拱身
x.beginPath();
x.moveTo(1064, 300); x.lineTo(1064, 192);
x.quadraticCurveTo(1064, 157, 1096, 157); x.lineTo(1127, 157);
x.quadraticCurveTo(1159, 157, 1159, 192); x.lineTo(1159, 300);
x.closePath(); x.fill(); x.stroke();
x.fillStyle = '#141824';                                       // 门洞内衬（夜色）
x.beginPath();
x.moveTo(1078, 296); x.lineTo(1078, 192);
x.quadraticCurveTo(1078, 176, 1096, 176); x.lineTo(1128, 176);
x.quadraticCurveTo(1146, 176, 1146, 192); x.lineTo(1146, 296);
x.closePath(); x.fill();
x.fillStyle = shade(PAL.stone, 0.12);                          // 拱心石
x.beginPath(); x.moveTo(1100, 157); x.lineTo(1124, 157); x.lineTo(1120, 176); x.lineTo(1104, 176); x.closePath(); x.fill();
thick(x, 3, PAL.ink); x.stroke();
x.fillStyle = shade(PAL.stone, -0.18);                         // 右柱沉影（受光左来）
x.fillRect(1146, 192, 6, 104);
x.fillStyle = 'rgba(0,0,0,.3)';                                // 门前落地影（保留）
x.beginPath(); x.ellipse(1112, 303, 46, 8, 0, 0, 7); x.fill();
```

- [ ] `npm test` 全绿（scene.bg 新测试 + 原有 123 项）。Commit: `feat: 第一关墙地换成像素砌石与大石板，门拱矢量化，回声物青晕`。

### Task 3: 光法则（级色外提 / 挖孔单源 / 透形暗区 / 矢量门扇 / 灯锥）

**Files:** Modify `public/js/scene.js`（makeDarkness/drawScene/drawOverlay）

- [ ] `makeDarkness`：四组挖孔改读 `LIGHTS`；远端加深 `rgba(4,5,10,.55)` → `rgba(6,9,20,.5)`（靛里透蓝）。
- [ ] `drawOverlay` 开头（黑暗潮之前）加全场级色：

```js
// 统一黄昏级色：角色/音素石/火焰与背景同吃一级大气（此前只压静态层）
x.fillStyle = 'rgba(16,18,36,.24)';
x.fillRect(0, 0, LAYOUT.W, LAYOUT.H);
```

- [ ] `drawScene` 剪影组：`const dim = 0.05 + view.lit * 0.95` → `0.14 + view.lit * 0.86`（暗区透形）。
- [ ] 门扇矢量（替换 `blit(door_closed...)`，铰链缩放动画与 ᛟ 符文原样保留）：

```js
// 木门扇：矢量拼板门（替代 3.4x sprite；绕左轴收窄开门不变）
x.fillStyle = '#6e4526';
x.beginPath();
x.moveTo(1081, 300); x.lineTo(1081, 186);
x.quadraticCurveTo(1081, 174, 1093, 174); x.lineTo(1130, 174);
x.quadraticCurveTo(1142, 174, 1142, 186); x.lineTo(1142, 300);
x.closePath(); x.fill(); thick(x, 5, PAL.ink); x.stroke();
x.strokeStyle = '#5a3a1e'; x.lineWidth = 2;                   // 拼板缝
for (let px = 1093; px < 1142; px += 12) { x.beginPath(); x.moveTo(px, 178); x.lineTo(px, 298); x.stroke(); }
x.fillStyle = '#4b4f5a';                                       // 两道铁箍 + 铆钉
x.fillRect(1083, 200, 58, 6); x.fillRect(1083, 258, 58, 6);
x.fillStyle = '#9a958a';
for (const bx of [1090, 1112, 1134]) { x.fillRect(bx, 201, 2.5, 2.5); x.fillRect(bx, 259, 2.5, 2.5); }
```

- [ ] 火光补偿（级色上移后火焰略吃 veil）：火盆 glow `.3→.34`、蜡烛 `.22→.26`、火把 `.28→.32`、吸顶灯 `.4→.46` 与 `.75→.85`。
- [ ] 火焰脚下光斑 + 吸顶灯锥（加在火光们段落）：

```js
x.fillStyle = 'rgba(255,140,60,.16)';                          // 火盆脚下光斑
x.beginPath(); x.ellipse(520, 448, 36, 9, 0, 0, 7); x.fill();
```

```js
if (view.lit > 0.02) {
  x.save(); x.globalAlpha = view.lit;
  const cone = x.createLinearGradient(0, 56, 0, 320);          // 吸顶灯锥形光带
  cone.addColorStop(0, 'rgba(255,224,150,.12)'); cone.addColorStop(1, 'rgba(255,224,150,0)');
  x.fillStyle = cone;
  x.beginPath(); x.moveTo(930, 56); x.lineTo(970, 56); x.lineTo(1016, 320); x.lineTo(884, 320); x.closePath(); x.fill();
  glow(x, 950, 58, 340, 'rgba(255,224,150,ALPHA)', 0.46);
  glow(x, 950, 54, 62, 'rgba(255,240,200,ALPHA)', 0.85);
  x.restore();
}
```

- [ ] `npm test` 全绿。Commit: `feat: 光法则统一——级色外提·挖孔单源·透形暗区·矢量门扇·灯锥`。

### Task 4: 视觉验收 + 回归

- [ ] `npm test`（125+ 项全绿）。
- [ ] 截图三状态：`?autostart=1`（暗房）、`?autostart=1&beat=light`（光潮后）、`?autostart=1&beat=door-open`（开门），与 `.claude/shots/ch1-room.png` 旧图对比：右区剪影可辨、无纯黑死区、音素石/青光对比度不降、门像素干净。
- [ ] 发现问题就地修，修完复截。
- [ ] Commit（如无改动则跳过）。

## Self-Review

- Spec 覆盖：§1墙(T2) §2地(T2) §3苔藓+青晕(T1/T2) §4光法则(T2/T3) §5暗区(T3) §6门(T2/T3) 测试(T1/T4) 验收(T4) ✓
- 占位符：无 TBD；所有代码块完整可粘。
- 命名一致：WALL_SEAM/LIGHTS/masonryPlan/slabPlan/drawMasonry/drawSlabs 前后一致 ✓
- 风险：blit(null-atlases) 行为需在 T2 第一步核实；Sprites webp 停用后 ch2/3 不受影响（未动 sideview.drawMossyWall）。
