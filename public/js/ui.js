import { iconURL } from './art.js';

export function createUI({ content }) {
  const el = id => document.getElementById(id);
  const hint = el('hintbar'), hintText = el('hint-text'), toastEl = el('toast');
  let toastTimer = 0;

  function setHint(key) {
    const text = content.hints[key] ?? key;             // 允许直接传文案
    if (hintText.textContent === text) return;
    hintText.textContent = text;
    hint.classList.add('hidden'); void hint.offsetWidth;
    hint.classList.remove('hidden');
  }
  function toast(text, dur = 2600) {
    toastEl.textContent = text;
    toastEl.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add('hidden'), dur);
  }
  function reveal(word) {
    const def = content.words[word];
    el('reveal-stones').innerHTML = def.phonemes.map(([p]) => `<span>${p}</span>`).join('');
    el('reveal-word').textContent = word.toUpperCase();
    el('reveal-ok').textContent = '把这个词，还给门';
    el('reveal').classList.remove('hidden');
    return new Promise(res => {
      let settled = false;
      const done = () => {
        if (settled) return; settled = true;
        el('reveal').classList.add('hidden');
        document.removeEventListener('pointerdown', done);
        res();
      };
      el('reveal-ok').addEventListener('click', done, { once: true });
      setTimeout(() => { if (!settled) document.addEventListener('pointerdown', done); }, 12000); // 12s 后任意点按兜底（Task 13 评审 F；按钮仍是主路径）
    });
  }
  function summary(g) {
    el('summary-line').textContent = `你捡起了 ${g.book.size} 个词 · ${g.stonesPicked} 块声音石`;
    el('summary-icons').innerHTML = [...g.book]
      .map(w => `<img src="${iconURL(content.words[w].icon)}" alt="">`).join('');
    el('summary').classList.remove('hidden');
  }
  el('btn-again').addEventListener('click', () => location.reload());
  el('btn-notes').addEventListener('click', () => el('notes').classList.remove('hidden'));
  el('notes-close').addEventListener('click', () => el('notes').classList.add('hidden'));
  el('btn-walk').addEventListener('click', () => el('summary').classList.add('hidden'));
  return { setHint, toast, reveal, summary };
}
