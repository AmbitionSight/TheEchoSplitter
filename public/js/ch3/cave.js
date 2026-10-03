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

// —— 三间房的岩面种子（各不相同，岸边本轮先用）——
export const CAVE_SEEDS = { bank: 41, crevice: 47, deep: 53 };

// —— 洞穴色板：比第一关的暖灰石（#7b7669 / #6b675c）更冷更湿，但明度不更低 ——
// 本轮不建光源系统，岩壁全靠自身明度差与受光/沉影边立起来，所以基色不能压太暗。
export const CAVE_PAL = {
  rockA: '#5c636e',     // 岩面基色（冷灰蓝）
  rockB: '#4e5560',     // 岩面次级（背光面）
  rockDark: '#2b3038',  // 岩缝 / 洞底
  floor: '#565d68',     // 岩床
  moss: '#3f5c48',      // 苔藓（去饱和绿，不碰青）
  mossHi: '#4e6b52',    // 苔藓受光尖
  damp: '#2f3a42'       // 顺壁湿痕
};

// —— 洞顶钟乳石规划：按 x 均分 count 段，段内抖动中心；y 即 topY（洞顶线）——
// 抖动后 clamp 回 [0,W]，否则首尾会出画。
export function stalactitePlan(seed, W, topY, count) {
  if (count <= 0) return [];
  const rand = rng(seed);
  const seg = W / count;
  const out = [];
  for (let i = 0; i < count; i++) {
    const jitter = (rand() * 2 - 1) * seg * 0.3;
    out.push({
      x: clamp((i + 0.5) * seg + jitter, 0, W),
      y: topY,
      w: 8 + rand() * 22,
      h: 40 + rand() * 120,
      lean: (rand() - 0.5) * 2
    });
  }
  return out;
}
