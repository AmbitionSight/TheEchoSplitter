// —— 合成台共用件：存石进槽 / 槽位同步 / 台面槽石显示（全章节同一套工作台操作） ——
// 壳的标准 bank 指令走 bankStone；各章台面（俯视/横版）用 drawBenchStones + 各自槽位几何。
import { isVowel } from './hotbar.js';
import { PAL } from './art.js';

// bank 指令统一处理：音效 + 刷库存 + 自动摆进第一个空槽（槽满/超库存自动跳过）
export function bankStone(w, ins) {
  w.sfx.itemIn();
  w.hb.refresh(w.game.inv);
  w.hb.placeNext?.(ins.ipa);
}

// 每帧同步合成槽 → view.craftSlots（台面显示用；壳主循环统一调用，各章免写）
export function syncCraftSlots(w) {
  if (w.view) w.view.craftSlots = w.hb?.getSlots?.() ?? null;
}

// 台面槽内音素石（俯视/横版共用；sockets = [[x, y] × 4]，由各章几何提供）
export function drawBenchStones(x, slots, sockets) {
  (slots || []).forEach((ipa, i) => {
    if (!ipa) return;
    const [sx, sy] = sockets[i];
    x.save();
    x.translate(sx, sy);
    x.shadowColor = PAL.glowRune; x.shadowBlur = 8;
    x.fillStyle = isVowel(ipa) ? PAL.vowel : PAL.cons;
    x.beginPath(); x.arc(0, 0, 7.5, 0, 7); x.fill();
    x.shadowBlur = 0;
    x.lineWidth = 2; x.strokeStyle = PAL.ink; x.stroke();
    x.fillStyle = PAL.ink; x.font = 'bold 8px system-ui';
    x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(ipa, 0, 0.5);
    x.restore();
  });
}
