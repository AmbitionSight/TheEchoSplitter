// —— 公共壳：启动/标题序章/音频语音链/物品栏/E 系统骨架/指令解释器/结算存档 ——
// 每关 = 一份 content JSON + 一个 kit（事件机 + 世界 + tick/draw/E 钩子），壳只有这一份。
// 同一页内可换章：kit.next 存在时，走到尽头无缝交接进入下一关（无刷新，跳过其标题页）。
import { createHotbar, isVowel } from './hotbar.js';
import { bankStone, syncCraftSlots } from './workbench.js';
import { createJournal } from './journal.js';
import { cap } from './chapter.js';
import { createUI } from './ui.js';
import { Speech, Sfx, pickVoices, SpeechQueue, estimateMs } from './audio.js';
import { loadProfile, saveProfile, mergeProfile } from './profile.js';
import { loadAtlases } from './sprites.js';

export const CHAPTER_NEXT = { 1: 'chapter2.html', 2: 'chapter3.html', 3: null };
export const CHAPTER_DAY = { 1: '第一天', 2: '第二间房', 3: '第三间房' };

export function mount(kit) {
  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', () => bootShell(kit));
}

function bootShell(kit) {
  const el = id => document.getElementById(id);
  const cv = el('game'), ctx = cv.getContext('2d');
  const dpr = Math.min(2, devicePixelRatio || 1);

  let currentKit = kit;
  const fit = () => {
    const s = Math.min(innerWidth / currentKit.W, innerHeight / currentKit.H);
    el('stage').style.width = `${currentKit.W * s}px`;
    el('stage').style.height = `${currentKit.H * s}px`;
  };
  fit(); addEventListener('resize', fit);

  window.__errors = [];
  addEventListener('error', e => __errors.push(String(e.message)));
  addEventListener('unhandledrejection', e => __errors.push(String(e.reason)));

  // —— 同页交接遮罩：第二间房走到尽头 → 崖壁（第二间房后半，纯视觉，不挡输入）——
  const veil = document.createElement('div');
  veil.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;' +
    'background:#05070b;color:#cfe6e0;font:600 30px/1 system-ui;letter-spacing:.35em;text-indent:.35em;' +
    'opacity:0;pointer-events:none;transition:opacity .55s ease;';
  document.body.appendChild(veil);
  const wait = ms => new Promise(r => setTimeout(r, ms));

  let disposeCurrent = null;
  let switching = false;

  async function bootChapter(k, { autostart = false, beat = null } = {}) {
    if (!k) return false;
    currentKit = k;
    cv.width = k.W * dpr; cv.height = k.H * dpr;               // 重设尺寸会清空画布并复位变换
    ctx.scale(dpr, dpr);
    ctx.imageSmoothingEnabled = false;                          // 像素素材保持锐利
    fit();
    const content = await fetch(`/api/chapter${k.contentId ?? k.chapter}`).then(r => r.json()).catch(() => null);
    if (!content) return false;
    el('title').querySelector('h1').textContent = content.meta.title;
    el('title').querySelector('.sub').textContent = content.meta.titleEn;
    if (k.titleRune) el('title').querySelector('.rune-float').textContent = k.titleRune;
    const pro = el('prologue');
    if (content.meta.intro) {
      pro.querySelectorAll('p:not(.tap)').forEach((p, i) => { if (content.meta.intro[i]) p.textContent = content.meta.intro[i]; });
    }
    const atlases = await loadAtlases().catch(e => { window.__errors.push('atlas: ' + e.message); return null; });
    const shell = startShell({ kit: k, content, el, cv, ctx, atlases, onHandoff: handoff });
    disposeCurrent = shell.dispose;
    if (autostart) {
      el('title').classList.add('hidden');
      dispatchEvent(new CustomEvent('game:start'));                       // 必须在 startShell 注册监听之后
      if (beat) window.G.jump(beat);                                      // 调试：?autostart=1&beat=door-open
    } else {
      el('title').classList.remove('hidden');
      el('btn-start').addEventListener('click', () => {
        el('title').classList.add('hidden');
        pro.classList.remove('hidden');
        pro.addEventListener('click', () => { pro.classList.add('hidden'); dispatchEvent(new CustomEvent('game:start')); }, { once: true, signal: shell.signal });
      }, { once: true, signal: shell.signal });
    }
    return true;
  }

  async function handoff(next) {                                // 淡出 → 拆当前章 → 载下一章 → 淡入
    if (switching) return;
    switching = true;
    veil.textContent = next.label ?? (CHAPTER_DAY[next.chapter] || '');   // 章可给自定义遮罩文案，缺省按日次
    veil.style.opacity = '1';
    await wait(560);
    try {
      disposeCurrent?.();
      const nextKit = await next.load();
      if (!await bootChapter(nextKit, { autostart: true })) throw new Error('下一间房载入失败');
      veil.style.opacity = '0';
      await wait(560);
      switching = false;
    } catch (e) {
      window.__errors.push('handoff: ' + ((e && e.message) || e));
      location.href = next.page || CHAPTER_NEXT[kit.chapter];   // 兜底：退回整页跳转，玩家必定到达下一间房
    }
  }

  const q = new URLSearchParams(location.search);
  const autostart = q.get('autostart') === '1';
  bootChapter(kit, { autostart, beat: autostart ? q.get('beat') : null });
}

function startShell({ kit, content, el, cv, ctx, atlases, onHandoff }) {
  const ac = new AbortController();                 // 同页换章：dispose 时一次性摘掉本关所有监听
  const signal = ac.signal;

  // —— 音频 + 语音链 ——
  const speech = new Speech(), sfx = new Sfx();
  let voices = { uncle: null, child: null, door: null };
  const scan = () => { if (speech.ready) voices = pickVoices(speechSynthesis.getVoices()); };
  scan();
  if (speech.ready) speechSynthesis.addEventListener('voiceschanged', scan, { signal });
  addEventListener('pointerdown', () => { sfx.ctx?.resume(); speech.warmup(); }, { once: true, signal });

  const speechQ = new SpeechQueue(speech);      // 台词串行；点读音素最新优先（不排长队）
  function speak(text, who = 'door', slow = false) {
    const conf = (kit.voices?.(voices) || voices)[who] || {};
    const rate = slow ? (conf.rateSlow ?? Math.min(0.6, conf.rate ?? 1)) : conf.rate;
    const p = speechQ.line(text, { ...conf, rate, pitch: conf.pitch });
    kit.onSpeak?.(text, who, slow);
    return p;
  }
  function speakCarrier(text) {
    const conf = (kit.voices?.(voices) || voices).child || {};
    return speechQ.carrier(text, { ...conf, pitch: conf.pitch });
  }
  function carrierOf(ipa) {                   // 章内载词优先，通用 48 音表兜底（回声/图鉴点读用）
    return content.carriers[ipa] ?? content.phonemeBook?.carriers?.[ipa] ?? ipa;
  }

  // —— 世界 ——
  const profile = loadProfile(localStorage);
  const game = kit.createGame(content, profile);
  const w = kit.makeWorld({ content, profile, game, el, cv, ctx, speech, sfx, speak, voices, atlases, signal });
  w.game = game; w.content = content; w.profile = profile; w.speech = speech; w.sfx = sfx; w.speak = speak;
  w.atlases = atlases;
  w.started = false;

  // —— UI / 物品栏 ——
  const ui = createUI({ content, atlases, signal });
  const hb = createHotbar({
    words: content.words,
    crafting: content.crafting || { progressiveGlow: true },
    signal,
    onSpeakCarrier: ipa => { sfx.click(); speakCarrier(content.carriers[ipa]); },
    onCraft: word => run(kit.gameEvent(game, 'CRAFT', word)),
    onTakeItem: word => run(kit.gameEvent(game, 'HOLD_ITEM', word)),
    onDropItem: (word, cx, cy) => kit.onDropItem?.(w, word, cx, cy)
  });
  hb.show(); hb.refresh(game.inv);
  w.ui = ui; w.hb = hb;
  ui.updateHand(null);

  // —— 析声录（图鉴）：词卡 + 48 符文；点亮 = 本章捡过/听过 ∪ 书档一路攒下的 ——
  const journal = createJournal({
    content,
    signal,
    speakWord: word => speak(cap(word), 'child'),
    speakCarrier: ipa => speakCarrier(carrierOf(ipa)),
    lifetimeHeard: () => [...new Set([...profile.everPicked, ...profile.heard])],
    lifetimeWords: () => profile.words
  });
  const btnBook = el('btn-book');
  if (btnBook) btnBook.addEventListener('click', () => journal.toggle(game), { signal });

  // —— 指令解释器（标准集 + kit 覆盖/扩展） ——
  function run(instructions) {
    for (const ins of instructions) {
      if (kit.runExtras?.[ins.t]) { kit.runExtras[ins.t](w, ins); continue; }
      switch (ins.t) {
        case 'speak': speak(ins.text, ins.who, ins.slow); break;
        case 'carrier': sfx.click(); speakCarrier(content.carriers[ins.ipa]); break;
        case 'echo': {                      // 回声物件：音素石在底部回声条亮出 → 念整词（词只念不写）；新声音悄悄进书
          const ipas = ins.ipas || [];
          const added = game.heard ? ipas.filter(p => !game.heard.has(p)) : [];
          ipas.forEach(p => game.heard?.add(p));
          const est = ins.say ? estimateMs(ins.say, 0.8) : 900;   // 慢速童声念整词的估时
          ui.echoStrip({ ...ins }, added.length > 0, ipas.length * 0.12 + 0.35 + est / 1000 + 0.55);
          if (ins.say) speak(ins.say, 'child', true);
          break;
        }
        case 'hint': ui.setHint(ins.key); break;
        case 'beat': game.beat = ins.beat; break;
        case 'bank': bankStone(w, ins); break;               // 合成台存石：进库存后自动进槽（workbench）
        case 'hand': ui.updateHand(game.hand); kit.syncHeld?.(w); break;
        case 'resonate': sfx.resonate(); hb.refresh(game.inv); break;
        case 'itemIn': sfx.itemIn(); hb.refresh(game.inv); break;
        case 'mutter': sfx.mutter(); break;
        case 'meow': sfx.meow(); w.actors && (w.actors.cat.earT = 1, w.actors.cat.meowT = 0.6); break;
        case 'sfx': sfx[ins.name]?.(); break;
        case 'summary': finish(); break;
        default: break;                                  // 未知指令交给 kit（runExtras 已处理）或忽略
      }
    }
  }
  w.run = run;

  function finish() {
    const payload = kit.summaryMerge(game, w);
    const p = mergeProfile(loadProfile(localStorage), payload);
    saveProfile(localStorage, p);                        // 先存档：无缝交接时下一关开局要读到新 abilities
    const showSummary = !kit.next || kit.summaryFirst;   // summaryFirst：章末先弹结算，再由按钮无缝交接
    if (showSummary) {
      const day = el('summary').querySelector('.day'); if (day) day.textContent = CHAPTER_DAY[kit.chapter] || '';
      // 章末卡：summaryFirst 的章（第二章两半）石数用合并后的档案累计，而不是只剩最后半段
      ui.summary(game, { words: [...game.book], stones: kit.summaryFirst ? (p.picks ?? game.stonesPicked) : game.stonesPicked });
    }
    const walk = el('btn-walk');
    if (kit.next && !kit.summaryFirst) { onHandoff?.(kit.next); return; }   // 无缝交接：不弹结算
    if (kit.next) { walk.textContent = '下一间房 →'; walk.onclick = () => onHandoff?.(kit.next); return; }
    const next = CHAPTER_NEXT[kit.chapter];              // 无 kit.next 的章（一/三）：沿用整页跳转或收尾
    if (next) {
      walk.textContent = '下一间房 →';
      walk.onclick = () => { location.href = next; };
    } else {
      walk.textContent = '继续走走';
      walk.onclick = null;
      kit.onFinal?.(w);
    }
  }

  // —— E 系统 ——
  let eTarget = null;
  function doE(t = eTarget) {               // 可传显式目标：鼠标走到后自动交互与按 E 同一条路径
    if (!t) return;
    sfx.click();
    kit.onE(w, t);
  }
  w.doE = doE;

  const keys = new Set();
  w.keys = keys;
  const KM = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
  addEventListener('keydown', e => {
    const overlay = document.querySelector('.screen:not(.hidden)');   // 析声录/揭示卡/结算等全屏浮层开着时不接游戏键（防在书后面交互/走动/跳跃）
    if (overlay) {
      if (e.code === 'Escape' && overlay.id === 'journal') journal.close();
      return;
    }
    if (e.code === 'KeyE') { if (w.started && eTarget) doE(); return; }
    if (e.code === 'Space' && kit.onSpace) { e.preventDefault(); kit.onSpace(w); return; }
    if (KM[e.code]) { keys.add(KM[e.code]); kit.onKey?.(w, KM[e.code]); }
  }, { signal });
  addEventListener('keyup', e => { if (KM[e.code]) keys.delete(KM[e.code]); }, { signal });
  addEventListener('blur', () => keys.clear(), { signal });
  cv.addEventListener('pointerdown', e => { if (w.started) kit.onPointerDown?.(w, e, cv); }, { signal });

  // —— 主循环 ——
  let last = performance.now();
  let rafId = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (w.started) {
      kit.tick(w, dt);
      eTarget = kit.findE(w);
      run(kit.gameEvent(game, 'TICK', dt));
      syncCraftSlots(w);                   // 合成槽 → 台面显示（全章节统一）
    }
    kit.draw(w, ctx, eTarget);
    rafId = requestAnimationFrame(frame);
  }
  rafId = requestAnimationFrame(frame);

  function begin() {
    w.started = true;
    window.__gameLoopOn = true;
    run(kit.startGame(game));
    kit.onBegin?.(w);
  }
  addEventListener('game:start', begin, { signal });

  window.G = {
    content,
    get beat() { return game.beat; },
    jump(b) {
      w.started = true;
      run(kit.debug(game, b));
      hb.refresh(game.inv);
      ui.updateHand(game.hand);
      kit.syncHeld?.(w);
    },
    game
  };

  // —— 同页换章：摘监听、停主循环、清输入、关浮层、释放音频 ——
  function dispose() {
    ac.abort();
    cancelAnimationFrame(rafId);
    w.started = false;
    keys.clear();
    cv.style.cursor = 'default';
    try { w.speech?.cancel?.(); } catch { /* ignore */ }       // 掐断本章台词，免与下一间房重叠
    try { const p = w.sfx?.ctx?.close?.(); if (p && p.catch) p.catch(() => {}); } catch { /* ignore */ }   // 释放本章 AudioContext（浏览器数量有限）
    for (const id of ['journal', 'notes', 'summary']) el(id)?.classList.add('hidden');
  }
  return { dispose, signal };
}
