// —— 石匠像素材质（共享）：程序生成砌石 / 大石板的上色 ——
// 与第一关同一像素语言：逐块明度差 ±10%、上/左受光边、下/右沉影边、拜耳抖动苔藓。
// 第一关（ch1/render.js）与后续章节共用，勿在此引入任何章节几何。
export const BAYER = [[0, 2], [3, 1]];

// 十六进制色明度微调（每砖扰动用）
export function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const cl = v => Math.max(0, Math.min(255, Math.round(v)));
  const r0 = cl(((n >> 16) & 255) * (1 + f)), g0 = cl(((n >> 8) & 255) * (1 + f)), b0 = cl((n & 255) * (1 + f));
  return `rgb(${r0},${g0},${b0})`;
}

// 像素砌石上色：rows 来自 masonryPlan(seed, W, faceH)；块高 42，顶部渐暗保留原气氛
export function paintMasonry(x, rows, W, faceH) {
  x.fillStyle = '#26232b';                                    // 灰浆底
  x.fillRect(0, 0, W, faceH);
  for (const row of rows) for (const b of row.blocks) {
    const base = '#7b7669';
    x.fillStyle = shade(base, b.t - 1);          x.fillRect(b.x + 2, b.y + 2, b.w - 4, 38);
    x.fillStyle = shade(base, b.t - 1 + 0.16);   x.fillRect(b.x + 2, b.y + 2, b.w - 4, 2); x.fillRect(b.x + 2, b.y + 2, 2, 36);   // 上/左受光
    x.fillStyle = shade(base, b.t - 1 - 0.22);   x.fillRect(b.x + 2, b.y + 38, b.w - 4, 2); x.fillRect(b.x + b.w - 4, b.y + 4, 2, 36); // 下/右沉影
    if (b.crack) {                                             // 斜裂一道
      x.strokeStyle = 'rgba(30,28,34,.55)'; x.lineWidth = 2; x.lineCap = 'round';
      x.beginPath();
      x.moveTo(b.x + b.w * 0.3, b.y + 6);
      x.lineTo(b.x + b.w * 0.45, b.y + 18);
      x.lineTo(b.x + b.w * 0.38, b.y + 34);
      x.stroke();
    }
    if (b.moss > 0) {                                          // 苔藓：下缘向上抖动生长
      const mh = Math.round(8 + b.moss * 14);
      for (let k = 0; k < mh; k += 2) {
        const dens = b.moss * (1 - k / mh) * 0.95;
        for (let px = b.x + 3; px < b.x + b.w - 3; px += 2) {
          const th = BAYER[((px / 2) | 0) & 1][(((b.y + 38 - k) / 2) | 0) & 1] / 4;   // &1 对负 x 也恒为 0/1
          if (dens * (0.3 + th * 0.9) > 0.30) {
            x.fillStyle = (k < 4 && th > 0.4) ? '#35523f' : '#446355';
            x.fillRect(px, b.y + 38 - k, 2, 2);
          }
        }
      }
    }
  }
  const wsh = x.createLinearGradient(0, 0, 0, faceH);           // 顶暗（保留原气氛）
  wsh.addColorStop(0, 'rgba(10,12,20,.42)'); wsh.addColorStop(0.6, 'rgba(10,12,20,0)');
  x.fillStyle = wsh; x.fillRect(0, 0, W, faceH);
}

// 大石板上色：rows 来自 slabPlan(seed, W, y0, H)
export function paintSlabs(x, rows, W, y0, H) {
  x.fillStyle = '#211f26';                                    // 板缝底
  x.fillRect(0, y0, W, H);
  for (const row of rows) for (const s of row.blocks) {
    const base = '#6b675c';
    x.fillStyle = shade(base, s.t - 1);         x.fillRect(s.x + 3, s.y + 3, s.w - 6, s.h - 6);
    x.fillStyle = shade(base, s.t - 1 + 0.13);  x.fillRect(s.x + 3, s.y + 3, s.w - 6, 4);   // 顶缘受光
    x.fillStyle = shade(base, s.t - 1 - 0.2);   x.fillRect(s.x + 3, s.y + s.h - 7, s.w - 6, 4); // 底缘沉影
    if (s.crack) {
      x.strokeStyle = 'rgba(30,28,34,.5)'; x.lineWidth = 3; x.lineCap = 'round';
      x.beginPath();
      let cx = s.x + 20 + (s.w - 40) * 0.3, cy = s.y + 12; x.moveTo(cx, cy);
      while (cy < s.y + s.h - 12) { cx += 10 - ((cx * 7) % 20); cy += 14; x.lineTo(cx, cy); }
      x.stroke();
    }
  }
}
