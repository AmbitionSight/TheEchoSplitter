// —— 精灵表（LimeZu Modern Interiors Free v2.2，见 assets/mi/CREDIT.txt）——
// 纯数据 + 绘制助手；顶层不碰 DOM（Node 可导入测试）。加载图集只在 loadAtlases 函数内做。
export const ATLASES = {
  mi: { src: 'assets/mi/interiors32.png', w: 512, h: 2848 },    // 室内家具/窗/门/地毯
  rb: { src: 'assets/mi/roombuilder32.png', w: 544, h: 736 },   // 墙/地板（房间构建器）
  ch: { src: 'assets/mi/chars.png', w: 576, h: 768 },           // 角色（RPGMAKERMV 版，48x96 格）
  props: { src: 'assets/props/props.webp', w: 400, h: 400 },     // 外部道具素材（黑底，第一排为门）
  rpB:   { src: 'assets/props/rope-broken.webp', w: 887, h: 1774, key: 'black' },  // 断绳（黑底需抠黑）
  furn:  { src: 'assets/props/furniture.png', w: 768, h: 768 },  // 家具素材表（自带透明通道）
  winC:  { src: 'assets/props/window-closed.png', w: 144, h: 192, key: 'white' },  // 关着的拱形窗（灰底抠图）
  winO:  { src: 'assets/props/window-open.png', w: 124, h: 166, key: 'white' },    // 推开的双页窗
  fb:    { src: 'assets/floor/brick.webp', w: 762, h: 784 },     // 第一关地砖（4x 像素砖石纹理，0.25x 平铺）
  wallClean: { src: 'assets/wall/clean.webp', w: 1104, h: 1128 },
  wallMoss: { src: 'assets/wall/moss.webp', w: 814, h: 818 },
  wallHalfMoss: { src: 'assets/wall/half-moss.webp', w: 1128, h: 1142 },
};

// 像素矩形（源图像素）。命名后缀 _sm/_big 等表示同一物件的不同尺寸。
export const SPR = {
  // —— 室内（mi）——
  rug:        { a: 'mi', x: 228, y: 488,  w: 120, h: 80  },   // 红金边大地毯
  window:     { a: 'mi', x: 294, y: 782,  w: 50,  h: 40  },   // 木框双格窗（玻璃区 2 格）
  door:       { a: 'mi', x: 228, y: 1544, w: 54,  h: 78  },   // 木门（可开合，第二/三章用）
  door_open:  { a: 'props', x: 66,  y: 21, w: 28, h: 42 },   // 石拱门框+敞开门洞（开门态）
  door_closed:{ a: 'props', x: 167, y: 26, w: 18, h: 37 },   // 拱顶木门（关门态，与门洞同宽配套）
  rope_broken:{ a: 'rpB',   x: 387, y: 0,   w: 113, h: 1722 }, // 断裂绳索（末端散开，第三关）
  rope_fixed: { a: 'furn',  x: 352, y: 0,   w: 16,  h: 120 },  // 完整绳索带绳结（修复后，第三关）
  window_closed:{ a: 'winO', x: 12, y: 10, w: 105, h: 146 },   // 关着的双页木窗（塔顶出口）
  window_open:  { a: 'winC', x: 26, y: 28, w: 105, h: 146 },   // 推开后的拱形亮窗
  table:      { a: 'mi', x: 26,  y: 322,  w: 76,  h: 74  },   // 木桌（合成台/工作台）
  plant:      { a: 'mi', x: 386, y: 1444, w: 28,  h: 46  },   // 盆栽（枯苗陶盆，盆在底部）
  pot:        { a: 'mi', x: 390, y: 1470, w: 20,  h: 20  },   // 盆栽的陶盆部分（枯苗用）
  painting:   { a: 'mi', x: 326, y: 902,  w: 52,  h: 56  },   // 橄榄色挂画（挂毯位）
  shelf:      { a: 'mi', x: 320, y: 2188, w: 64,  h: 68  },   // 书架单格
  frame_sm:   { a: 'mi', x: 12,  y: 660,  w: 42,  h: 28  },   // 小挂画
  cactus:     { a: 'mi', x: 4,   y: 1580, w: 24,  h: 28  },   // 小盆栽（仙人掌）
  crate_big:  { a: 'mi', x: 258, y: 1926, w: 52,  h: 46  },   // 大木箱（第二关货堆）
  crate_sm:   { a: 'mi', x: 291, y: 1865, w: 32,  h: 45  },   // 小木箱（第二关货堆）
  jars2:      { a: 'mi', x: 3,   y: 2198, w: 60,  h: 34  },   // 陶罐组（第二关陈设）
  tree:       { a: 'mi', x: 333, y: 1424, w: 39,  h: 63  },   // 盆栽树（第二关陈设）
  // —— 房间构建器（rb）——
  wall_face:  { a: 'rb', x: 32,  y: 556,  w: 32,  h: 48  },   // 灰蓝墙面（可平铺）
  wall_base:  { a: 'rb', x: 0,   y: 604,  w: 96,  h: 16  },   // 白踢脚线（深色描边）
  floor:      { a: 'rb', x: 384, y: 384,  w: 32,  h: 32  },   // 灰石地板（可平铺，第二/三章用）
  floor_brick:{ a: 'fb', x: 0,   y: 0,    w: 762, h: 784 },   // 第一关砖石地砖（整图无缝平铺）
};

// —— 角色（ch）：每角色块 3 帧 x 4 向，格 48x96，脚底在格底 ——
export const CHAR_BLOCK = { kid: 144, uncle: 0 };   // Alex / Bob
export const CHAR_DIR = { down: 0, left: 1, right: 2, up: 3 };

export function charRect(who, dir, frame) {
  const bx = CHAR_BLOCK[who] ?? 0;
  return { a: 'ch', x: bx + (frame % 3) * 48, y: (CHAR_DIR[dir] ?? 0) * 96, w: 48, h: 96 };
}

// —— 浏览器加载（仅此处碰 Image/document）——
// 纯色底素材转 alpha：mode 'black' 抠近纯黑，'white' 抠底色灰白(247±3，比玻璃亮部更准)
function keyOut(img, mode) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height);
  const px = d.data;
  for (let i = 0; i < px.length; i += 4) {
    if (mode === 'black') {
      if (px[i] < 26 && px[i + 1] < 26 && px[i + 2] < 26) px[i + 3] = 0;
    } else if (Math.abs(px[i] - 247) <= 3 && Math.abs(px[i + 1] - 247) <= 3 && Math.abs(px[i + 2] - 247) <= 3) {
      px[i + 3] = 0;
    }
  }
  x.putImageData(d, 0, 0);
  return c;
}

export function loadAtlases() {
  const names = Object.keys(ATLASES);
  return Promise.all(names.map(n => new Promise((res, rej) => {
    const img = new Image();
    const key = ATLASES[n].key;
    img.onload = () => res([n, key ? keyOut(img, key) : img]);
    img.onerror = () => rej(new Error('atlas ' + n));
    img.src = ATLASES[n].src;
  }))).then(entries => Object.fromEntries(entries));
}

// —— 绘制：把命名精灵画到 (dx,dy)。默认 1:1 原生像素（与角色/碰撞尺度一致）——
// opts: { scale=2, flip, alpha, w, h（目标宽高，覆盖默认）, ax, ay（0..1 锚点，默认左上） }
export function blit(ctx, imgs, name, dx, dy, opts = {}) {
  const s = typeof name === 'string' ? SPR[name] : name;
  if (!s) return;
  const img = imgs?.[s.a];
  if (!img) return;
  const k = opts.scale ?? 1;
  const w = opts.w ?? s.w * k, h = opts.h ?? s.h * k;
  const ax = (opts.ax ?? 0) * w, ay = (opts.ay ?? 0) * h;
  ctx.save();
  if (opts.alpha != null) ctx.globalAlpha *= opts.alpha;
  if (opts.flip) {
    ctx.translate(dx, dy); ctx.scale(-1, 1);
    ctx.drawImage(img, s.x, s.y, s.w, s.h, ax - w, -ay, w, h);
  } else {
    ctx.drawImage(img, s.x, s.y, s.w, s.h, dx - ax, dy - ay, w, h);
  }
  ctx.restore();
}

// 平铺命名精灵铺满矩形区域（用于墙/地板），以 (x,y) 为格原点、步进 w*k
export function tile(ctx, imgs, name, x, y, w, h, k = 1) {
  const s = typeof name === 'string' ? SPR[name] : name;
  if (!s) return;
  const img = imgs?.[s.a];
  if (!img) return;
  const tw = s.w * k, th = s.h * k;
  for (let yy = y; yy < y + h; yy += th) {
    for (let xx = x; xx < x + w; xx += tw) {
      const dw = Math.min(tw, x + w - xx), dh = Math.min(th, y + h - yy);
      // 边缘块等比裁源（否则最后一列/行会被压扁）
      ctx.drawImage(img, s.x, s.y, s.w * dw / tw, s.h * dh / th, xx, yy, dw, dh);
    }
  }
}

// 角色：who(kid/uncle)、dir、frame(0..2)、脚底位置 (x,y)
export function drawChar(ctx, imgs, who, dir, frame, x, y, opts = {}) {
  const k = opts.scale ?? 1;
  const r = charRect(who, dir, frame);
  const img = imgs?.[r.a];
  if (!img) return;
  ctx.save();
  if (opts.alpha != null) ctx.globalAlpha *= opts.alpha;
  const w = r.w * k, h = r.h * k;
  // 格内内容底边在 y=95（48x96 格），脚底对齐到 (x,y)
  const dy = y - 95 * k;
  if (opts.flip) {
    ctx.translate(x, dy); ctx.scale(-1, 1);
    ctx.drawImage(img, r.x, r.y, r.w, r.h, -w / 2, 0, w, h);
  } else {
    ctx.drawImage(img, r.x, r.y, r.w, r.h, x - w / 2, dy, w, h);
  }
  ctx.restore();
}
