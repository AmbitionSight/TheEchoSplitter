import { iconURL } from './art.js';
import { CHAR_BLOCK } from './sprites.js';
import { isVowel } from './hotbar.js';

export function createUI({ content, atlases, signal }) {
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

  // 回声条：音素石依次亮出 → 整词念出时一起共振；新声音只给一枚小标 + 书钮轻亮（不再弹顶部大提示）
  const echoEl = el('echo-strip');
  let echoTimer = 0;
  function echoStrip(ins, isNew, dur = 3.4) {        // dur：整词念完后半拍自动收起（由壳按估时传入）
    if (!echoEl) return;
    const ipas = ins.ipas || [];
    const mergeAt = ipas.length * 0.12 + 0.35;                    // 词开口的时刻，石群共振
    echoEl.innerHTML = ipas.map((p, i) =>
      `<span class="es-stone ${isVowel(p) ? 'v' : 'c'}" style="animation:popIn .4s ${i * 0.12}s ease backwards, esMerge .8s ${mergeAt}s ease">${p}</span>`).join('') +
      (isNew ? `<span class="es-new" style="animation:popIn .4s .8s ease backwards">已入析声录</span>` : '');
    echoEl.classList.remove('hidden'); void echoEl.offsetWidth;
    clearTimeout(echoTimer);
    echoTimer = setTimeout(() => echoEl.classList.add('hidden'), dur * 1000);
    const book = document.getElementById('btn-book');
    if (isNew && book) { book.classList.add('armed'); setTimeout(() => book.classList.remove('armed'), 1600); }
  }
  function reveal(word) {
    const screen = el('reveal');
    if (!screen) return Promise.resolve();               // 章节没有揭示卡：静默
    const rev = content.words[word]?.reveal ?? {};       // 章可给 line/sub/ok；缺省回落 ch1 原文案
    el('reveal-stones').innerHTML = (content.words[word]?.phonemes ?? []).map(([p]) => `<span>${p}</span>`).join('');
    el('reveal-word').textContent = word.toUpperCase();
    const line = screen.querySelector('h2'), sub = screen.querySelector('.sub');
    if (line) line.textContent = rev.line ?? '你用声音打开了门';
    if (sub) sub.textContent = rev.sub ?? '文字，是冻住的声音';
    el('reveal-ok').textContent = rev.ok ?? '把这个词，还给门';
    screen.classList.remove('hidden');
    return new Promise(res => {
      let settled = false;
      const done = () => {
        if (settled) return; settled = true;
        screen.classList.add('hidden');
        document.removeEventListener('pointerdown', done);
        res();
      };
      el('reveal-ok').addEventListener('click', done, { once: true, signal });
      setTimeout(() => { if (!settled) document.addEventListener('pointerdown', done, { signal }); }, 12000); // 12s 后任意点按兜底（Task 13 评审 F；按钮仍是主路径）
    });
  }
  function summary(g, info = {}) {
    const words = info.words ?? [...g.book];                 // 章可传本章词（2b：jump+rope，跨两半）
    const stones = info.stones ?? g.stonesPicked;            // 章可传石数（壳按结算载荷给）
    el('summary-line').textContent = `你捡起了 ${words.length} 个词 · ${stones} 块声音石`;
    el('summary-icons').innerHTML = words
      .map(w => {
        const def = content.words[w] ?? content.lexicon?.[w];   // 前几章词（如 2b 的 jump）经 lexicon 解析图标
        return def ? `<img src="${iconURL(def.icon)}" alt="">` : '';
      }).join('');
    el('summary').classList.remove('hidden');
  }
  el('btn-again').addEventListener('click', () => location.reload(), { signal });
  el('btn-notes').addEventListener('click', () => el('notes').classList.remove('hidden'), { signal });
  el('notes-close').addEventListener('click', () => el('notes').classList.add('hidden'), { signal });
  el('btn-walk').addEventListener('click', () => el('summary').classList.add('hidden'), { signal });

  // —— 左上小人面板（v2：头像 + 手持槽；有素材时用小孩精灵头像）——
  const fig = el('avatar-fig');
  if (fig) {
    const fx = fig.getContext('2d');
    const img = atlases?.ch;
    if (img) {
      fx.imageSmoothingEnabled = false;
      fx.drawImage(img, CHAR_BLOCK.kid + 6, 26, 36, 48, 10, 8, 36, 48);    // 正面头+肩（格内 6,26 起）
    } else {
      fx.strokeStyle = '#F5F5F7'; fx.lineWidth = 3; fx.lineCap = 'round';
      fx.beginPath(); fx.arc(28, 18, 9, 0, 7); fx.stroke();                  // 头
      fx.beginPath(); fx.moveTo(28, 27); fx.lineTo(28, 46); fx.stroke();     // 身
      fx.beginPath(); fx.moveTo(28, 34); fx.lineTo(18, 42); fx.stroke();     // 左臂
      fx.beginPath(); fx.moveTo(28, 34); fx.lineTo(40, 30); fx.stroke();     // 右臂（持物）
      fx.beginPath(); fx.moveTo(28, 46); fx.lineTo(20, 58); fx.stroke();     // 左腿
      fx.beginPath(); fx.moveTo(28, 46); fx.lineTo(36, 58); fx.stroke();     // 右腿
    }
  }
  function updateHand(hand) {
    const slot = el('hand-slot');
    if (!slot) return;
    if (!hand) { slot.textContent = ''; slot.innerHTML = ''; slot.className = 'hand-slot'; return; }
    if (hand.kind === 'stone') {
      slot.innerHTML = `<span class="glyph">${hand.ipa}</span>`;
      slot.className = 'hand-slot stone-' + (isVowel(hand.ipa) ? 'v' : 'c');
    } else {
      slot.innerHTML = `<img src="${iconURL(content.words[hand.word].icon)}" alt="">`;
      slot.className = 'hand-slot item';
    }
  }
  // —— 旅途回顾（走马灯）：第三关收尾自动播放；词只出图标不写字（拼写时刻只属于揭示卡）——
  let rcEl = null, rcTimer = 0, rcIdx = 0, rcData = null;
  function recapBuild() {
    if (rcEl) return rcEl;
    rcEl = document.createElement('div');
    rcEl.id = 'recap';
    rcEl.className = 'screen center slab hidden';
    rcEl.innerHTML = '<p class="rc-day"></p><p class="rc-place"></p><div class="rc-icons"></div><div class="rc-dots"></div>';
    document.body.appendChild(rcEl);
    rcEl.addEventListener('click', () => recapNext());
    return rcEl;
  }
  function recapPaint() {
    const n = rcData.slides.length, end = rcIdx >= n;
    rcEl.querySelector('.rc-day').textContent = end ? (rcData.title || '') : (rcData.slides[rcIdx].day || '');
    rcEl.querySelector('.rc-place').textContent = end ? '' : (rcData.slides[rcIdx].place || '');
    rcEl.querySelector('.rc-icons').innerHTML = end
      ? `<p class="rc-end">${rcData.end || ''}</p>`
      : (rcData.slides[rcIdx].words || []).map(w => {
          const def = content.words[w] ?? content.lexicon?.[w];
          return def ? `<img src="${iconURL(def.icon)}" alt="">` : '';
        }).join('');
    rcEl.querySelector('.rc-dots').innerHTML = Array.from({ length: n + 1 }, (_, i) => `<i class="${i === rcIdx ? 'on' : ''}"></i>`).join('');
    rcEl.classList.remove('hidden');                          // 建出来是 hidden，每帧绘制时亮起（漏这行=永远看不见）
  }
  function recapNext() {
    rcIdx++;
    if (rcIdx > rcData.slides.length) { recapStop(); return; }
    recapPaint();
    clearTimeout(rcTimer);
    rcTimer = setTimeout(recapNext, rcIdx >= rcData.slides.length ? 3600 : 2400);
  }
  function recapStop() { clearTimeout(rcTimer); rcEl?.classList.add('hidden'); rcIdx = 0; }
  function recap(data) {
    if (!data?.slides?.length || typeof document === 'undefined') return;
    rcData = data; recapBuild(); rcIdx = 0; recapPaint();
    clearTimeout(rcTimer); rcTimer = setTimeout(recapNext, 2400);
  }

  return { setHint, toast, echoStrip, reveal, summary, recap, updateHand };
}
