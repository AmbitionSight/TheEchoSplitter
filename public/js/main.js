// —— 启动壳：内容加载 + 舞台缩放 + 标题/序章（主循环在后续任务接入）——
import { INLINE_CONTENT } from './content-fallback.js';
import { createInventory, addStone, stoneCount, canConsume, consume, craftMatch } from './hotbar.js';
import { createDoor, doorEvent } from './door.js';

export async function loadContent() {
  try {
    const res = await fetch('/api/chapter1');
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch { return INLINE_CONTENT; } // 规格 §12：兜底，保证可玩
}

const cap = w => w[0].toUpperCase() + w.slice(1) + '.';

// —— 游戏状态机（纯逻辑，规格 §3/§4；指令表见计划）——
export function createGame(content) {
  return {
    content, beat: 'hello-listen',
    book: new Set(), touched: new Set(),
    inv: createInventory(),
    stonesPicked: 0, lit: false,
    door: createDoor(), usedTargets: new Set(),
    hatOn: false, torchesLit: false, bloomed: false, greeted: false,
    teaseClock: 0
  };
}

export function startGame(g) {
  g.beat = 'hello-listen';
  return [
    { t: 'speak', who: 'uncle', text: g.content.explorables.npc.lines[0] },
    { t: 'hint', key: 'hello' }
  ];
}

export function chooseTease(g) {
  const c = g.content;
  for (const [id, ex] of Object.entries(c.explorables)) {
    if (id === 'npc' || g.touched.has(id)) continue;
    if (ex.requires === 'lit' && !g.lit) continue;
    return { kind: 'word', word: ex.word };
  }
  for (const w of Object.keys(c.words)) {
    if (g.inv.items.has(w)) continue;
    if (canConsume(g.inv, c.words[w].phonemes.map(p => p[0]))) return { kind: 'craft', word: w };
  }
  if ((g.door.state === 'pulsing' || g.door.state === 'whispered') && !g.inv.items.has('open')) return { kind: 'door' };
  return null;
}

function teaseOut(g) {
  const c = g.content;
  const tease = chooseTease(g);
  if (!tease) return [{ t: 'speak', who: 'uncle', text: c.explorables.npc.lines[0] }];
  if (tease.kind === 'word') return [{ t: 'speak', who: 'uncle', text: c.npcTease[tease.word], slow: true }];
  if (tease.kind === 'door') return [{ t: 'speak', who: 'uncle', text: c.door.listen[0], slow: true }];
  return [{ t: 'speak', who: 'uncle', text: cap(tease.word), slow: true }, { t: 'pointHotbar' }];
}

// 词入书后统一查醒门：hello 经首点入书、其余经合成入书，两条路径都必须立即唤醒（Task 6 评审修正）
function checkDoorAwake(g, out) {
  if (!g.door.dropped && g.book.size >= 5 && g.door.state === 'asleep') {
    doorEvent(g.door, 'WORDS_COMPLETE', g.book.size);
    out.push({ t: 'doorAwake' }, { t: 'hint', key: 'doorAwake' }, { t: 'beat', beat: 'door-awake' });
  }
}

export function gameEvent(g, ev, arg = null) {
  const c = g.content;
  switch (ev) {
    case 'INTERACT': {
      const id = arg;
      if (id === 'cat') return [{ t: 'cat' }];
      if (id === 'npc') {
        if (!g.touched.has('npc')) {
          g.touched.add('npc');
          g.book.add('hello');                                  // 词入书时机①：hello=首点大叔
          g.beat = 'explore-left';
          const out = [
            { t: 'speak', who: 'uncle', text: c.explorables.npc.linesFirst[0] },
            { t: 'drop', word: 'hello' },
            { t: 'hint', key: 'explore' },
            { t: 'beat', beat: 'explore-left' }
          ];
          checkDoorAwake(g, out);                               // hello=第5词时也在首点瞬间立即醒门
          return out;
        }
        return teaseOut(g);
      }
      const ex = c.explorables[id];
      if (!ex) return [];
      if (ex.requires === 'lit' && !g.lit) return [{ t: 'blocked', id }];
      if (!g.touched.has(id)) {
        g.touched.add(id);
        return [
          { t: 'speak', who: 'uncle', text: ex.lines[0] },
          { t: 'drop', word: ex.word }
        ];
      }
      return [{ t: 'speak', who: 'uncle', text: ex.lines[0] }];
    }
    case 'PICKUP': {
      addStone(g.inv, arg);
      g.inv.everPicked.add(arg);
      g.stonesPicked++;
      const out = [{ t: 'bagPulse' }];
      if (g.stonesPicked === 1) {
        g.beat = 'first-stone';
        out.push({ t: 'hotbarShow' }, { t: 'hint', key: 'firstStone' }, { t: 'beat', beat: 'first-stone' });
      }
      return out;
    }
    case 'CRAFT': {
      const word = arg;
      if (g.inv.items.has(word)) return [];
      const phon = c.words[word].phonemes.map(p => p[0]);
      if (!canConsume(g.inv, phon)) return [];
      consume(g.inv, phon);
      g.inv.items.set(word, true);
      g.book.add(word);                                         // 词入书时机②：其余词=合成成功
      const out = [
        { t: 'resonate', word },
        { t: 'speak', who: 'child', text: cap(word) },
        { t: 'itemIn', word }
      ];
      checkDoorAwake(g, out);
      if (word === 'open') out.push({ t: 'hint', key: 'door' });
      return out;
    }
    case 'USE': {
      const { word, target } = arg;
      const def = c.words[word]?.use;
      if (!def || target !== def.target) return [{ t: 'mutter' }];
      const full = !g.usedTargets.has(target);
      const out = [{ t: 'speak', who: 'child', text: cap(word) }];
      if (full) {
        g.usedTargets.add(target);
        if (def.effect === 'illuminate') { g.lit = true; g.beat = 'lit-right'; }
        if (def.effect === 'wear') g.hatOn = true;
        if (def.effect === 'bloom') g.bloomed = true;
        if (def.effect === 'ignite') g.torchesLit = true;
        if (def.effect === 'greet') g.greeted = true;
        if (def.effect === 'unlock') {
          const r = doorEvent(g.door, 'OFFER', 'open');
          if (r?.ritual) return out.concat([{ t: 'ritualStart' }]);
          return [{ t: 'mutter' }];
        }
        out.push({ t: 'effect', name: def.effect, full: true });
        if (def.effect === 'illuminate') out.push({ t: 'hint', key: 'litUp' }, { t: 'beat', beat: 'lit-right' });
      } else {
        out.push({ t: 'effect', name: def.effect, full: false });
      }
      return out;
    }
    case 'DOOR_CLICK': {
      const r = doorEvent(g.door, 'CLICK');
      if (!r) return [];
      const out = [{ t: 'speak', who: 'door', text: c.door.listen[0] }];
      if (r.dropOpenStones) out.push({ t: 'drop', word: 'open' }, { t: 'hint', key: 'door' });
      return out;
    }
    case 'RITUAL_DONE': {
      doorEvent(g.door, 'RITUAL_DONE');
      return [{ t: 'openAnim' }];
    }
    case 'OPEN_DONE': {
      doorEvent(g.door, 'OPEN_DONE');
      g.beat = 'summary';
      return [{ t: 'summary' }];
    }
    case 'TICK': {
      g.teaseClock += arg;
      if (g.teaseClock < 45) return [];
      g.teaseClock = 0;
      return teaseOut(g);
    }
    default:
      return [];
  }
}

// —— 调试跳拍（?autostart + G.jump，规格 §11.7）——
export function jump(g, beat) {
  const c = g.content;
  const doWord = word => {
    const found = Object.entries(c.explorables).find(([, ex]) => ex.word === word);
    let out = gameEvent(g, 'INTERACT', found?.[0]);            // 门词（open）无探索点：INTERACT 未知 id 返回 []（设计如此）
    for (const [ipa] of c.words[word].phonemes) out = out.concat(gameEvent(g, 'PICKUP', ipa));
    return out.concat(gameEvent(g, 'CRAFT', word));
  };
  switch (beat) {
    case 'hello-meet': return doWord('hello');
    case 'explore-left': return [];
    case 'lit-right': {
      let out = [];
      for (const w of ['hello', 'water', 'fire', 'light']) out = out.concat(doWord(w));
      return out.concat(gameEvent(g, 'USE', { word: 'light', target: 'lamp' }));
    }
    case 'door-awake':
      return jump(g, 'lit-right').concat(doWord('hat'), gameEvent(g, 'DOOR_CLICK'));
    case 'door-open':
      return jump(g, 'door-awake').concat(doWord('open'), gameEvent(g, 'USE', { word: 'open', target: 'door' }), gameEvent(g, 'RITUAL_DONE'));
    case 'summary':
      return jump(g, 'door-open').concat(gameEvent(g, 'OPEN_DONE'));
    default:
      return [];
  }
}

function fitStage(stage) {
  const s = Math.min(innerWidth / 1280, innerHeight / 720);
  stage.style.width = `${1280 * s}px`;
  stage.style.height = `${720 * s}px`;
}

function boot() {
  const $ = id => document.getElementById(id);
  const stage = $('stage');
  fitStage(stage);
  addEventListener('resize', () => fitStage(stage));

  const params = new URLSearchParams(location.search);
  loadContent().then(content => {
    window.G = { content, beat: 'title' };
    if (params.get('autostart') === '1') {
      $('title').classList.add('hidden');
      dispatchStart(); return;
    }
    $('title').classList.remove('hidden');
    $('btn-start').addEventListener('click', () => {
      $('title').classList.add('hidden');
      dispatchStart();
    }, { once: true });
  });

  function dispatchStart() {
    // 序章 → game:start（Task 13 由主循环接管；现在的临时监听只报开发提示）
    const pro = $('prologue');
    pro.classList.remove('hidden');
    const go = () => { pro.classList.add('hidden'); pro.removeEventListener('click', go); dispatchEvent(new CustomEvent('game:start')); };
    pro.addEventListener('click', go);
    addEventListener('game:start', () => {
      const toast = $('toast');
      if (!window.__gameLoopOn) { toast.textContent = '（主循环未接入：Task 13 接线）'; toast.classList.remove('hidden'); }
    }, { once: true });
  }
}

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', boot);
