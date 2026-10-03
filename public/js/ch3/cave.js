// —— 析声者 · 第三关洞穴岩面规划器（纯函数，Node 可测）——
// 只产出数据、不做任何绘制：抖动网格顶点 + 逐面属性，供渲染层消费。

// —— 确定性随机（同 ch1 的 LCG 常量，自带一份避免 ch3 → ch1 反向耦合）——
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

const CAVE_DEFAULTS = { cols: 7, rows: 5, jitter: 0.18, wetRange: [0.15, 0.15], crackRate: 0.16 };

// —— 岩面规划 ——
// 顶点：(cols+1)×(rows+1) 规则网格，内部顶点双向抖动；边界顶点只沿切线抖动，故不越出 [0,W]×[0,H]。
// 面：四角直接引用 verts 里的数组对象，相邻面因此严丝合缝（构造保证共享顶点）。
export function cavePlan(seed, W, H, opts = {}) {
  const { cols, rows, jitter, wetRange, crackRate } = { ...CAVE_DEFAULTS, ...opts };
  if (W <= 0 || H <= 0) return { cols, rows, verts: [], faces: [] };

  const rand = rng(seed);
  const stepX = W / cols, stepY = H / rows;
  const amp = jitter * Math.min(stepX, stepY);

  const verts = [];
  for (let r = 0; r <= rows; r++) {
    for (let c = 0; c <= cols; c++) {
      let x = c * stepX, y = r * stepY;
      if (c > 0 && c < cols) x += (rand() * 2 - 1) * amp; // 左右边界：仅切线（竖直）抖动
      if (r > 0 && r < rows) y += (rand() * 2 - 1) * amp; // 上下边界：仅切线（水平）抖动
      verts.push([x, y]);
    }
  }
  const v = (r, c) => verts[r * (cols + 1) + c];

  const faces = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const pts = [v(r, c), v(r, c + 1), v(r + 1, c + 1), v(r + 1, c)];
      const t = 0.9 + rand() * 0.2;
      const speck = Math.floor(rand() * 6);
      const cx = (pts[0][0] + pts[1][0] + pts[2][0] + pts[3][0]) / 4;
      const wet = clamp(wetRange[0] + (wetRange[1] - wetRange[0]) * (cx / W) + rand() * 0.15, 0, 1);
      const crack = rand() < crackRate;
      faces.push({ c, r, pts, t, wet, crack, speck });
    }
  }

  return { cols, rows, verts, faces };
}
