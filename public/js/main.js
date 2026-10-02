// —— 回响之石 第一章 v2：E 键手持交互（hello 教学 + open 开关主线）——
import { INLINE_CONTENT } from './content-fallback.js';
import { createInventory, addStone, stoneCount, canConsume, consume, craftMatch,
         createHotbar, isVowel } from './hotbar.js';
import { createDoor, doorEvent } from './door.js';

export async function loadContent() {
  try {
    const res = await fetch('/api/chapter1');
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch { return INLINE_CONTENT; } // 规格 §12：兜底，保证可玩
}

const cap = w => w[0].toUpperCase() + w.slice(1) + '.';

// —— 游戏状态机 v2（纯逻辑；指令表见 boot 的 run 解释器）——
export function createGame(content) {
  return {
    content, beat: 'hello-listen',
    book: new Set(),
    inv: createInventory(),
    stonesPicked: 0, lit: false,
    hand: null,                        // {kind:'stone',ipa} | {kind:'item',word} | null
    door: createDoor(), usedTargets: new Set(),
    helloDropped: false, switchOn: false,
    teaseClock: 0
  };
}

export function startGame(g) {
  g.beat = 'hello-listen';
  return [
    { t: 'speak', who: 'uncle', text: g.content.flows.hello.lines[0] },
    { t: 'hint', key: 'hello' },
    { t: 'beat', beat: 'hello-listen' }
  ];
}

// 卡关提示 v2：hello 未拼 → 开关未按 → open 未拼 → 拿着开关去门
export function chooseTease(g) {
  if (!g.book.has('hello')) return g.helloDropped ? { kind: 'hint', key: 'hand' } : { kind: 'hello' };
  if (!g.switchOn) return { kind: 'hint', key: 'switch' };
  if (!g.inv.items.has('open')) return { kind: 'hint', key: 'craft' };
  return { kind: 'hint', key: 'openItem' };
}

function teaseOut(g) {
  const c = g.content;
  const tease = chooseTease(g);
  if (!tease) return [];
  if (tease.kind === 'hello') return [{ t: 'speak', who: 'uncle', text: c.flows.hello.lines[0], slow: true }];
  return [{ t: 'speak', who: 'uncle', text: c.flows.hello.lines[0], slow: true }, { t: 'hint', key: tease.key }];
}

export function gameEvent(g, ev, arg = null) {
  const c = g.content;
  switch (ev) {
    case 'INTERACT': {
      const id = arg;
      if (id === 'cat') return [{ t: 'cat' }];
      if (c.ambience[id]) return [{ t: 'sfx', name: c.ambience[id].sfx }];
      if (id === 'npc') {
        if (g.hand?.kind === 'item' && g.hand.word === 'hello') {
          return gameEvent(g, 'USE', { word: 'hello', target: 'npc' });
        }
        if (!g.helloDropped) {
          g.helloDropped = true;
          return [
            { t: 'speak', who: 'uncle', text: c.flows.hello.linesFirst[0] },
            { t: 'drop', word: 'hello' },
            { t: 'hint', key: 'hand' },
            { t: 'beat', beat: 'explore' }
          ];
        }
        return [{ t: 'speak', who: 'uncle', text: c.flows.hello.lines[0] }];
      }
      if (id === 'switch') {
        if (!g.switchOn) {
          g.switchOn = true; g.lit = true;
          return [
            { t: 'sfx', name: 'clack' },
            { t: 'speak', who: 'door', text: c.flows.open.listen[0] },
            { t: 'illuminate' },
            { t: 'drop', word: 'open' },
            { t: 'hint', key: 'litUp' },
            { t: 'beat', beat: 'lit' }
          ];
        }
        return [{ t: 'sfx', name: 'glowTick' }, { t: 'speak', who: 'door', text: c.flows.open.listen[0] }];
      }
      return [];
    }
    case 'PICKUP': {                    // E 拾地面石 → 手上（纯手持制，一次一块）
      const ipa = arg;
      const out = [];
      if (g.hand?.kind === 'stone') out.push({ t: 'dropBack', ipa: g.hand.ipa }); // 旧石放回地面
      g.hand = { kind: 'stone', ipa };
      g.inv.everPicked.add(ipa);
      g.stonesPicked++;
      out.push({ t: 'carrier', ipa }, { t: 'hand' }, { t: 'bagPulse' });
      if (g.stonesPicked === 1) out.push({ t: 'hotbarShow' }, { t: 'hint', key: 'bench' }, { t: 'beat', beat: 'first-stone' });
      return out;
    }
    case 'HOLD_ITEM': {                 // 点物品栏词具 → 拿到手上
      const word = arg;
      if (!g.inv.items.has(word)) return [];
      g.hand = { kind: 'item', word };
      return [{ t: 'speak', who: 'child', text: cap(word) }, { t: 'hand' },
              { t: 'hint', key: word === 'open' ? 'openItem' : 'helloGive' }];
    }
    case 'BANK': {                      // 合成台：手上的石存入底部物品栏
      if (g.hand?.kind !== 'stone') return [];
      const ipa = g.hand.ipa;
      g.hand = null;
      addStone(g.inv, ipa);
      return [{ t: 'bank', ipa }, { t: 'hand' }];
    }
    case 'CRAFT': {
      const word = arg;
      if (!c.words[word] || g.inv.items.has(word)) return [];
      const phon = c.words[word].phonemes.map(p => p[0]);
      if (!canConsume(g.inv, phon)) return [];
      consume(g.inv, phon);
      g.inv.items.set(word, true);
      g.book.add(word);
      const out = [
        { t: 'resonate', word },
        { t: 'speak', who: 'child', text: cap(word) },
        { t: 'itemIn', word }
      ];
      if (word === 'hello') out.push({ t: 'hint', key: 'helloGive' });   // 拿着气泡去见大叔
      if (word === 'open') out.push({ t: 'hint', key: 'openItem' });
      return out;
    }
    case 'USE': {
      const { word, target } = arg;
      const def = c.words[word]?.use;
      if (!def || target !== def.target) return [{ t: 'mutter' }];
      if (def.effect === 'unlock') {
        const r = doorEvent(g.door, 'OFFER', 'open');
        if (r?.ritual) {
          g.usedTargets.add(target); g.hand = null;
          return [{ t: 'speak', who: 'child', text: cap(word) }, { t: 'hand' }, { t: 'ritualStart' }];
        }
        return [{ t: 'mutter' }];
      }
      const full = !g.usedTargets.has(target);          // greet
      const out = [{ t: 'speak', who: 'child', text: cap(word) }];
      if (full) {
        g.usedTargets.add(target);
        out.push({ t: 'effect', name: 'greet', full: true });
        if (!g.switchOn) out.push({ t: 'hint', key: 'helloDone' });      // 大叔回礼 → 指向发光开关
      }
      else out.push({ t: 'effect', name: 'greet', full: false });
      return out;
    }
    case 'RITUAL_DONE': {
      const r = doorEvent(g.door, 'RITUAL_DONE');
      if (!r) return [];
      return [{ t: 'openAnim' }];
    }
    case 'OPEN_DONE': {
      const r = doorEvent(g.door, 'OPEN_DONE');
      if (!r) return [];
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

function collect(g, word) {              // 调试用：掉落→逐块 E 拾取→合成台存入→合成（幂等）
  if (g.inv.items.has(word)) return [];
  let out = [];
  const src = word === 'hello' ? 'npc' : 'switch';
  out = out.concat(gameEvent(g, 'INTERACT', src));
  for (const [ipa] of g.content.words[word].phonemes) {
    out = out.concat(gameEvent(g, 'PICKUP', ipa));
    out = out.concat(gameEvent(g, 'BANK'));
  }
  return out.concat(gameEvent(g, 'CRAFT', word));
}

// —— 调试跳拍（?autostart=1 + G.jump）——
export function jump(g, beat) {
  switch (beat) {
    case 'hello-meet': return gameEvent(g, 'INTERACT', 'npc');
    case 'hello': return collect(g, 'hello');
    case 'lit': return jump(g, 'hello').concat(gameEvent(g, 'INTERACT', 'switch'));
    case 'door-open':
      return jump(g, 'lit').concat(collect(g, 'open'), gameEvent(g, 'USE', { word: 'open', target: 'door' }), gameEvent(g, 'RITUAL_DONE'));
    case 'summary':
      return jump(g, 'door-open').concat(gameEvent(g, 'OPEN_DONE'));
    default:
      return [];
  }
}

// ================= boot：DOM 接线（浏览器） =================
import { PAL } from './art.js';
import { Speech, Sfx, pickVoices } from './audio.js';
import { LAYOUT, createScene, initScene, updateScene, drawScene, drawOverlay,
         screenToLogical, moveToward, resolveCollisions, makeStone, stepStone } from './scene.js';
import { createActors, updateActors, drawPlayer, drawNpc, drawCat, setGesture } from './actors.js';
import { createUI } from './ui.js';
import { RITUAL_STEP, ritualSeats } from './door.js';

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

  // —— 音频 ——
  const speech = new Speech(), sfx = new Sfx();
  let voices = { uncle: null, child: null, door: null };
  const scanVoices = () => {
    if (speech.ready) voices = pickVoices(speechSynthesis.getVoices());
  };
  scanVoices();
  if (speech.ready) speechSynthesis.addEventListener('voiceschanged', scanVoices);
  addEventListener('pointerdown', () => sfx.ctx?.resume(), { once: true });

  let speechChain = Promise.resolve();
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

  // —— 世界 ——
  const game = createGame(content);
  const actors = createActors();
  const sc = createScene(); initScene(sc);
  const stones = [];
  const view = { t: 0, lit: 0, doorState: 'closed', doorPulse: 0, doorOpen: 0,
                 torchesLit: false, bloomed: false, hatOn: false, switchOn: false };
  const ritual = { active: false, t: 0, seated: 0 };
  let walkTarget = null, pendingInteract = null, started = false;
  let eTarget = null;                                   // 当前 E 可交互目标
  let lastPX = 0, lastPY = 0, stuckT = 0;

  const ui = createUI({ content });
  const hb = createHotbar({
    words: content.words,
    crafting: content.crafting,
    onSpeakCarrier: ipa => { sfx.click(); speak(content.carriers[ipa], 'child'); },
    onSpeakWord: w => { sfx.click(); speak(cap(w), 'child'); },
    onCraft: word => run(gameEvent(game, 'CRAFT', word)),
    onTakeItem: word => run(gameEvent(game, 'HOLD_ITEM', word)),
    onDropItem: (word, cx, cy) => {
      const p = screenToLogical(cx, cy, cv.getBoundingClientRect());
      if (!p.inside) return;
      run(gameEvent(game, 'USE', { word, target: hitUseTarget(p, word) }));
    }
  });
  hb.show();                                            // MC 式常驻物品栏

  // —— 词具落点命中 ——
  function hitUseTarget(p, word) {
    const want = content.words[word].use.target;
    if (want === 'player') return Math.hypot(p.x - actors.player.x, p.y - actors.player.y) < 90 ? 'player' : null;
    if (want === 'npc') return Math.hypot(p.x - LAYOUT.targets.npc.x, p.y - LAYOUT.targets.npc.y) < 90 ? 'npc' : null;
    const t = LAYOUT.targets[want];
    if (t && Math.hypot(p.x - t.x, p.y - t.y) < t.r) return want;
    return null;
  }

  // —— 掉石 ——
  function spawnDrop(word) {
    const src = content.flows[word].drop;
    const phon = content.words[word].phonemes;
    phon.forEach(([ipa], i) => stones.push(makeStone(ipa, src[0], src[1], i * 0.13)));
    stones.slice(-phon.length).forEach((s, i) => { s.floorY = src[1] + 26 + (i % 3) * 16; });
  }
  function spawnOne(ipa, x, y) {                        // 换手时旧石放回地面
    const s = makeStone(ipa, x, y - 20, 0);
    s.floorY = Math.min(700, y + 22);
    stones.push(s);
  }

  // —— 指令解释器 ——
  function run(instructions) {
    for (const ins of instructions) {
      switch (ins.t) {
        case 'speak': speak(ins.text, ins.who, ins.slow); break;
        case 'carrier': sfx.click(); speak(content.carriers[ins.ipa], 'child'); break;
        case 'drop': spawnDrop(ins.word); break;
        case 'dropBack': spawnOne(ins.ipa, actors.player.x, actors.player.y); break;
        case 'hint': ui.setHint(ins.key); break;
        case 'beat': game.beat = ins.beat; break;
        case 'hotbarShow': sfx.chime(); break;
        case 'bagPulse': hb.pulseBag(game.stonesPicked); break;
        case 'bank': sfx.itemIn(); hb.refresh(game.inv); break;
        case 'hand': ui.updateHand(game.hand); syncHeld(); break;
        case 'resonate': sfx.resonate(); hb.refresh(game.inv); break;
        case 'itemIn': sfx.itemIn(); hb.refresh(game.inv); break;
        case 'mutter': sfx.mutter(); break;
        case 'cat': sfx.meow(); actors.cat.earT = 1; actors.cat.meowT = 0.6; break;
        case 'sfx': sfx[ins.name]?.(); break;
        case 'illuminate': sfx.sweepUp(); view.switchOn = true; setGesture(actors.npc, 'laugh', 2); break;
        case 'uncleCheer': sfx.laugh(); setGesture(actors.npc, 'laugh', 2); ui.setHint('helloDone'); break;
        case 'effect': applyEffect(ins.name, ins.full); break;
        case 'ritualStart': startRitual(); break;
        case 'openAnim': openDoor(); break;
        case 'summary': ui.summary(game); break;
      }
    }
  }

  function applyEffect(name, full) {
    if (name === 'greet') {
      if (full) { sfx.laugh(); setGesture(actors.npc, 'laugh', 1.8); }
      else setGesture(actors.npc, 'wave', 1.2);
    }
  }

  function syncHeld() {                                  // 手持 → 角色渲染
    const p = actors.player;
    if (!game.hand) { p.held = null; p.heldVowel = false; p.heldIcon = null; return; }
    if (game.hand.kind === 'stone') { p.held = game.hand.ipa; p.heldVowel = isVowel(game.hand.ipa); p.heldIcon = null; }
    else { p.held = null; p.heldVowel = false; p.heldIcon = content.words[game.hand.word].icon; }
  }

  // —— 门仪式（词具开门）——
  function startRitual() {
    ritual.active = true; ritual.t = 0; ritual.seated = 0;
    sfx.glowTick();
    const seats = ritualSeats(content.door.ipa.length);
    const ritualStones = content.door.ipa.map((ipa) => makeStone(ipa, 1145, 460, 0));
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
        for (let i = stones.length - 1; i >= 0; i--) if (stones[i].to) stones.splice(i, 1);
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
    if (e.code === 'Escape') return;
    if (KEYMAP[e.code]) { keys.add(KEYMAP[e.code]); walkTarget = null; pendingInteract = null; return; }
    if (e.code === 'KeyE' && started && eTarget) doE();
  });
  addEventListener('keyup', e => { if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]); });
  addEventListener('blur', () => keys.clear());

  function doE() {
    sfx.click();
    const t = eTarget;
    if (t.kind === 'stone') { takeStone(t.stone ?? nearestStone(t.ipa)); }
    else if (t.id === 'bench') run(gameEvent(game, 'BANK'));
    else if (t.id === 'door') {
      if (game.hand?.kind === 'item') run(gameEvent(game, 'USE', { word: game.hand.word, target: 'door' }));
      else sfx.mutter();
    }
    else run(gameEvent(game, 'INTERACT', t.id));
  }

  // E 目标探测：玩家附近的可交互物
  function findETarget() {
    const p = actors.player;
    let best = null, bestD = 1e9;
    const consider = (d, target) => { if (d < bestD && d <= (target.r ?? 74)) { bestD = d; best = target; } };
    for (const s of stones) {
      if (s.to) continue;
      if (s.state !== 'idle' && s.state !== 'settle') continue;
      consider(Math.hypot(p.x - s.x, p.y - s.y), { kind: 'stone', ipa: s.ipa, x: s.x, y: s.y, r: 56, stone: s });
    }
    for (const id of ['npc', 'cat', 'well', 'brazier', 'hatstand', 'sprout', 'switch', 'bench', 'door']) {
      const t = LAYOUT.targets[id];
      if (!t) continue;
      if (id === 'door' && !game.lit) continue;         // 黑暗中摸不到门
      consider(Math.hypot(p.x - t.x, p.y - t.y), { kind: 'obj', id, x: t.x, y: t.y, r: t.r });
    }
    return best;
  }

  cv.addEventListener('pointerdown', e => {
    if (!started) return;
    const p = screenToLogical(e.clientX, e.clientY, cv.getBoundingClientRect());
    if (!p.inside) return;
    // 直接点石头 → 走过去捡
    let stone = null, sd = 1e9;
    for (const s of stones) {
      if (s.to || (s.state !== 'idle' && s.state !== 'settle')) continue;
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      if (d < 30 && d < sd) { sd = d; stone = s; }
    }
    if (stone) { walkTarget = approach(stone); pendingInteract = { kind: 'stone', ipa: stone.ipa }; return; }
    const hit = hitSceneTarget(p);
    if (!hit) { walkTarget = { x: Math.max(40, Math.min(LAYOUT.W - 40, p.x)), y: Math.max(340, Math.min(700, p.y)) }; pendingInteract = null; return; }
    walkTarget = approach(hit); pendingInteract = { kind: 'obj', id: hit.id };
  });

  function near(t) { return Math.hypot(actors.player.x - t.x, actors.player.y - t.y) < LAYOUT.INTERACT_R; }
  function approach(t) {
    const dx = actors.player.x - t.x, dy = actors.player.y - t.y, d = Math.hypot(dx, dy) || 1;
    return { x: Math.max(40, Math.min(LAYOUT.W - 40, t.x + (dx / d) * 90)), y: Math.max(340, Math.min(LAYOUT.H - 20, t.y + (dy / d) * 90)) };
  }
  function hitSceneTarget(p) {
    const ids = ['switch', 'bench', 'door', 'npc', 'cat', 'well', 'brazier', 'hatstand', 'sprout'];
    for (const id of ids) {
      const t = LAYOUT.targets[id];
      if (!t) continue;
      if (t.x > 800 && !game.lit) continue;
      if (Math.hypot(p.x - t.x, p.y - t.y) < t.r) return { id, x: t.x, y: t.y };
    }
    return null;
  }

  // —— 主循环 ——
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    view.t += dt;
    view.doorState = game.door.state;
    view.doorPulse = (Math.sin(view.t * 2.4) + 1) / 2;
    updateScene(sc, dt, game.lit ? 1 : 0);
    view.lit = sc.lit;
    updateActors(actors, dt);

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
        const t = pendingInteract.kind === 'stone'
          ? { x: p.x, y: p.y } : (LAYOUT.targets[pendingInteract.id] || { x: p.x, y: p.y });
        const done = pendingInteract;
        if (arrived || Math.hypot(p.x - t.x, p.y - t.y) < 110) {
          walkTarget = null; pendingInteract = null;
          if (done.kind === 'stone') takeStone(nearestStone(done.ipa));
          else {
            eTarget = { kind: 'obj', id: done.id }; doE();
          }
        }
      } else if (arrived) walkTarget = null;
      if (walkTarget) {
        const disp = Math.hypot(p.x - lastPX, p.y - lastPY);
        stuckT = disp < 1 ? stuckT + dt : 0;
        if (stuckT > 0.6) { walkTarget = null; pendingInteract = null; stuckT = 0; }
      }
      lastPX = p.x; lastPY = p.y;
    }
    p.moving = moved;
    if (moved) p.walkT += dt;

    for (let i = stones.length - 1; i >= 0; i--) {
      const s = stones[i];
      if (s.to) continue;
      stepStone(s, dt, s.floorY ?? 660);
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

    eTarget = started ? findETarget() : null;
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
    for (const s of stones) if (!s.to) drawStone(ctx, s, view.t);
    drawOverlay(ctx, sc, view);
    if (ritual.active || view.doorOpen > 0) drawRitualStones(ctx);
    if (eTarget && started) drawEHint(ctx, eTarget);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function takeStone(s) {               // E 拾取：地面石离场 + 事件机入手
    if (!s) return;
    const i = stones.indexOf(s);
    if (i >= 0) stones.splice(i, 1);
    run(gameEvent(game, 'PICKUP', s.ipa));
  }

  function nearestStone(ipa) {
    const p = actors.player;
    let best = null, bd = 1e9;
    for (const s of stones) {
      if (s.to || s.ipa !== ipa || (s.state !== 'idle' && s.state !== 'settle')) continue;
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      if (d < bd) { bd = d; best = s; }
    }
    return bd < 80 ? best : null;
  }

  function drawStone(x, s, t) {
    const bob = s.state === 'idle' ? Math.sin(t * 2.2 + s.phase) * 3 : 0;
    const y = s.y + bob;
    x.save();
    x.translate(s.x, y);
    x.fillStyle = isVowel(s.ipa) ? PAL.vowel : PAL.cons;
    x.beginPath(); x.arc(0, 0, 15, 0, 7); x.fill();
    x.lineWidth = 3.5; x.strokeStyle = PAL.ink; x.stroke();
    x.strokeStyle = 'rgba(255,255,255,' + (0.35 + Math.abs(Math.sin(t * 3 + s.phase)) * 0.4) + ')';
    x.beginPath(); x.arc(0, 0, 18, 0, 7); x.stroke();
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
    seats.forEach(([qx, qy], j) => {
      if (j < ritual.seated) {
        x.fillStyle = 'rgba(84,224,200,.25)';
        x.beginPath(); x.arc(qx, qy, 20, 0, 7); x.fill();
      }
    });
  }

  function drawEHint(x, t) {
    const hx = t.x, hy = t.y - (t.kind === 'stone' ? 34 : 60);
    x.save();
    x.globalAlpha = 0.85 + Math.sin(view.t * 4) * 0.15;
    x.fillStyle = 'rgba(28,31,40,.85)';
    x.beginPath(); x.arc(hx, hy, 14, 0, 7); x.fill();
    x.lineWidth = 2; x.strokeStyle = PAL.glowRune; x.stroke();
    x.fillStyle = '#fff';
    x.font = 'bold 14px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('E', hx, hy + 1);
    x.restore();
  }

  // —— 开始/调试 ——
  function begin() {
    started = true;
    hb.refresh(game.inv);
    ui.updateHand(null);
    run(startGame(game));
  }
  addEventListener('game:start', begin);
  window.G = {
    content,
    get beat() { return game.beat; },
    jump(b) {
      started = true;
      run(jump(game, b).filter(i => i.t !== 'drop'));
      hb.refresh(game.inv); ui.updateHand(game.hand); syncHeld();
    },
    game
  };
  if (new URLSearchParams(location.search).get('autostart') === '1') {
    el('title').classList.add('hidden');
    dispatchEvent(new CustomEvent('game:start'));
    G.jump('hello-meet');
  } else {
    el('title').classList.remove('hidden');
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
