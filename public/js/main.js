// —— 回响之石 · 第一间房：hello 教学 + open 开关主线（E 键手持交互）——
import { createInventory, addStone, canConsume, consume, isVowel } from './hotbar.js';
import { createDoor, doorEvent } from './door.js';

const cap = w => w[0].toUpperCase() + w.slice(1) + '.';

// ================= 纯事件机（Node 可测，行为与重构前一致） =================
export function createGame(content) {
  return {
    content, beat: 'hello-listen',
    book: new Set(),
    inv: createInventory(),
    stonesPicked: 0, lit: false,
    hand: null,                        // {kind:'stone',ipa} | {kind:'item',word} | null
    door: createDoor(), usedTargets: new Set(),
    helloDropped: false, helloReminded: false, switchOn: false,
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

// 卡关提示：hello 未拼 → 开关未按 → open 未拼 → 拿着开关去门
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
  if (tease.kind === 'hello' && !g.helloReminded) {
    g.helloReminded = true;
    return [{ t: 'speak', who: 'uncle', text: c.flows.hello.lines[0], slow: true }];
  }
  return tease.kind === 'hello' ? [] : [{ t: 'hint', key: tease.key }];
}

export function gameEvent(g, ev, arg = null) {
  const c = g.content;
  switch (ev) {
    case 'INTERACT': {
      const id = arg;
      if (id === 'cat') return [{ t: 'cat' }];
      if (c.ambience[id]) return [{ t: 'sfx', name: c.ambience[id].sfx }];
      if (id === 'npc') {
        g.helloReminded = true;
        g.teaseClock = 0;
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
      out.push({ t: 'carrier', ipa }, { t: 'hand' });
      if (g.stonesPicked === 1) out.push({ t: 'hotbarShow' }, { t: 'hint', key: 'bench' }, { t: 'beat', beat: 'first-stone' });
      return out;
    }
    case 'HOLD_ITEM': {                 // 点物品栏词具 → 拿起 / 再点一次 → 放下
      const word = arg;
      if (!g.inv.items.has(word)) return [];
      if (g.hand?.kind === 'item' && g.hand.word === word) {
        g.hand = null;
        return [{ t: 'hand' }];
      }
      g.hand = { kind: 'item', word };
      return [{ t: 'hand' },
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
          return [{ t: 'hand' }, { t: 'ritualStart' }];
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
      if (!g.helloDropped && g.helloReminded) return [];
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
    case 'light':                                  // 调试：只开灯（验收右半与门）
      g.lit = true; g.switchOn = true;
      return [{ t: 'illuminate' }, { t: 'forceLight' }];
    case 'lit': return jump(g, 'hello').concat(gameEvent(g, 'INTERACT', 'switch'));
    case 'door-open':
      return jump(g, 'lit').concat(collect(g, 'open'), gameEvent(g, 'USE', { word: 'open', target: 'door' }), gameEvent(g, 'RITUAL_DONE'));
    case 'summary':
      return jump(g, 'door-open').concat(gameEvent(g, 'OPEN_DONE'));
    default:
      return [];
  }
}

// ================= 浏览器 kit（俯视石室） =================
import { mount } from './shell.js';
import { PAL } from './art.js';
import { LAYOUT, createScene, initScene, updateScene, drawScene, drawOverlay,
         screenToLogical, moveToward, resolveCollisions, makeStone, stepStone } from './scene.js';
import { createActors, updateActors, drawPlayer, drawNpc, drawCat, setGesture } from './actors.js';
import { RITUAL_STEP, ritualSeats } from './door.js';
import { drawEHint } from './sideview.js';

const kit = {
  chapter: 1, W: LAYOUT.W, H: LAYOUT.H, titleRune: 'ᚫ',

  createGame: (content) => createGame(content),
  startGame, gameEvent, debug: jump,

  voices: v => ({
    uncle: { voice: v.uncle, pitch: 0.9, rate: 0.95, rateSlow: 0.7 },
    child: { voice: v.child, pitch: 1.25, rate: 1, rateSlow: 0.8 },
    door: { voice: v.door, pitch: 0.7, rate: 0.8, rateSlow: 0.6 }
  }),

  onSpeak(text, who, slow) {             // 大叔手势：提示=指点，hello=招手
    if (who === 'uncle') {
      if (slow) setGesture(w0.actors.npc, 'point');
      else if (/hello/i.test(text)) setGesture(w0.actors.npc, 'wave');
    }
  },

  makeWorld({ content, game, el, cv, atlases }) {
    const actors = createActors();
    const sc = createScene(); initScene(sc, atlases);
    const w = {
      actors, sc, cv,
      stones: [],
      view: { t: 0, lit: 0, doorState: 'closed', doorPulse: 0, doorOpen: 0,
              bloomed: false, hatOn: false, switchOn: false, benchHot: false },
      ritual: { active: false, t: 0, seated: 0 },
      walkTarget: null, pendingInteract: null,
      lastPX: 0, lastPY: 0, stuckT: 0
    };
    return w;
  },

  onDropItem(w, word, cx, cy) {          // 跨层拖拽词具到场景
    const p = screenToLogical(cx, cy, w.cv.getBoundingClientRect());
    if (!p.inside) return;
    w.run(gameEvent(w.game, 'USE', { word, target: hitUseTarget(w, p, word) }));
  },

  tick(w, dt) {
    const { view, sc, ritual, game } = w;
    view.t += dt;
    view.doorState = game.door.state;
    view.doorPulse = (Math.sin(view.t * 2.4) + 1) / 2;
    view.benchHot = game.hand?.kind === 'stone';
    updateScene(sc, dt, game.lit ? 1 : 0);
    view.lit = sc.lit;
    updateActors(w.actors, dt);

    const p = w.actors.player;
    let moved = false;
    if (w.keys.size) {
      const sp = 220 * dt;
      if (w.keys.has('l')) { p.x -= sp; p.facing = -1; p.dir = 'left'; moved = true; }
      if (w.keys.has('r')) { p.x += sp; p.facing = 1; p.dir = 'right'; moved = true; }
      if (w.keys.has('u')) { p.y -= sp; p.dir = 'up'; moved = true; }
      if (w.keys.has('d')) { p.y += sp; p.dir = 'down'; moved = true; }
      resolveCollisions(p);
    } else if (w.walkTarget) {
      const px0 = p.x, py0 = p.y;
      const arrived = moveToward(p, w.walkTarget, 220, dt);
      const ddx = p.x - px0, ddy = p.y - py0;
      if (Math.abs(ddy) > Math.abs(ddx) && Math.abs(ddy) > 0.05) p.dir = ddy < 0 ? 'up' : 'down';
      else if (Math.abs(ddx) > 0.05) p.dir = ddx < 0 ? 'left' : 'right';
      resolveCollisions(p);
      moved = true;
      if (w.pendingInteract) {
        const t = w.pendingInteract.kind === 'stone'
          ? { x: p.x, y: p.y } : (LAYOUT.targets[w.pendingInteract.id] || { x: p.x, y: p.y });
        const done = w.pendingInteract;
        if (arrived || Math.hypot(p.x - t.x, p.y - t.y) < 110) {
          w.walkTarget = null; w.pendingInteract = null;
          if (done.kind === 'stone') takeStone(w, nearestStone(w, done.ipa));
          else w.doEFor({ kind: 'obj', id: done.id });
        }
      } else if (arrived) w.walkTarget = null;
      if (w.walkTarget) {
        const disp = Math.hypot(p.x - w.lastPX, p.y - w.lastPY);
        w.stuckT = disp < 1 ? w.stuckT + dt : 0;
        if (w.stuckT > 0.6) { w.walkTarget = null; w.pendingInteract = null; w.stuckT = 0; }
      }
      w.lastPX = p.x; w.lastPY = p.y;
    }
    p.moving = moved;
    if (moved) p.walkT += dt;

    for (let i = w.stones.length - 1; i >= 0; i--) {
      const s = w.stones[i];
      if (s.to) continue;
      stepStone(s, dt, s.floorY ?? 660);
    }
    if (ritual.active) {
      ritual.t += dt;
      const should = Math.min(ritualSeats().length, Math.floor(ritual.t / RITUAL_STEP) + 1);
      while (ritual.seated < should && ritual.seated < w.content.door.ipa.length) {
        ritual.seated++;
        w.sfx.glowTick();
      }
      if (ritual.t > RITUAL_STEP * 4 + 1) ritual.active = false;
    }
  },

  onKey(w) { w.walkTarget = null; w.pendingInteract = null; },

  onPointerDown(w, e, cv) {
    const p = screenToLogical(e.clientX, e.clientY, cv.getBoundingClientRect());
    if (!p.inside) return;
    let stone = null, sd = 1e9;
    for (const s of w.stones) {
      if (s.to || (s.state !== 'idle' && s.state !== 'settle')) continue;
      const d = Math.hypot(p.x - s.x, p.y - s.y);
      if (d < 30 && d < sd) { sd = d; stone = s; }
    }
    if (stone) { w.walkTarget = approach(w, stone); w.pendingInteract = { kind: 'stone', ipa: stone.ipa }; return; }
    const hit = hitSceneTarget(w, p);
    if (!hit) {
      w.walkTarget = { x: Math.max(40, Math.min(LAYOUT.W - 40, p.x)), y: Math.max(340, Math.min(700, p.y)) };
      w.pendingInteract = null;
      return;
    }
    w.walkTarget = approach(w, hit);
    w.pendingInteract = { kind: 'obj', id: hit.id };
  },

  findE(w) {
    const p = w.actors.player;
    let best = null, bestD = 1e9;
    const consider = (d, target) => { if (d < bestD && d <= (target.r ?? 74)) { bestD = d; best = target; } };
    for (const s of w.stones) {
      if (s.to) continue;
      if (s.state !== 'idle' && s.state !== 'settle') continue;
      consider(Math.hypot(p.x - s.x, p.y - s.y), { kind: 'stone', ipa: s.ipa, x: s.x, y: s.y, r: 56, stone: s });
    }
    for (const id of ['npc', 'cat', 'well', 'brazier', 'hatstand', 'sprout', 'switch', 'bench', 'door']) {
      const t = LAYOUT.targets[id];
      if (!t) continue;
      if (t.x > 800 && !w.game.lit) continue;             // 黑暗中右半区目标（门/帽架等）摸不到
      consider(Math.hypot(p.x - t.x, p.y - t.y), { kind: 'obj', id, x: t.x, y: t.y, r: t.r });
    }
    return best;
  },

  onE(w, t) {
    if (t.kind === 'stone') takeStone(w, t.stone ?? nearestStone(w, t.ipa));
    else if (t.id === 'bench') w.run(gameEvent(w.game, 'BANK'));
    else if (t.id === 'door') {
      if (w.game.hand?.kind === 'item') w.run(gameEvent(w.game, 'USE', { word: w.game.hand.word, target: 'door' }));
      else w.sfx.mutter();
    }
    else w.run(gameEvent(w.game, 'INTERACT', t.id));
  },

  syncHeld(w) {
    const p = w.actors.player, h = w.game.hand;
    if (!h) { p.held = null; p.heldVowel = false; p.heldIcon = null; return; }
    if (h.kind === 'stone') { p.held = h.ipa; p.heldVowel = isVowel(h.ipa); p.heldIcon = null; }
    else { p.held = null; p.heldVowel = false; p.heldIcon = w.content.words[h.word].icon; }
  },

  runExtras: {
    drop(w, ins) {
      const src = w.content.flows[ins.word].drop;
      const phon = w.content.words[ins.word].phonemes;
      phon.forEach(([ipa], i) => w.stones.push(makeStone(ipa, src[0], src[1], i * 0.13)));
      w.stones.slice(-phon.length).forEach((s, i) => { s.floorY = src[1] + 26 + (i % 3) * 16; });
    },
    dropBack(w, ins) {
      const p = w.actors.player;
      const s = makeStone(ins.ipa, p.x, p.y - 20, 0);
      s.floorY = Math.min(700, p.y + 22);
      w.stones.push(s);
    },
    hotbarShow(w) { w.sfx.chime(); },
    illuminate(w) {
      w.sfx.sweepUp();
      w.view.switchOn = true;
      setGesture(w.actors.npc, 'laugh', 2);
    },
    forceLight(w) { w.sc.lit = 1; },               // 调试：跳过 1.2s 光潮缓动（无头截图用）
    uncleCheer(w) {
      w.sfx.laugh(); setGesture(w.actors.npc, 'laugh', 2); w.ui.setHint('helloDone');
    },
    effect(w, ins) {
      if (ins.name !== 'greet') return;
      if (ins.full) { w.sfx.laugh(); setGesture(w.actors.npc, 'laugh', 1.8); }
      else setGesture(w.actors.npc, 'wave', 1.2);
    },
    ritualStart(w) { startRitual(w); },
    openAnim(w) { openDoor(w); }
  },

  summaryMerge(game) {
    return { everPicked: [...game.inv.everPicked], words: [...game.book], abilities: [], chapter: 1 };
  },

  draw(w, x, eTarget) {
    const { view, sc, ritual } = w;
    x.clearRect(0, 0, LAYOUT.W, LAYOUT.H);
    drawScene(x, sc, view);
    const byY = [['npc', w.actors.npc.y], ['cat', w.actors.cat.y], ['player', w.actors.player.y]].sort((a, b) => a[1] - b[1]);
    for (const [who] of byY) {
      if (who === 'npc') drawNpc(x, w.actors.npc, view.t, w.atlases);
      if (who === 'cat') drawCat(x, w.actors.cat, view.t);
      if (who === 'player') drawPlayer(x, w.actors.player, view.t, w.atlases);
    }
    for (const s of w.stones) if (!s.to) drawStone(x, s, view.t);
    drawOverlay(x, sc, view);
    if (ritual.active || view.doorOpen > 0) drawRitualStones(w, x);
    drawEHint(x, eTarget, view.t);
  }
};

let w0 = null;                            // onSpeak 手势需要世界引用

// —— 工具 ——
function takeStone(w, s) {
  if (!s) return;
  const i = w.stones.indexOf(s);
  if (i >= 0) w.stones.splice(i, 1);
  w.run(gameEvent(w.game, 'PICKUP', s.ipa));
}
function nearestStone(w, ipa) {
  const p = w.actors.player;
  let best = null, bd = 1e9;
  for (const s of w.stones) {
    if (s.to || s.ipa !== ipa || (s.state !== 'idle' && s.state !== 'settle')) continue;
    const d = Math.hypot(p.x - s.x, p.y - s.y);
    if (d < bd) { bd = d; best = s; }
  }
  return bd < 80 ? best : null;
}
function approach(w, t) {
  const p = w.actors.player;
  const dx = p.x - t.x, dy = p.y - t.y, d = Math.hypot(dx, dy) || 1;
  return { x: Math.max(40, Math.min(LAYOUT.W - 40, t.x + (dx / d) * 90)), y: Math.max(340, Math.min(LAYOUT.H - 20, t.y + (dy / d) * 90)) };
}
function hitSceneTarget(w, p) {
  const ids = ['switch', 'bench', 'door', 'npc', 'cat', 'well', 'brazier', 'hatstand', 'sprout'];
  for (const id of ids) {
    const t = LAYOUT.targets[id];
    if (!t) continue;
    if (t.x > 800 && !w.game.lit) continue;
    if (Math.hypot(p.x - t.x, p.y - t.y) < t.r) return { id, x: t.x, y: t.y };
  }
  return null;
}
function hitUseTarget(w, p, word) {
  const want = w.content.words[word].use.target;
  const pl = w.actors.player;
  if (want === 'player') return Math.hypot(p.x - pl.x, p.y - pl.y) < 90 ? 'player' : null;
  if (want === 'npc') return Math.hypot(p.x - LAYOUT.targets.npc.x, p.y - LAYOUT.targets.npc.y) < 90 ? 'npc' : null;
  const t = LAYOUT.targets[want];
  if (t && Math.hypot(p.x - t.x, p.y - t.y) < t.r) return want;
  return null;
}

// —— 门仪式与开门 ——
function startRitual(w) {
  const ritual = w.ritual;
  ritual.active = true; ritual.t = 0; ritual.seated = 0;
  w.sfx.glowTick();
  const seats = ritualSeats(w.content.door.ipa.length);
  const stones = w.content.door.ipa.map((ipa) => makeStone(ipa, 1112, 240, 0));
  stones.forEach((s, i) => {
    s.state = 'idle'; s.from = { x: 1112, y: 240 }; s.to = { x: seats[i][0], y: seats[i][1] }; s.at = i * RITUAL_STEP;
    w.stones.push(s);
  });
  const T = RITUAL_STEP * 4 * 1000;
  setTimeout(async () => {
    await w.ui.reveal('open');
    w.run(gameEvent(w.game, 'RITUAL_DONE'));
  }, T + 900);
}
function openDoor(w) {
  w.sfx.creak();
  const t0 = performance.now();
  const anim = () => {
    const k = Math.min(1, (performance.now() - t0) / 1400);
    w.view.doorOpen = k;
    if (k >= 1) {
      for (let i = w.stones.length - 1; i >= 0; i--) if (w.stones[i].to) w.stones.splice(i, 1);
      w.sfx.choir();
      w.run(gameEvent(w.game, 'OPEN_DONE'));
      return;
    }
    requestAnimationFrame(anim);
  };
  setTimeout(anim, 400);
}

// —— 绘制 ——
function drawStone(x, s, t) {
  const bob = s.state === 'idle' ? Math.sin(t * 2.2 + s.phase) * 3 : 0;
  x.save();
  x.translate(s.x, s.y + bob);
  x.fillStyle = isVowel(s.ipa) ? PAL.vowel : PAL.cons;
  x.beginPath(); x.arc(0, 0, 15, 0, 7); x.fill();
  x.lineWidth = 3.5; x.strokeStyle = PAL.ink; x.stroke();
  x.strokeStyle = 'rgba(255,255,255,' + (0.35 + Math.abs(Math.sin(t * 3 + s.phase)) * 0.4) + ')';
  x.beginPath(); x.arc(0, 0, 18, 0, 7); x.stroke();
  x.fillStyle = PAL.ink; x.font = 'bold 13px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(s.ipa, 0, 1);
  x.restore();
}
function drawRitualStones(w, x) {
  const ritual = w.ritual, view = w.view;
  const seats = ritualSeats();
  w.stones.filter(s => s.to).forEach((s, i) => {
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

// —— 挂载（onSpeak 需要世界引用，包一层）——
const baseMount = mount;
function mountCh1(k) {
  const origMakeWorld = k.makeWorld;
  k.makeWorld = (args) => { const w = origMakeWorld(args); w0 = w; return w; };
  baseMount(k);
}
mountCh1(kit);
