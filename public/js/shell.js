// —— 公共壳：启动/标题序章/音频语音链/物品栏/E 系统骨架/指令解释器/结算存档 ——
// 每关 = 一份 content JSON + 一个 kit（事件机 + 世界 + tick/draw/E 钩子），壳只有这一份。
import { createHotbar, isVowel } from './hotbar.js';
import { createUI } from './ui.js';
import { Speech, Sfx, pickVoices } from './audio.js';
import { loadProfile, saveProfile, mergeProfile } from './profile.js';
import { loadAtlases } from './sprites.js';

export const CHAPTER_NEXT = { 1: 'chapter2.html', 2: 'chapter3.html', 3: null };
export const CHAPTER_DAY = { 1: '第一天', 2: '第二间房', 3: '第三间房' };

const cap = w => w[0].toUpperCase() + w.slice(1) + '.';

export function mount(kit) {
  if (typeof document === 'undefined') return;
  document.addEventListener('DOMContentLoaded', () => bootShell(kit));
}

function bootShell(kit) {
  const el = id => document.getElementById(id);
  const cv = el('game'), ctx = cv.getContext('2d');
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = kit.W * dpr; cv.height = kit.H * dpr;
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = false;                                      // 像素素材保持锐利
  const fit = () => {
    const s = Math.min(innerWidth / kit.W, innerHeight / kit.H);
    el('stage').style.width = `${kit.W * s}px`;
    el('stage').style.height = `${kit.H * s}px`;
  };
  fit(); addEventListener('resize', fit);
  window.__errors = [];
  addEventListener('error', e => __errors.push(String(e.message)));
  addEventListener('unhandledrejection', e => __errors.push(String(e.reason)));
  fetch(`/api/chapter${kit.chapter}`).then(r => r.json()).catch(() => null).then(async content => {
    if (!content) return;
    el('title').querySelector('h1').textContent = content.meta.title;
    el('title').querySelector('.sub').textContent = content.meta.titleEn;
    if (kit.titleRune) el('title').querySelector('.rune-float').textContent = kit.titleRune;
    const pro = el('prologue');
    if (content.meta.intro) {
      pro.querySelectorAll('p:not(.tap)').forEach((p, i) => { if (content.meta.intro[i]) p.textContent = content.meta.intro[i]; });
    }
    const atlases = await loadAtlases().catch(e => { window.__errors.push('atlas: ' + e.message); return null; });
    startShell({ kit, content, el, cv, ctx, atlases });
    const q = new URLSearchParams(location.search);
    if (q.get('autostart') === '1') {
      el('title').classList.add('hidden');
      dispatchEvent(new CustomEvent('game:start'));                       // 必须在 startShell 注册监听之后
      if (q.get('beat')) window.G.jump(q.get('beat'));                    // 调试：?autostart=1&beat=door-open
    } else {
      el('title').classList.remove('hidden');
      el('btn-start').addEventListener('click', () => {
        el('title').classList.add('hidden');
        pro.classList.remove('hidden');
        pro.addEventListener('click', () => { pro.classList.add('hidden'); dispatchEvent(new CustomEvent('game:start')); }, { once: true });
      }, { once: true });
    }
  });
}

function startShell({ kit, content, el, cv, ctx, atlases }) {
  // —— 音频 + 语音链 ——
  const speech = new Speech(), sfx = new Sfx();
  let voices = { uncle: null, child: null, door: null };
  const scan = () => { if (speech.ready) voices = pickVoices(speechSynthesis.getVoices()); };
  scan();
  if (speech.ready) speechSynthesis.addEventListener('voiceschanged', scan);
  addEventListener('pointerdown', () => { sfx.ctx?.resume(); speech.warmup(); }, { once: true });

  let chain = Promise.resolve();
  function speak(text, who = 'door', slow = false) {
    const conf = (kit.voices?.(voices) || voices)[who] || {};
    const rate = slow ? (conf.rateSlow ?? Math.min(0.6, conf.rate ?? 1)) : conf.rate;
    chain = chain.then(() => speech.speak(text, { ...conf, rate, pitch: conf.pitch }))
      .catch(() => {});
    kit.onSpeak?.(text, who, slow);
    return chain;
  }

  // —— 世界 ——
  const profile = loadProfile(localStorage);
  const game = kit.createGame(content, profile);
  const w = kit.makeWorld({ content, profile, game, el, cv, ctx, speech, sfx, speak, voices, atlases });
  w.game = game; w.content = content; w.profile = profile; w.speech = speech; w.sfx = sfx; w.speak = speak;
  w.atlases = atlases;
  w.started = false;

  // —— UI / 物品栏 ——
  const ui = createUI({ content, atlases });
  const hb = createHotbar({
    words: content.words,
    crafting: content.crafting || { progressiveGlow: true },
    onSpeakCarrier: ipa => { sfx.click(); speak(content.carriers[ipa], 'child'); },
    onCraft: word => run(kit.gameEvent(game, 'CRAFT', word)),
    onTakeItem: word => run(kit.gameEvent(game, 'HOLD_ITEM', word)),
    onDropItem: (word, cx, cy) => kit.onDropItem?.(w, word, cx, cy)
  });
  hb.show(); hb.refresh(game.inv);
  w.ui = ui; w.hb = hb;
  ui.updateHand(null);

  // —— 指令解释器（标准集 + kit 覆盖/扩展） ——
  function run(instructions) {
    for (const ins of instructions) {
      if (kit.runExtras?.[ins.t]) { kit.runExtras[ins.t](w, ins); continue; }
      switch (ins.t) {
        case 'speak': speak(ins.text, ins.who, ins.slow); break;
        case 'carrier': sfx.click(); speak(content.carriers[ins.ipa], 'child'); break;
        case 'hint': ui.setHint(ins.key); break;
        case 'beat': game.beat = ins.beat; break;
        case 'bank': sfx.itemIn(); hb.refresh(game.inv); break;
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
    saveProfile(localStorage, p);
    const day = el('summary').querySelector('.day');
    if (day) day.textContent = CHAPTER_DAY[kit.chapter] || '';
    ui.summary(game);
    const walk = el('btn-walk');
    const next = CHAPTER_NEXT[kit.chapter];
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
  function doE() {
    if (!eTarget) return;
    sfx.click();
    kit.onE(w, eTarget);
  }
  w.doE = doE;

  const keys = new Set();
  w.keys = keys;
  const KM = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
  addEventListener('keydown', e => {
    if (e.code === 'KeyE') { if (w.started && eTarget) doE(); return; }
    if (e.code === 'Space' && kit.onSpace) { e.preventDefault(); kit.onSpace(w); return; }
    if (KM[e.code]) { keys.add(KM[e.code]); kit.onKey?.(w, KM[e.code]); }
  });
  addEventListener('keyup', e => { if (KM[e.code]) keys.delete(KM[e.code]); });
  addEventListener('blur', () => keys.clear());
  cv.addEventListener('pointerdown', e => { if (w.started) kit.onPointerDown?.(w, e, cv); });

  // —— 主循环 ——
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (w.started) {
      kit.tick(w, dt);
      eTarget = kit.findE(w);
      run(kit.gameEvent(game, 'TICK', dt));
    }
    kit.draw(w, ctx, eTarget);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function begin() {
    w.started = true;
    window.__gameLoopOn = true;
    run(kit.startGame(game));
    kit.onBegin?.(w);
  }
  addEventListener('game:start', begin);

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
}
