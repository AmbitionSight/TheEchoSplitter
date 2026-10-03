// —— 布局（规格 §6.1）——
export const LAYOUT = {
  W: 1280, H: 720, WALL_BOTTOM: 300,
  // 三幕剧（DESIGN.md）：一幕「听」=左（出生左下角，大叔在月窗光下，声音花园沿西北墙）
  // → 二幕「做」=中（合成台居中留工作坪，墙上开关在其身后）→ 三幕「得」=右（暗区帽架与门）
  playerStart: { x: 140, y: 650 },
  obstacles: [
    { id: 'well', x: 170, y: 450, r: 46 },
    { id: 'brazier', x: 520, y: 395, r: 40 },
    { id: 'bench', x: 640, y: 494, r: 34 },
    { id: 'hatstand', x: 980, y: 520, r: 34 },
    { id: 'npc', x: 310, y: 490, r: 38 },
    { id: 'sprout', x: 260, y: 610, r: 28 },
    { id: 'cat', x: 450, y: 435, r: 24 },
    { id: 'shelf', x: 66, y: 330, r: 26 },      // 西墙软装（回声物）
    { id: 'plant', x: 104, y: 338, r: 20 },
    { id: 'cactus', x: 148, y: 352, r: 16 }
  ],
  // 注意：目标 r 必须大于障碍 r+20（玩家半径16+余量），否则碰撞把玩家推出判定圈、E 键永远够不到（scene.test 锁此不变式）
  targets: {
    npc: { x: 310, y: 490, r: 70 }, well: { x: 170, y: 450, r: 72 },
    brazier: { x: 520, y: 395, r: 68 }, sprout: { x: 260, y: 610, r: 56 },
    cat: { x: 450, y: 435, r: 58 }, hatstand: { x: 980, y: 520, r: 66 },
    switch: { x: 660, y: 282, r: 120 }, bench: { x: 640, y: 490, r: 85 },
    door: { x: 1112, y: 245, r: 105 },
    shelf: { x: 66, y: 340, r: 60 }, plant: { x: 104, y: 346, r: 50 }, cactus: { x: 148, y: 362, r: 46 }
  },
  INTERACT_R: 170, MAGNET_R: 46
};

// —— 确定性随机（裂缝/星星布局用，测试可复现）——
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

// —— 墙地带高唯一事实源（渲染/碰撞共用；此前 284/300/292–336/340 四处字面量）——
export const WALL_SEAM = { face: 284, base: 300, foot: 336, walk: 340 };

// —— 光锚点：静态光源=暗海挖孔=动态光晕，单源（设计稿 §4 光法则）——
export const LIGHTS = {
  window:  { x: 330, y: 160, r: 320, s: 0.95 },   // 月窗 sprite 50x40 @ (305,140) 的中心
  brazier: { x: 520, y: 393, r: 240, s: 0.95 },   // 火盆障碍圆心 (520,395)
  candle:  { x: 702, y: 455, r: 160, s: 0.85 },   // 蜡烛座 (698..706,456..470)
  switch:  { x: 660, y: 285, r: 130, s: 0.62 }
};

// —— 砌石规划（纯函数，种子确定；渲染层照单上色，设计稿 §1）——
export function masonryPlan(seed, W, faceH) {
  const r = rng(seed), rows = [];
  const ROW_H = 42;
  for (let y = 0, i = 0; y < faceH; y += ROW_H, i++) {
    const blocks = [];
    const x0 = i % 2 ? -30 : 0;                    // 错缝：奇数行左移半块
    let x = x0;
    while (x < W) {
      const rem = W - x;
      let w = 60 + Math.floor(r() * 37);           // 60..96
      if (rem - w < 60) w = rem;                   // 剩余不足一块时整段收口
      const moisture = x < 300 ? 0.45 : x > 700 ? 0.12 : 0.22;  // 井区湿气重，苔盛
      blocks.push({
        x, y, w, t: 0.9 + r() * 0.2,
        moss: r() < moisture ? 0.35 + r() * 0.6 : 0,
        crack: r() < 0.14
      });
      x += w;
    }
    rows.push({ x0, y, width: W - x0, blocks });
  }
  return rows;
}

// —— 地面大石板规划（150..220 宽，错缝大阶，设计稿 §2）——
export function slabPlan(seed, W, y0, H) {
  const r = rng(seed), rows = [];
  let y = y0, i = 0;
  while (y < y0 + H) {
    const h = 96 + Math.floor(r() * 30);
    const blocks = [];
    const x0 = i % 2 ? -80 : 0;
    let x = x0;
    while (x < W) {
      const rem = W - x;
      let w = 150 + Math.floor(r() * 71);          // 150..220
      if (rem - w < 150) w = rem;
      blocks.push({ x, y, w, h: Math.min(h, y0 + H - y), t: 0.92 + r() * 0.16, crack: r() < 0.12 });
      x += w;
    }
    rows.push({ x0, y, width: W - x0, blocks });
    y += h; i++;
  }
  return rows;
}
