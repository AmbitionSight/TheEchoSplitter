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

// ================= DOM 工具栏 =================
import { iconURL } from './art.js';

const VOWELS = new Set(['iː','ɪ','e','æ','ɑː','ɒ','ɔː','ʊ','uː','ʌ','ə','ɜː','eɪ','aɪ','ɔɪ','əʊ','aʊ','ɪə','eə','ʊə']);
export const isVowel = ipa => VOWELS.has(ipa);

// 放置守卫：同一音素在槽内的数量不得超过库存数量（纯函数）
export function canPlace(slots, inv, ipa) {
  const inSlots = slots.filter(s => s === ipa).length;
  return inSlots < stoneCount(inv, ipa);
}

export function createHotbar({ words, crafting = {}, onSpeakCarrier, onSpeakWord, onCraft, onTakeItem, onDropItem }) {
  const el = id => document.getElementById(id);
  const root = el('hotbar'), craftRow = el('craft-row');
  const stoneBox = el('stone-cells'), itemBox = el('item-cells');
  const ghost = el('drag-ghost');
  const slotEls = [...craftRow.querySelectorAll('.slot')];
  const slots = [null, null, null, null];
  let inv = null;

  function refreshSlots() {
    const m = inv ? craftMatch(slots, words, inv) : { word: null, glowDepth: 0 };
    const d = m.word ? 3 : m.glowDepth;
    slotEls.forEach((s, i) => {
      s.textContent = slots[i] || '';
      s.className = 'slot' + (slots[i] ? ' filled' : '');
      if (crafting.progressiveGlow !== false) {
        s.classList.remove('g1', 'g2', 'g3');
        if (slots.filter(Boolean).length && d > 0 && i < d) s.classList.add(`g${Math.min(3, d)}`);
      }
    });
    if (m.word) runCraft(m.word);
  }

  async function runCraft(word) {
    slots.fill(null);
    refreshSlots();
    await onCraft(word);               // main：gameEvent('CRAFT')（事件机统一消耗库存）+ 共鸣音效
    if (inv) refresh(inv);
  }

  function placeStone(ipa, idx) {
    if (!canPlace(slots, inv, ipa)) return;      // 库存不够不再放
    if (slots[idx]) slots[idx] = null;           // 换石：旧的直接回「可放置池」
    slots[idx] = ipa;
    refreshSlots();
  }
  function returnStone(idx) {
    if (!slots[idx]) return;
    slots[idx] = null;
    refreshSlots();
  }

  function refresh(inv_) {
    inv = inv_;
    stoneBox.innerHTML = '';
    for (const ipa of inv.order) {
      const n = stoneCount(inv, ipa);
      if (n <= 0) continue;
      const cell = document.createElement('div');
      cell.className = `cell stone-${isVowel(ipa) ? 'v' : 'c'}`;
      cell.innerHTML = `<span class="glyph">${ipa}</span>` + (n > 0 ? `<span class="count">×${n}</span>` : '');
      cell.addEventListener('pointerdown', e => startDrag(e, cell, { kind: 'stone', ipa }));
      stoneBox.appendChild(cell);
    }
    itemBox.innerHTML = '';
    for (const word of inv.items.keys()) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.innerHTML = `<img src="${iconURL(words[word].icon)}" alt="">`;
      cell.addEventListener('pointerdown', e => startDrag(e, cell, { kind: 'item', word }));
      itemBox.appendChild(cell);
    }
  }

  // —— 统一拖拽：轻点=点读；拖动=幽灵；DOM 内投槽 / 跨层投画布 ——
  function startDrag(e, cell, payload) {
    if (e.button > 0) return;                                 // 鼠标右/中键不发起拖拽（Task 13 评审 E）
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    const move = ev => {
      if (ev.pointerId !== e.pointerId) return;
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) {
        moved = true;
        ghost.classList.remove('hidden');
        ghost.innerHTML = payload.kind === 'item'
          ? `<img src="${iconURL(words[payload.word].icon)}" style="width:40px;height:40px">`
          : `<span class="glyph">${payload.ipa}</span>`;
        if (payload.kind === 'item') cell.style.opacity = '.35';
      }
      if (moved) { ghost.style.left = `${ev.clientX}px`; ghost.style.top = `${ev.clientY}px`; }
    };
    const up = ev => {
      if (ev.pointerId !== e.pointerId) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      ghost.classList.add('hidden');
      cell.style.opacity = '';
      if (!moved) {                                        // 轻点 = 点读（石）/ 拿到手上（词具）
        if (payload.kind === 'stone') onSpeakCarrier(payload.ipa);
        else if (onTakeItem) onTakeItem(payload.word);
        else if (onSpeakWord) onSpeakWord(payload.word);
        return;
      }
      if (payload.kind === 'stone') {                     // 只能投槽位；投空=原地无事（库存从未动过）
        const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.slot');
        if (hit) placeStone(payload.ipa, Number(hit.dataset.slot));
      } else {                                             // 词具 → 画布（main 做命中）
        onDropItem(payload.word, ev.clientX, ev.clientY);
      }
    };
    const cancel = ev => {
      if (ev.pointerId !== e.pointerId) return;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      ghost.classList.add('hidden'); cell.style.opacity = '';
      // pointercancel：库存从未变化，幽灵消失即回位
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  }

  slotEls.forEach((s, i) => s.addEventListener('click', () => returnStone(i)));

  return {
    refresh,
    show() { root.classList.remove('hidden'); document.getElementById('bag').classList.remove('hidden'); },
    pulseBag(total) {
      const bag = document.getElementById('bag');
      document.getElementById('bag-count').textContent = String(total);
      document.getElementById('bag-icon').innerHTML =
        `<img src="${iconURL('gem')}" style="width:26px;height:26px" alt="">`;
      bag.classList.remove('pulse'); void bag.offsetWidth; bag.classList.add('pulse');
    }
  };
}
