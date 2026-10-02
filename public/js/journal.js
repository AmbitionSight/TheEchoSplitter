import { iconURL, drawRune } from './art.js';
import { isVowel } from './hotbar.js';

// 波形分段：按音素时长比例铺满 width（规格 §8 词语卡）
export function waveSegments(phonemes, width) {
  const total = phonemes.reduce((s, [, ms]) => s + ms, 0);
  const avail = width - (phonemes.length - 1) * 4;
  let x = 0;
  return phonemes.map(([ipa, ms]) => {
    const w = (ms / total) * avail;
    const seg = { ipa, ms, x, w };
    x += w + 4;
    return seg;
  });
}

export function createJournal({ content, speakWord, speakCarrier }) {
  const el = id => document.getElementById(id);
  const root = el('journal'), wordsBox = el('journal-words'), runesBox = el('journal-runes');
  const pb = content.phonemeBook;

  function renderWords(g) {
    wordsBox.innerHTML = '';
    for (const word of g.book) {
      const def = content.words[word];
      const card = document.createElement('div');
      card.className = 'word-card';
      const ipaHtml = def.phonemes.map(([p]) =>
        `<span style="${g.inv.everPicked.has(p) ? '' : 'opacity:.35'}">${p}</span>`).join('<b> · </b>');
      card.innerHTML = `
        <img src="${iconURL(def.icon)}" alt="">
        <div class="wc-mid">
          <canvas width="360" height="56"></canvas>
          <div class="ipa">${ipaHtml}</div>
        </div>
        <button class="btn primary small">听见</button>`;
      card.querySelector('button').addEventListener('click', () => speakWord(word));
      wordsBox.appendChild(card);
      const cv = card.querySelector('canvas'), x = cv.getContext('2d');
      for (const s of waveSegments(def.phonemes, 360)) {
        const h = isVowel(s.ipa) ? 40 : 24;
        x.fillStyle = g.inv.everPicked.has(s.ipa) ? '#0A84FF' : 'rgba(255,255,255,.14)';
        x.beginPath();
        x.roundRect ? x.roundRect(s.x, (56 - h) / 2, s.w, h, 8) : x.rect(s.x, (56 - h) / 2, s.w, h);
        x.fill();
      }
    }
    if (!g.book.size) wordsBox.innerHTML = `<div class="rune-endcard">（还没有拼出任何词——去碰碰这间屋子）</div>`;
  }

  function renderRunes(g) {
    runesBox.innerHTML = '';
    let picked = 0;
    for (const group of pb.groups) {
      const grid = document.createElement('div');
      grid.className = 'rune-grid';
      grid.style.gridTemplateColumns = group.items.length > 10 ? 'repeat(8,1fr)' : 'repeat(8,1fr)';
      for (const ipa of group.items) {
        const lit = g.inv.everPicked.has(ipa);
        if (lit) picked++;
        const cell = document.createElement('div');
        cell.className = 'rune-card' + (lit ? ' lit' : '');
        const cv = document.createElement('canvas');
        cv.width = 44; cv.height = 50;
        drawRune(cv.getContext('2d'), pb.runes[ipa], 22, 25, 30,
          lit ? '#54e0c8' : 'rgba(255,255,255,.14)', lit ? 5 : 4);
        cell.appendChild(cv);
        const src = Object.entries(content.words).find(([, d]) => d.phonemes.some(([p]) => p === ipa))?.[0];
        cell.insertAdjacentHTML('beforeend',
          `<div class="ipa">${ipa}</div>` +
          (lit && src ? `<img src="${iconURL(content.words[src].icon)}" alt="">`
                      : `<div class="sleep">沉睡的声音</div>`));
        cell.addEventListener('click', () => {
          if (!lit) return;
          speakCarrier(ipa);
          if (src) setTimeout(() => speakWord(src), 900);
        });
        grid.appendChild(cell);
      }
      runesBox.appendChild(grid);
    }
    const sleep = pb.total - picked;
    runesBox.insertAdjacentHTML('beforeend',
      `<div class="rune-endcard">还有 ${sleep} 个声音沉睡在更深的房间里……</div>`);
    el('rune-count').textContent = `${picked}/${pb.total}`;
  }

  root.querySelectorAll('.seg-btn').forEach(btn => btn.addEventListener('click', () => {
    root.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b === btn));
    wordsBox.classList.toggle('hidden', btn.dataset.tab !== 'words');
    runesBox.classList.toggle('hidden', btn.dataset.tab !== 'runes');
  }));
  el('journal-close').addEventListener('click', close);

  function open(g) { renderWords(g); renderRunes(g); root.classList.remove('hidden'); }
  function close() { root.classList.add('hidden'); }
  return { open, close, toggle(g) { root.classList.contains('hidden') ? open(g) : close(); } };
}
