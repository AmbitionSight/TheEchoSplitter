// —— 调色板（规格 §9A：黄昏暖光 + 厚描边；§9B：iOS UI 色）——
export const PAL = {
  ink: '#20242f',
  floorA: '#8a8078', floorB: '#7c736b', floorLine: '#5d574f', crack: '#4a453f',
  wallA: '#6e6a75', wallB: '#605c66', wallDark: '#4b4852',
  rug: '#a34632', rugDark: '#7e3524', rugGold: '#d9a441',
  wood: '#8a5a33', wood2: '#6e4526', wood3: '#a5713f',
  stone: '#9aa0a8', stoneD: '#6b7078',
  fire1: '#ffb347', fire2: '#ff7733', fireCore: '#ffe9a8',
  water: '#4fa3d1', waterD: '#2f6f96', leaf: '#5e9c4f', leafD: '#43703a', petal: '#f2a5c0',
  hat: '#d9b45a', hatD: '#a8853a',
  lampGlow: '#ffd27a', glowRune: '#54e0c8', gold: '#ffd36b',
  vowel: '#ffd166', cons: '#6fb7ff',
  night: '#232a45', moon: '#f4f0d8',
  uiBlue: '#0A84FF'
};

// —— 48 卢文折线（0..1 归一，y 向下；风格化矢量，卡片同时标注 IPA 以区分相近字形）——
export const RUNE_STROKES = {
  'ᛃ': [[0,0,0,1],[0,.5,.5,.72]],                       'ᛂ': [[0,0,0,1],[0,.25,.45,.5]],
  'ᛖ': [[0,0,0,1],[0,.12,.5,.27],[0,.38,.5,.53],[0,.64,.5,.79]],
  'ᚫ': [[0,0,0,1],[0,.15,.5,.35],[0,.45,.5,.65]],       'ᚨ': [[0,0,0,1],[0,.15,.5,.4],[0,.5,.5,.75]],
  'ᚬ': [[0,0,0,1],[.45,.28,.2,.42],[.2,.42,.45,.56],[.45,.56,.45,.28]],
  'ᚢ': [[0,0,0,1],[0,0,.45,.45],[.45,.45,.3,1]],
  'ᚭ': [[0,.25,0,1],[0,.25,.4,.45],[.4,.45,0,.65]],
  'ᛇ': [[0,0,.35,.2],[.35,.2,.7,.5],[.7,.5,.35,.8],[.35,.8,0,1]],
  'ᛜ': [[.15,.2,.5,.85],[.5,.85,.85,.2]],
  'ᚪ': [[0,0,0,1],[0,.2,.5,.05],[0,.5,.5,.35]],
  'ᛠ': [[0,0,0,1],[0,.2,.4,.35],[.4,.35,.4,.65],[.4,.65,0,.8]],
  'ᛄ': [[0,.15,0,1],[0,.15,.5,.15],[.5,.15,.5,.6],[.5,.6,.2,1]],
  'ᛁ': [[0,0,0,1]],
  'ᛤ': [[0,0,0,1],[.3,.35,.55,.5],[.55,.5,.3,.65],[.3,.65,.3,.35]],
  'ᚩ': [[0,0,0,1],[0,.25,.5,.1]],
  'ᛥ': [[0,0,0,1],[0,.3,.5,.15],[0,.3,.5,.6]],
  'ᛡ': [[0,.15,.5,.4],[.5,.4,0,.65],[0,.65,.5,.9]],
  'ᛧ': [[0,0,0,1],[0,.35,.5,.2],[0,.6,.5,.45]],
  'ᛨ': [[0,0,0,1],[0,.25,.5,.4],[.5,.4,.5,.75],[.5,.75,.25,1]],
  'ᛈ': [[0,0,0,1],[0,.3,.5,.15],[.5,.15,0,.45]],
  'ᛒ': [[0,0,0,1],[0,.3,.5,.15],[.5,.15,.5,.5],[.5,.5,0,.65]],
  'ᛏ': [[.5,0,.5,1],[.5,.25,.1,.05],[.5,.25,.9,.05]],
  'ᛞ': [[0,0,0,1],[0,.3,.5,.45],[.5,.45,.2,.65]],
  'ᚳ': [[0,0,0,1],[0,.35,.55,.2],[0,.35,.55,.55]],
  'ᚷ': [[0,0,0,1],[0,.2,.5,.05],[0,.5,.5,.35],[0,.2,.5,.35]],
  'ᚠ': [[0,0,0,1],[0,.1,.5,.25],[0,.45,.5,.6]],
  'ᚡ': [[0,0,0,1],[0,.2,.5,.45],[0,.5,.5,.75]],
  'ᚦ': [[0,0,0,1],[0,.3,.5,.2],[.5,.2,.3,.45],[.3,.45,0,.55]],
  'ᚧ': [[0,0,0,1],[0,.3,.5,.2],[.5,.2,.5,.5],[.5,.5,0,.65],[.3,.5,.3,1]],
  'ᛌ': [[0,.1,.45,.35],[.45,.35,0,.6],[0,.6,.45,.85]],
  'ᛋ': [[.15,.05,.85,.5],[.85,.5,.15,.95]],
  'ᛢ': [[0,0,0,1],[0,.25,.5,.5],[.5,.5,0,.75]],
  'ᛣ': [[0,0,0,1],[0,.4,.5,.25],[0,.4,.5,.55]],
  'ᚲ': [[.5,0,.5,1],[.5,.3,.15,.15],[.5,.3,.15,.5]],
  'ᚵ': [[.5,0,.5,1],[.5,.3,.15,.15],[.15,.15,.15,.55]],
  'ᚶ': [[0,0,0,1],[0,.5,.5,.35],[0,.5,.5,.65],[.5,.35,.5,.65]],
  'ᚸ': [[0,0,0,1],[0,.5,.5,.35],[0,.5,.5,.65],[.25,.5,.25,1]],
  'ᚺ': [[0,0,0,1],[0,.35,.35,.2],[.35,.2,.35,.6]],
  'ᚼ': [[0,0,0,1],[0,.3,.5,.5],[.5,.5,0,.7],[0,.7,.5,.9]],
  'ᛗ': [[0,0,0,1],[.5,0,.5,1],[0,.25,.5,.5],[.5,.5,0,.75]],
  'ᚾ': [[0,0,0,1],[0,.3,.5,.6]],
  'ᛝ': [[.15,.1,.85,.5],[.85,.5,.15,.9],[.15,.9,.15,.1]],
  'ᚻ': [[0,0,0,1],[0,.2,.5,.3],[0,.4,.5,.5],[0,.6,.5,.7],[0,.8,.5,.9]],
  'ᛚ': [[0,0,0,1],[0,.25,.5,.1],[0,.55,.3,.45],[.3,.45,.3,.75]],
  'ᚱ': [[0,0,0,1],[0,.2,.45,.15],[.45,.15,.45,.4],[.45,.4,0,.45]],
  'ᛅ': [[0,0,0,1],[0,.5,.45,.3]],
  'ᚹ': [[0,0,0,1],[0,.3,.45,.2],[.45,.2,.45,.45],[.45,.45,0,.6]],
  'ᛟ': [[.5,0,.85,.5],[.85,.5,.5,1],[.5,1,.15,.5],[.15,.5,.5,0]], // ᛟ 门之符文（规格 §6.1，非音素）
};

export function drawRune(ctx, glyph, cx, cy, size, color = PAL.glowRune, lw = null) {
  const segs = RUNE_STROKES[glyph];
  if (!segs) return;
  const w = size, h = size * 1.15;
  ctx.save();
  ctx.translate(cx - w / 2, cy - h / 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw ?? Math.max(2.5, size * 0.13);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const [x1, y1, x2, y2] of segs) { ctx.moveTo(x1 * w, y1 * h); ctx.lineTo(x2 * w, y2 * h); }
  ctx.stroke();
  ctx.restore();
}

// —— 手绘图标库（厚描边 Q 版，规格 §9C，禁 emoji）——
export const ICON_TYPES = ['hello', 'water', 'fire', 'hat', 'light', 'open', 'switch', 'gem'];

function ink(ctx, s) { ctx.lineWidth = Math.max(3, s * 0.09); ctx.strokeStyle = PAL.ink; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }

const ICON_DRAW = {
  hello(ctx, cx, cy, s) { // 气泡 + 三点
    ink(ctx, s);
    ctx.fillStyle = '#f7f4ea';
    ctx.beginPath();
    const w = s * 0.95, h = s * 0.7, x = cx - w / 2, y = cy - h / 2 - s * 0.05, r = s * 0.18;
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.12, y + h); ctx.lineTo(cx - s * 0.02, y + h + s * 0.22); ctx.lineTo(cx + s * 0.14, y + h);
    ctx.closePath(); ctx.fillStyle = '#f7f4ea'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.ink;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(cx + i * s * 0.2, y + h * 0.5, s * 0.055, 0, 7); ctx.fill(); }
  },
  water(ctx, cx, cy, s) { // 水滴
    ink(ctx, s);
    ctx.fillStyle = PAL.water;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.48);
    ctx.bezierCurveTo(cx + s * 0.42, cy + s * 0.02, cx + s * 0.3, cy + s * 0.44, cx, cy + s * 0.44);
    ctx.bezierCurveTo(cx - s * 0.3, cy + s * 0.44, cx - s * 0.42, cy + s * 0.02, cx, cy - s * 0.48);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath(); ctx.ellipse(cx - s * 0.12, cy + s * 0.12, s * 0.07, s * 0.12, -0.5, 0, 7); ctx.fill();
  },
  fire(ctx, cx, cy, s) { // 火焰 + 内焰
    ink(ctx, s);
    ctx.fillStyle = PAL.fire2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.5);
    ctx.bezierCurveTo(cx + s * 0.4, cy - s * 0.1, cx + s * 0.34, cy + s * 0.28, cx, cy + s * 0.46);
    ctx.bezierCurveTo(cx - s * 0.34, cy + s * 0.28, cx - s * 0.4, cy - s * 0.1, cx, cy - s * 0.5);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.fireCore;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.05);
    ctx.bezierCurveTo(cx + s * 0.18, cy + s * 0.18, cx + s * 0.14, cy + s * 0.34, cx, cy + s * 0.42);
    ctx.bezierCurveTo(cx - s * 0.14, cy + s * 0.34, cx - s * 0.18, cy + s * 0.18, cx, cy - s * 0.05);
    ctx.closePath(); ctx.fill();
  },
  hat(ctx, cx, cy, s) { // 草帽：帽顶 + 帽檐 + 帽带
    ink(ctx, s);
    ctx.fillStyle = PAL.hat;
    ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.1, s * 0.48, s * 0.16, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.3, cy + s * 0.08);
    ctx.quadraticCurveTo(cx, cy - s * 0.62, cx + s * 0.3, cy + s * 0.08);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.hatD;
    ctx.fillRect(cx - s * 0.3, cy - s * 0.02, s * 0.6, s * 0.1);
  },
  light(ctx, cx, cy, s) { // 提灯：吊环 + 笼身 + 火苗 + 光晕
    ink(ctx, s);
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, s * 0.6);
    g.addColorStop(0, 'rgba(255,210,122,.5)'); g.addColorStop(1, 'rgba(255,210,122,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, s * 0.6, 0, 7); ctx.fill();
    ctx.fillStyle = PAL.wood;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.26, cy - s * 0.3); ctx.lineTo(cx + s * 0.26, cy - s * 0.3);
    ctx.lineTo(cx + s * 0.2, cy + s * 0.34); ctx.lineTo(cx - s * 0.2, cy + s * 0.34);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = PAL.ink; ctx.beginPath(); ctx.arc(cx, cy - s * 0.42, s * 0.1, 0, 7); ctx.stroke();
    ctx.fillStyle = PAL.fireCore;
    ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.02, s * 0.09, s * 0.16, 0, 0, 7); ctx.fill();
  },
  open(ctx, cx, cy, s) { // 拱门：石拱 + 敞开的通道
    ink(ctx, s);
    ctx.fillStyle = PAL.stone;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.4, cy + s * 0.48); ctx.lineTo(cx - s * 0.4, cy - s * 0.05);
    ctx.arc(cx, cy - s * 0.05, s * 0.4, Math.PI, 0);
    ctx.lineTo(cx + s * 0.4, cy + s * 0.48); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.night;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.2, cy + s * 0.48); ctx.lineTo(cx - s * 0.2, cy + s * 0.05);
    ctx.arc(cx, cy + s * 0.05, s * 0.2, Math.PI, 0);
    ctx.lineTo(cx + s * 0.2, cy + s * 0.48); ctx.closePath(); ctx.fill();
  },
  switch(ctx, cx, cy, s) { // 开关象形（v2 open 词具）：面板 + 扳把 + 通电纹
    ink(ctx, s);
    ctx.fillStyle = '#d8d3c6';
    ctx.beginPath();
    const w = s * 0.6, h = s * 0.82, x0 = cx - w / 2, y0 = cy - h / 2, r = s * 0.12;
    ctx.moveTo(x0 + r, y0); ctx.arcTo(x0 + w, y0, x0 + w, y0 + h, r); ctx.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
    ctx.arcTo(x0, y0 + h, x0, y0, r); ctx.arcTo(x0, y0, x0 + w, y0, r); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#7bd88f';
    ctx.save();
    ctx.translate(cx, cy + s * 0.08);
    ctx.rotate(-0.5);
    ctx.fillRect(-s * 0.09, -s * 0.2, s * 0.18, s * 0.34);
    ctx.strokeRect(-s * 0.09, -s * 0.2, s * 0.18, s * 0.34);
    ctx.restore();
    ctx.strokeStyle = PAL.glowRune; ctx.lineWidth = Math.max(2, s * 0.05);
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.16, cy - s * 0.3); ctx.lineTo(cx - s * 0.02, cy - s * 0.22);
    ctx.lineTo(cx - s * 0.1, cy - s * 0.12); ctx.lineTo(cx + s * 0.06, cy - s * 0.04);
    ctx.stroke();
  },
  gem(ctx, cx, cy, s) { // 菱形宝石（声音石袋）
    ink(ctx, s);
    ctx.fillStyle = PAL.cons;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.44); ctx.lineTo(cx + s * 0.4, cy); ctx.lineTo(cx, cy + s * 0.44); ctx.lineTo(cx - s * 0.4, cy);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.beginPath(); ctx.moveTo(cx - s * 0.18, cy - s * 0.16); ctx.lineTo(cx + s * 0.18, cy + s * 0.2); ctx.stroke();
  }
};

export function drawIcon(ctx, type, cx, cy, size) {
  ctx.save();
  (ICON_DRAW[type] || ICON_DRAW.gem)(ctx, cx, cy, size);
  ctx.restore();
}

// —— dataURL（DOM 用；仅函数内触碰 document）——
const urlCache = new Map();
export function iconURL(type) {
  if (urlCache.has(type)) return urlCache.get(type);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  drawIcon(ctx, type, 64, 64, 108);
  const url = c.toDataURL();
  urlCache.set(type, url);
  return url;
}
