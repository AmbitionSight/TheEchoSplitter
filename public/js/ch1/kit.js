// —— 析声者 · 第一关浏览器 kit（俯视石室）：自 main.js kit 段原样迁入 ——
import { createGame, startGame, gameEvent, jump } from './event.js';
import { LAYOUT } from './planners.js';
import { screenToLogical, moveToward, resolveCollisions, makeStone, stepStone } from './physics.js';
import { BENCH_SOCKETS, createScene, initScene, updateScene, drawScene, drawOverlay } from './render.js';
import { mount } from '../shell.js';
import { PAL } from '../art.js';
import { createActors, updateActors, drawPlayer, drawNpc, drawCat, setGesture } from '../actors.js';
import { RITUAL_STEP, ritualSeats } from '../door.js';
import { drawEHint } from '../sideview.js';
import { drawBenchStones } from '../workbench.js';
import { isVowel } from '../hotbar.js';
import { syncHeld } from '../chapter.js';

// ================= 浏览器 kit（俯视石室） =================
export const kit = {
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
          else w.doE({ kind: 'obj', id: done.id });     // 与按 E 同一条路径（修重构遗留的 doEFor 幽灵调用）
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
    for (const id of ['npc', 'cat', 'well', 'brazier', 'hatstand', 'sprout', 'switch', 'bench', 'door', 'shelf', 'plant', 'cactus']) {
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
      else w.run(gameEvent(w.game, 'INTERACT', 'door'));     // 关着的门：低语自己的名字
    }
    else w.run(gameEvent(w.game, 'INTERACT', t.id));
  },

  syncHeld,

  runExtras: {
    drop(w, ins) {                 // 节奏掉落：声音按音素时长依次落地成石，从左到右排成一条「声音顺序线」
      const src = w.content.flows[ins.word].drop;
      const phon = w.content.words[ins.word].phonemes;
      const total = phon.reduce((s, [, ms]) => s + ms, 0);
      let cum = 0;
      phon.forEach(([ipa, ms], i) => {
        cum += ms;                                        // 这个音说完了 → 落地成石
        const s = makeStone(ipa, src[0] - 66 + i * 44, src[1], 0.3 + (cum / total) * 1.2, () => 0.5);
        s.floorY = src[1] + 26;                           // 同一排落地；rand 恒定 → 直上直落不乱序
        w.stones.push(s);
      });
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
    return { everPicked: [...game.inv.everPicked], heard: [...game.heard], words: [...game.book], abilities: [], chapter: 1 };
  },

  draw(w, x, eTarget) {
    const { view, sc, ritual } = w;
    x.clearRect(0, 0, LAYOUT.W, LAYOUT.H);
    drawScene(x, sc, view);
    drawBenchStones(x, view.craftSlots, BENCH_SOCKETS);  // 合成槽内容 → 台面四个石槽
    const byY = [['npc', w.actors.npc.y], ['cat', w.actors.cat.y], ['player', w.actors.player.y]].sort((a, b) => a[1] - b[1]);
    for (const [who] of byY) {
      if (who === 'npc') drawNpc(x, w.actors.npc, view.t, w.atlases);
      if (who === 'cat') drawCat(x, w.actors.cat, view.t);
      if (who === 'player') drawPlayer(x, w.actors.player, view.t, w.atlases);
    }
    for (const s of w.stones) if (!s.to && s.state !== 'wait') drawStone(x, s, view.t);   // wait=节奏掉落倒计时，先不现身
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
  const ids = ['switch', 'bench', 'door', 'npc', 'cat', 'well', 'brazier', 'hatstand', 'sprout', 'shelf', 'plant', 'cactus'];
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
