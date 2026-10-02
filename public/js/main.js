// —— 回响之石 第一章：内容加载 + 事件机 + boot 主循环全接线 ——
import { INLINE_CONTENT } from './content-fallback.js';
import { createInventory, addStone, stoneCount, canConsume, consume, craftMatch,
         createHotbar, isVowel } from './hotbar.js';          // addStone 与 Task 7 行合并声明，防重复绑定
import { createDoor, doorEvent } from './door.js';
import { PAL, iconURL } from './art.js';
import { Speech, Sfx, pickVoices } from './audio.js';
import { LAYOUT, createScene, initScene, updateScene, drawScene, drawOverlay,
         screenToLogical, moveToward, resolveCollisions, makeStone, stepStone, magnetStep } from './scene.js';
import { createActors, updateActors, drawPlayer, drawNpc, drawCat, setGesture } from './actors.js';
import { createJournal } from './journal.js';
import { createUI } from './ui.js';
import { RITUAL_STEP, ritualSeats } from './door.js';

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
      if (!c.words[word] || g.inv.items.has(word)) return []; // 未知词/已持有：静默（Task 13 评审 D）
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
        if (def.effect === 'illuminate') { g.lit = true; g.beat = 'lit-right'; }
        if (def.effect === 'wear') g.hatOn = true;
        if (def.effect === 'bloom') g.bloomed = true;
        if (def.effect === 'ignite') g.torchesLit = true;
        if (def.effect === 'greet') g.greeted = true;
        if (def.effect === 'unlock') {
          // unlock 只在仪式成功瞬间烧 usedTargets（Task 13 评审 D：失败可重试，不算用过）
          const r = doorEvent(g.door, 'OFFER', 'open');
          if (r?.ritual) { g.usedTargets.add(target); return out.concat([{ t: 'ritualStart' }]); }
          return [{ t: 'mutter' }];
        }
        g.usedTargets.add(target);                            // 其余效果：首次即烧（重复使用=轻反应）
        out.push({ t: 'effect', name: def.effect, full: true });
        if (def.effect === 'illuminate') out.push({ t: 'hint', key: 'litUp' }, { t: 'beat', beat: 'lit-right' });
      } else {
        out.push({ t: 'effect', name: def.effect, full: false });
      }
      return out;
    }
    case 'DOOR_CLICK': {
      if (g.door.state === 'ritual' || g.door.state === 'opening') return []; // 仪式/开门期静默（Task 13 评审 D）
      const r = doorEvent(g.door, 'CLICK');
      if (!r) return [];
      const out = [{ t: 'speak', who: 'door', text: c.door.listen[0] }];
      if (r.dropOpenStones) out.push({ t: 'drop', word: 'open' }, { t: 'hint', key: 'door' });
      return out;
    }
    case 'RITUAL_DONE': {
      const r = doorEvent(g.door, 'RITUAL_DONE');
      if (!r) return [];                                    // 非仪式态重放：静默（防 G.jump 二次开门，评审 Fix 4）
      return [{ t: 'openAnim' }];
    }
    case 'OPEN_DONE': {
      const r = doorEvent(g.door, 'OPEN_DONE');
      if (!r) return [];                                    // 非开门态重放：静默（同上）
      g.beat = 'summary';
      return [{ t: 'summary' }];
    }
    case 'TICK': {
      if (['ritual', 'opening', 'opened'].includes(g.door.state) || g.beat === 'summary') return []; // 终局静默（Task 13 评审 D）
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

function boot() {
  const el = id => document.getElementById(id);
  const cv = el('game'), ctx = cv.getContext('2d');
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = LAYOUT.W * dpr; cv.height = LAYOUT.H * dpr;
  ctx.scale(dpr, dpr);
  const fitStage = () => {
    const s = Math.min(innerWidth / LAYOUT.W, innerHeight / LAYOUT.H);
    el('stage').style.width = `${LAYOUT.W * s}px`;
    el('stage').style.height = `${LAYOUT.H * s}px`;
  };
  fitStage();
  addEventListener('resize', fitStage);

  window.__errors = [];
  addEventListener('error', e => __errors.push(String(e.message)));
  addEventListener('unhandledrejection', e => __errors.push(String(e.reason)));

  loadContent().then(content => start(content));
}

function start(content) {
  const el = id => document.getElementById(id);
  const cv = el('game'), ctx = cv.getContext('2d');

  // —— 音频（首手势解锁）——
  const speech = new Speech(), sfx = new Sfx();
  let voices = { uncle: null, child: null, door: null };
  const scanVoices = () => {
    if (speech.ready) voices = pickVoices(speechSynthesis.getVoices());
  };
  scanVoices();
  if (speech.ready) speechSynthesis.addEventListener('voiceschanged', scanVoices);
  addEventListener('pointerdown', () => sfx.ctx?.resume(), { once: true }); // 任意首手势解锁音频（含 autostart 路径，评审 Fix 4）

  let speechChain = Promise.resolve();                       // 语音串行
  function speak(text, who = 'uncle', slow = false) {
    const conf = {
      uncle: { voice: voices.uncle, pitch: 0.9, rate: slow ? 0.7 : 0.95 },
      child: { voice: voices.child, pitch: 1.25, rate: slow ? 0.8 : 1 },
      door:  { voice: voices.door, pitch: 0.7, rate: slow ? 0.6 : 0.8 }
    }[who];
    const npcMouth = who === 'uncle' ? () => { actors.npc.mouth = 1; } : null;
    speechChain = speechChain.then(() => speech.speak(text, { ...conf, onPulse: npcMouth }))
      .catch(() => {});
    if (who === 'uncle') {
      if (slow) setGesture(actors.npc, 'point');
      else if (/hello/i.test(text)) setGesture(actors.npc, 'wave');
    }
    return speechChain;
  }

  // —— 世界对象 ——
  const game = createGame(content);
  const actors = createActors();
  const sc = createScene(); initScene(sc);
  const stones = [];                                          // 场上音素石
  const view = { t: 0, lit: 0, doorState: 'asleep', doorPulse: 0, doorOpen: 0,
                 torchesLit: false, bloomed: false, hatOn: false };
  const ritual = { active: false, t: 0, seated: 0 };
  let walkTarget = null, pendingInteract = null, started = false;
  let lastPX = 0, lastPY = 0, stuckT = 0;                    // 走位卡死检测（评审 Fix 2）

  const ui = createUI({ content });
  const journal = createJournal({
    content,
    speakWord: w => speak(w[0].toUpperCase() + w.slice(1) + '.', 'child'),
    speakCarrier: ipa => speak(content.carriers[ipa], 'child')
  });
  const hb = createHotbar({
    words: content.words,
    crafting: content.crafting,                               // Task 13 评审 C：合成配置透传
    onSpeakCarrier: ipa => { sfx.click(); speak(content.carriers[ipa], 'child'); },
    onSpeakWord: w => { sfx.click(); speak(w[0].toUpperCase() + w.slice(1) + '.', 'child'); },
    onCraft: word => run(gameEvent(game, 'CRAFT', word)),
    onDropItem: (word, cx, cy) => {
      const p = screenToLogical(cx, cy, cv.getBoundingClientRect());
      if (!p.inside) return;
      const target = hitUseTarget(p, word);
      run(gameEvent(game, 'USE', { word, target }));
    }
  });

  // —— 词具落点：目标命中（含「自己」）——
  function hitUseTarget(p, word) {
    const want = content.words[word].use.target;
    if (want === 'player') return Math.hypot(p.x - actors.player.x, p.y - actors.player.y) < 90 ? 'player' : null;
    if (want === 'npc') return Math.hypot(p.x - LAYOUT.targets.npc.x, p.y - LAYOUT.targets.npc.y) < 90 ? 'npc' : null;
    const t = LAYOUT.targets[want];
    if (t && Math.hypot(p.x - t.x, p.y - t.y) < t.r) {
      if (want !== 'player' && want !== 'npc' && t.x > 800 && !game.lit) return null; // 暗区目标未点亮不接词具（规格 §6.2，评审 Fix 5）
      return want;
    }
    return null;
  }

  // —— 掉石 ——
  function spawnDrop(word) {
    const src = Object.values(content.explorables).find(e => e.word === word);
    const [dx, dy] = src ? src.drop : [1145, 460];            // 门词（open）无探索点：四石从门符文处掉落
    const phon = content.words[word].phonemes;
    phon.forEach(([ipa], i) => stones.push(makeStone(ipa, dx, dy, i * 0.13)));
    stones.slice(-phon.length).forEach((s, i) => { s.floorY = dy + 26 + (i % 3) * 16; });
  }

  // —— 指令解释器（Task 7 词汇表）——
  function run(instructions) {
    for (const ins of instructions) {
      switch (ins.t) {
        case 'speak': speak(ins.text, ins.who, ins.slow); break;
        case 'drop': spawnDrop(ins.word); break;
        case 'hint': ui.setHint(ins.key); break;
        case 'beat': game.beat = ins.beat; break;             // G.beat 是 getter（直读 game.beat），无需镜像
        case 'hotbarShow': hb.show(); sfx.chime(); break;
        case 'bagPulse': hb.pulseBag(game.stonesPicked); break;
        case 'resonate': sfx.resonate(); hb.refresh(game.inv); break;
        case 'itemIn': sfx.itemIn(); hb.refresh(game.inv); break;
        case 'doorAwake': sfx.glowTick(); break;
        case 'mutter': sfx.mutter(); break;
        case 'cat': sfx.meow(); actors.cat.earT = 1; actors.cat.meowT = 0.6; break;
        case 'blocked': setGesture(actors.npc, 'tilt', 1.2); break;
        case 'pointHotbar': setGesture(actors.npc, 'point', 2); break;
        case 'effect': applyEffect(ins.name, ins.full); break;
        case 'ritualStart': startRitual(); break;
        case 'openAnim': openDoor(); break;
        case 'summary': ui.summary(game); break;
      }
    }
  }

  function applyEffect(name, full) {
    if (name === 'illuminate') {
      if (full) { sfx.sweepUp(); view.lit = 1; setGesture(actors.npc, 'laugh', 2); actors.cat.earT = 1; }
      else sfx.glowTick();
    } else if (name === 'bloom') {
      if (full) { sfx.water(); setTimeout(() => sfx.bloom(), 300); view.bloomed = true; actors.cat.earT = 1; }
      else sfx.water();
    } else if (name === 'ignite') {
      if (full) { sfx.ignite(); view.torchesLit = true; }
      else sfx.crackle();
    } else if (name === 'wear') {
      sfx.hatPuff(); actors.player.hatOn = true; view.hatOn = true; actors.cat.earT = 1;
    } else if (name === 'greet') {
      if (full) { sfx.laugh(); setGesture(actors.npc, 'laugh', 1.8); }
      else setGesture(actors.npc, 'wave', 1.2);
    } else if (name === 'unlock') {                           // Task 13 评审 A：重复 open=门后风声（首次走 ritualStart）
      if (!full) sfx.wind();
    }
  }

  // —— 门仪式：四石绕拱依次咏亮 → Open. → Open! → 揭示卡 → 开门（规格 §3.1 节拍 12）——
  function startRitual() {
    ritual.active = true; ritual.t = 0; ritual.seated = 0;
    sfx.glowTick();
    const seats = ritualSeats(content.door.ipa.length);
    const ritualStones = content.door.ipa.map((ipa, i) => makeStone(ipa, 1145, 460, 0));
    ritualStones.forEach((s, i) => {
      s.state = 'idle'; s.from = { x: 1145, y: 460 }; s.to = { x: seats[i][0], y: seats[i][1] }; s.at = i * RITUAL_STEP;
      stones.push(s);
    });
    setTimeout(() => speak('Open.', 'door', true), RITUAL_STEP * 4 * 1000 * 0.5);
    setTimeout(() => speak('Open!', 'child'), RITUAL_STEP * 4 * 1000 * 0.85);
    setTimeout(async () => {
      await ui.reveal('open');
      run(gameEvent(game, 'RITUAL_DONE'));
    }, RITUAL_STEP * 4 * 1000 + 900);
  }

  function openDoor() {
    sfx.creak();
    const t0 = performance.now();
    const anim = () => {
      const k = Math.min(1, (performance.now() - t0) / 1400);
      view.doorOpen = k;
      if (k >= 1) {
        for (let i = stones.length - 1; i >= 0; i--) if (stones[i].to) stones.splice(i, 1);  // 仪式石谢幕，不再参与磁吸
        sfx.choir();
        run(gameEvent(game, 'OPEN_DONE'));
        return;
      }
      requestAnimationFrame(anim);
    };
    setTimeout(anim, 400);
  }

  // —— 输入 ——
  const keys = new Set();
  const KEYMAP = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
  addEventListener('keydown', e => {
    if (e.code === 'KeyB') { journal.toggle(game); return; }
    if (e.code === 'Escape') { journal.close(); return; }
    if (KEYMAP[e.code]) { keys.add(KEYMAP[e.code]); walkTarget = null; pendingInteract = null; }
  });
  addEventListener('keyup', e => { if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]); });
  addEventListener('blur', () => keys.clear());              // 失焦清键：防 alt-tab 卡键（评审 Fix 4）

  cv.addEventListener('pointerdown', e => {
    if (!started) return;
    if (e.target.closest('#hotbar') || e.target.closest('.screen')) return;
    const p = screenToLogical(e.clientX, e.clientY, cv.getBoundingClientRect());
    if (!p.inside) return;
    const hit = hitSceneTarget(p);
    if (!hit) { walkTarget = { x: Math.max(40, Math.min(LAYOUT.W - 40, p.x)), y: clampY(p.y) }; pendingInteract = null; return; }
    if (near(hit)) { interact(hit.id); return; }
    walkTarget = approach(hit); pendingInteract = hit.id;
  });

  function clampY(y) { return Math.max(340, Math.min(700, y)); }
  function near(t) { return Math.hypot(actors.player.x - t.x, actors.player.y - t.y) < LAYOUT.INTERACT_R; }
  function approach(t) {
    const dx = actors.player.x - t.x, dy = actors.player.y - t.y, d = Math.hypot(dx, dy) || 1;
    return { x: Math.max(40, Math.min(LAYOUT.W - 40, t.x + (dx / d) * 120)),
             y: Math.max(340, Math.min(LAYOUT.H - 20, t.y + (dy / d) * 120)) };   // 落点钳回房间（评审 Fix 2）
  }
  // cat 不在 LAYOUT.targets（只登记在障碍表）：点击/走位交互统一经此解析（点击半径放宽到 40）
  function targetOf(id) {
    if (id === 'cat') { const o = LAYOUT.obstacles.find(o => o.id === 'cat'); return o ? { x: o.x, y: o.y, r: 40 } : null; }
    return LAYOUT.targets[id] || null;
  }
  function hitSceneTarget(p) {
    const ids = ['door', 'hatstand', 'lamp', 'brazier', 'well', 'sprout', 'cat', 'npc'];
    for (const id of ids) {
      const t = targetOf(id);
      if (!t) continue;
      if (p.x > 800 && !game.lit && id !== 'lamp') continue;          // 暗区不可交互（规格 §6.2）
      if (Math.hypot(p.x - t.x, p.y - t.y) < t.r) return { id, x: t.x, y: t.y };
    }
    return null;
  }
  function interact(id) {
    sfx.click();
    if (id === 'door') run(gameEvent(game, 'DOOR_CLICK'));
    else run(gameEvent(game, 'INTERACT', id));
  }

  // —— 主循环 ——
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    view.t += dt;
    view.doorState = game.door.state;
    view.doorPulse = (Math.sin(view.t * 2.4) + 1) / 2;
    updateScene(sc, dt, game.lit ? 1 : 0);                   // Task 13 评审 G：先推进光照缓动……
    view.lit = sc.lit;                                       // ……再采样：drawScene/drawOverlay 同帧同值
    updateActors(actors, dt);

    // 移动
    const p = actors.player;
    let moved = false;
    if (keys.size) {
      const sp = 220 * dt;
      if (keys.has('l')) { p.x -= sp; p.facing = -1; moved = true; }
      if (keys.has('r')) { p.x += sp; p.facing = 1; moved = true; }
      if (keys.has('u')) { p.y -= sp; moved = true; }
      if (keys.has('d')) { p.y += sp; moved = true; }
      resolveCollisions(p);
    } else if (walkTarget) {
      const arrived = moveToward(p, walkTarget, 220, dt);
      resolveCollisions(p);
      moved = true;
      if (pendingInteract) {
        const t = targetOf(pendingInteract);
        if (arrived || (t && Math.hypot(p.x - t.x, p.y - t.y) < LAYOUT.INTERACT_R)) {
          const done = pendingInteract;
          walkTarget = null; pendingInteract = null;
          if (t && Math.hypot(p.x - t.x, p.y - t.y) < LAYOUT.INTERACT_R) interact(done);
        }
      } else if (arrived) walkTarget = null;
      // 防走位死锁：位移可忽略持续 0.6s 则放弃（障碍重叠/不可达点）
      if (walkTarget) {
        const disp = Math.hypot(p.x - lastPX, p.y - lastPY);
        stuckT = disp < 1 ? stuckT + dt : 0;
        if (stuckT > 0.6) { walkTarget = null; pendingInteract = null; stuckT = 0; }
      }
      lastPX = p.x; lastPY = p.y;
    }
    p.moving = moved;
    if (moved) p.walkT += dt;

    // 音素石：物理 + 磁吸拾取
    for (let i = stones.length - 1; i >= 0; i--) {
      const s = stones[i];
      if (s.to) continue;                              // 仪式石永不参与物理/磁吸（揭示卡等待期防盗取，评审 Fix 1）
      stepStone(s, dt, s.floorY ?? 660);
      if (magnetStep(s, p, dt)) {
        stones.splice(i, 1);
        sfx.chime();
        run(gameEvent(game, 'PICKUP', s.ipa));
      }
    }
    if (ritual.active) {
      ritual.t += dt;
      const should = Math.min(ritualSeats().length, Math.floor(ritual.t / RITUAL_STEP) + 1);
      while (ritual.seated < should && ritual.seated < content.door.ipa.length) {
        ritual.seated++;
        sfx.glowTick();
      }
      if (ritual.t > RITUAL_STEP * 4 + 1) ritual.active = false;
    }

    if (started) run(gameEvent(game, 'TICK', dt));

    // —— 绘制 ——
    ctx.clearRect(0, 0, LAYOUT.W, LAYOUT.H);
    drawScene(ctx, sc, view);
    const byY = [['npc', actors.npc.y], ['cat', actors.cat.y], ['player', actors.player.y]].sort((a, b) => a[1] - b[1]);
    for (const [who] of byY) {
      if (who === 'npc') drawNpc(ctx, actors.npc, view.t);
      if (who === 'cat') drawCat(ctx, actors.cat, view.t);
      if (who === 'player') drawPlayer(ctx, actors.player, view.t);
    }
    for (const s of stones) if (!s.to) drawStone(ctx, s, view.t);   // 仪式石只由 drawRitualStones 画（评审 Fix 1）
    drawOverlay(ctx, sc, view);
    if (ritual.active || view.doorOpen > 0) drawRitualStones(ctx);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function drawStone(x, s, t) {
    const bob = s.state === 'idle' ? Math.sin(t * 2.2 + s.phase) * 3 : 0;
    const y = s.y + bob;
    x.save();
    x.translate(s.x, y);
    x.fillStyle = isVowel(s.ipa) ? PAL.vowel : PAL.cons;
    x.beginPath(); x.arc(0, 0, 15, 0, 7); x.fill();
    x.lineWidth = 3.5; x.strokeStyle = PAL.ink; x.stroke();
    x.strokeStyle = 'rgba(255,255,255,' + (0.35 + Math.abs(Math.sin(t * 3 + s.phase)) * 0.4) + ')';
    x.beginPath(); x.arc(0, 0, 18, 0, 7); x.stroke();       // 静止后描边闪烁（规格 §3.1 节拍 6）
    x.fillStyle = PAL.ink;
    x.font = 'bold 13px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(s.ipa, 0, 1);
    x.restore();
  }

  function drawRitualStones(x) {
    const seats = ritualSeats();
    stones.filter(s => s.to).forEach((s, i) => {
      const k = ritual.active ? Math.min(1, Math.max(0, (ritual.t - s.at) / 0.5)) : 1;
      const sx = s.from.x + (s.to.x - s.from.x) * k + Math.sin(view.t * 6 + i) * (1 - k) * 30;
      const sy = s.from.y + (s.to.y - s.from.y) * k + Math.cos(view.t * 6 + i) * (1 - k) * 30;
      x.save();
      x.translate(sx, sy);
      x.shadowColor = PAL.glowRune; x.shadowBlur = 18;
      x.fillStyle = isVowel(s.ipa) ? PAL.vowel : PAL.cons;
      x.beginPath(); x.arc(0, 0, 14, 0, 7); x.fill();
      x.shadowBlur = 0;
      x.lineWidth = 3; x.strokeStyle = PAL.ink; x.stroke();
      x.fillStyle = PAL.ink; x.font = 'bold 12px system-ui';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(s.ipa, 0, 1);
      x.restore();
    });
    seats.forEach(([qx, qy], j) => {                        // 已落座座位发青光（移出石循环：单层 0.25，防 4× 叠加，评审 Fix 3）
      if (j < ritual.seated) {
        x.fillStyle = 'rgba(84,224,200,.25)';
        x.beginPath(); x.arc(qx, qy, 20, 0, 7); x.fill();
      }
    });
  }

  // —— 开始/调试 ——
  function begin() {
    started = true;
    window.__gameLoopOn = true;
    hb.refresh(game.inv);
    run(startGame(game));
  }
  addEventListener('game:start', begin);
  window.G = {
    content,
    get beat() { return game.beat; },                        // 调试直读；写态经 G.game
    jump(b) {
      started = true; window.__gameLoopOn = true;
      run(jump(game, b).filter(i => i.t !== 'drop'));        // Task 13 评审 B：drop 已被虚拟拾取，过滤防磁吸双收
      hb.refresh(game.inv); hb.show();
      if (game.stonesPicked) hb.pulseBag(game.stonesPicked);
    },
    game
  };
  if (new URLSearchParams(location.search).get('autostart') === '1') {
    el('title').classList.add('hidden');
    dispatchEvent(new CustomEvent('game:start'));
    G.jump('hello-meet');
  } else {
    el('title').classList.remove('hidden');                  // HTML 初始 hidden：正常路径先亮标题屏
    el('btn-start').addEventListener('click', () => {
      el('title').classList.add('hidden');
      el('prologue').classList.remove('hidden');
      el('prologue').addEventListener('click', () => {
        el('prologue').classList.add('hidden');
        dispatchEvent(new CustomEvent('game:start'));
      }, { once: true });
    }, { once: true });
  }
}

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', boot);
