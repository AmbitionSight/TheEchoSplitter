// —— 库存（消耗制，规格 §5）——
export function createInventory() {
  return { stones: new Map(), items: new Map(), everPicked: new Set(), order: [] };
}
export function addStone(inv, ipa) {
  inv.stones.set(ipa, (inv.stones.get(ipa) || 0) + 1);
  if (!inv.order.includes(ipa)) inv.order.push(ipa);
}
export function stoneCount(inv, ipa) { return inv.stones.get(ipa) || 0; }
export function totalStones(inv) {
  let n = 0; for (const c of inv.stones.values()) n += c; return n;
}
export function canConsume(inv, seq) {
  const need = new Map();
  for (const p of seq) need.set(p, (need.get(p) || 0) + 1);
  for (const [p, n] of need) if (stoneCount(inv, p) < n) return false;
  return true;
}
export function consume(inv, seq) {
  if (!canConsume(inv, seq)) return false;
  for (const p of seq) inv.stones.set(p, stoneCount(inv, p) - 1);
  return true;
}

// —— 合成判定：从首槽起连续命中才共鸣；渐进共鸣=最长正确前缀（规格 §5）——
export function craftMatch(slots, words, inv) {
  let best = 0, matched = null;
  for (const [w, def] of Object.entries(words)) {
    const seq = def.phonemes.map(p => p[0]);
    if (seq.length > slots.length) continue;
    let lead = 0, ok = true;
    for (let i = 0; i < seq.length; i++) {
      if (slots[i] === seq[i]) { lead++; } else { ok = false; break; }
    }
    if (ok) {
      if (!slots.slice(seq.length).every(s => s == null)) ok = false;       // 尾槽必须空
      if (ok && !canConsume(inv, seq)) ok = false;                           // 库存必须够
      if (ok) matched = w;
    }
    best = Math.max(best, lead);
  }
  return { word: matched, glowDepth: best };
}
