// —— 析声者 · 第二间房：jump（dʒ·ʌ·m·p；p 为第一间房旧识）——
import { createInventory } from './hotbar.js';
import { pickupStone, bankHeld, holdItem, craftWord, cap,
         chapterOnE, syncHeld, seedBegin, dropExtra, dropBackExtra, stepWorldStones } from './chapter.js';

// ================= 纯事件机（Node 可测，行为与重构前一致；公共段见 chapter.js） =================
export function createGame(content, profile) {
  return {
    content, beat: 'start',
    inv: createInventory(),
    book: new Set(), stonesPicked: 0,
    hand: null,
    attempted: false,
    jumpUnlocked: profile.abilities.includes('jump'),
    crossed: false, exited: false, fell: false,
    heard: new Set(),                                  // 听声点听过的音（声音层；与拼词层 everPicked 分开）
    teaseClock: 0
  };
}

export function startGame(g) {
  return [{ t: 'hint', key: 'start' }, { t: 'beat', beat: 'start' }];
}

export function gameEvent(g, ev, arg = null) {
  const c = g.content;
  switch (ev) {
    case 'CHASM': {
      const first = !g.attempted;
      g.attempted = true;
      const out = [
        { t: 'shrug' },
        { t: 'bubble' },
        { t: 'speak', who: 'child', text: c.flows.jump.puzzled[0] },
        { t: 'speak', who: 'door', text: c.flows.jump.listen[0], slow: true }
      ];
      if (first) out.push({ t: 'drop', word: 'jump' }, { t: 'hint', key: 'attempt' });
      return out;
    }
    case 'PICKUP':
      return pickupStone(g, arg, { onFirst: [{ t: 'hint', key: 'carrying' }] });
    case 'BANK':
      return bankHeld(g);
    case 'HOLD_ITEM':
      return holdItem(g, arg);
    case 'CRAFT': {
      const out = craftWord(g, arg, [{ t: 'hint', key: 'give' }]);
      if (out.length) out.push({ t: 'revealCard', word: arg });   // 首次合成成功 → +0.9s 揭示卡（规格 §7.3；craftWord 已保证只成功一次）
      return out;
    }
    case 'USE': {
      const { word, target } = arg;
      const def = c.words[word]?.use;
      if (!def || target !== def.target) return [{ t: 'mutter' }];
      if (g.jumpUnlocked) return [                          // 重复使用：glowTick 之外再念一次（规格 §4）
        { t: 'effect', name: 'jumpUnlock', full: false },
        { t: 'speak', who: 'child', text: cap(word) }
      ];
      g.jumpUnlocked = true;
      return [{ t: 'effect', name: 'jumpUnlock', full: true }];
    }
    case 'CROSS':
      if (g.crossed) return [];
      g.crossed = true;
      return [{ t: 'crossed' }, { t: 'beat', beat: 'crossed' }];   // 演出在 runExtras.crossed；hint 'exit' 由它延后 0.9s（规格 §3.2 拍 11）
    case 'FELL':
      return [{ t: 'fell' }, { t: 'hint', key: 'fell' }];
    case 'CAT':                                                // 对岸猫（规格 §9）：点它 → 喵 + 竖耳（竖耳由壳的 meow 分支给）
      return [{ t: 'meow' }];
    case 'EXIT': {
      if (g.exited) return [];
      g.exited = true;
      g.beat = 'summary';
      return [{ t: 'summary' }];
    }
    case 'LISTEN': {                                          // 听声点：走近按 E 触发（纯听觉，不进库存）
      const spot = (c.listening || []).find(s => s.id === arg);
      if (!spot) return [];
      const v = (g.jumpUnlocked && spot.after) ? spot.after : spot;   // 解锁跳跃（能过坑）后回声变化
      return [{ t: 'sfx', name: spot.sfx ?? 'glowTick' }, { t: 'echo', ipas: v.echo, say: v.say }];   // 逐点音色（规格 §7.1）
    }
    case 'TICK': {
      g.teaseClock += arg;
      if (g.teaseClock < 45) return [];
      g.teaseClock = 0;
      if (!g.attempted) return [{ t: 'hint', key: 'start' }];
      if (!g.book.has('jump')) return [{ t: 'hint', key: 'carrying' }];
      if (!g.jumpUnlocked) return [{ t: 'hint', key: 'give' }];
      if (!g.crossed) return [{ t: 'hint', key: 'unlocked' }];
      return [{ t: 'hint', key: 'exit' }];
    }
    default:
      return [];
  }
}

export function jumpDebug(g, beat) {
  switch (beat) {
    case 'drop': return gameEvent(g, 'CHASM');
    case 'crafted': {
      let out = jumpDebug(g, 'drop');
      for (const [ipa] of g.content.words.jump.phonemes) {
        out = out.concat(gameEvent(g, 'PICKUP', ipa), gameEvent(g, 'BANK'));
      }
      return out.concat(gameEvent(g, 'CRAFT', 'jump'));
    }
    case 'unlocked': return jumpDebug(g, 'crafted').concat(gameEvent(g, 'USE', { word: 'jump', target: 'player' }));
    case 'crossed': {                                            // 位置依赖拍：先传送到对岸再演出（runExtras.teleport，规格 §3.5）
      const geo = g.content.geometry;
      return [{ t: 'teleport', x: geo.chasmR + 20, y: geo.groundY }, ...gameEvent(g, 'CROSS')];
    }
    default: return [];
  }
}

// ================= 浏览器 kit（壳 + 横版共用件） =================
import { mount } from './shell.js';
import { SIDE, moveSide, sideJump, stepWalkTo, AMBIENT,
         drawSideStone, drawTorchSide, drawBenchSide, drawEHint, vignette, drawListenSpots,
         drawArchSide, groundShadow, benchCandle, makeDust, stepDust, drawDust } from './sideview.js';
import { blit } from './sprites.js';
import { PAL, iconURL } from './art.js';
import { screenToLogical } from './ch1/physics.js';
import { createActors, updateActors, drawPlayer, drawCat } from './actors.js';
import { rng, masonryPlan, slabPlan } from './ch1/planners.js';
import { shade, paintMasonry, paintSlabs, BAYER4, pixelGradientV, pixelGlow } from './masonry.js';

// —— 2a 光法则（唯一事实源，规格 §6.1）：一个光源 = 一个坐标 = 烘焙光池（makeBg）= 动态光晕（draw）——
export function LIGHTS2(geo) {
  return {
    torchL: { x: 90, y: 240, r: 170, s: 0.24 },                          // 左火把（火焰核心同点）
    torchR: { x: geo.chasmR + 120, y: 240, r: 170, s: 0.24 },            // 右火把
    candle: { ...benchCandle(geo.benchX, geo.groundY), r: 90, s: 0.20 }, // 合成台蜡烛（benchX+62, groundY−90）
    chasm:  { x: (geo.chasmL + geo.chasmR) / 2, y: geo.groundY - 70, r: 300, s: 0.16 },  // 缝口暖核（对面有光）
    exit:   { x: geo.exitX, y: geo.groundY - 180, r: 260, s: 0.12 }      // 出口石拱
  };
}

// —— 光响应节拍（规格 §6.3）：拍 → 光锚 s 的瞬时倍率；draw 读 lightScales 缩放 LIGHTS2 的 s，不复制坐标 ——
export const LIGHT_BEATS = { chasmBreath: 1.6, chasmTry: 0.5, unlock: 0.6, chasmDip: 0.6 };
export function lightScales(v, crossed = false) {
  const s = { torchL: 1, torchR: 1, chasm: 1, exit: 1 };
  if (v.torchBeatT > 0) { const m = v.torchBeatM ?? 1; s.torchL *= m; s.torchR *= m; }   // chasm-try ×1.25 / unlocked ×1.3
  if (v.chasmBreathT > 0) {                                     // chasm-try：缝口一次呼吸 .16→.24→.16（1.6s 正弦包络）
    const p = Math.min(1, Math.max(0, 1 - v.chasmBreathT / LIGHT_BEATS.chasmBreath));
    s.chasm *= 1 + 0.5 * Math.sin(Math.PI * p);
  }
  if (v.chasmBoostT > 0) s.chasm *= v.chasmBoostM ?? 1;         // unlocked：缝口 +20%（0.6s）
  if (v.chasmDipT > 0) s.chasm *= 0.5;                          // fell：×0.5 持续 0.6s 再回升
  if (crossed) { s.chasm *= 1.25; s.exit *= 0.20 / 0.12; }      // crossed：缝口 +.04；出口升档 .12→.20
  return s;
}
export const RING = { dur: 0.6, r0: 16, r1: 64 };               // unlocked 脚下青色声环（规格 §6.3）

// —— 坠谷滑回（规格 §3.2 fell）：放在崖缘 → 0.4s ease-out 滑回安全点（非瞬移）；tween 在 tick 推进 ——
export const FELL = { dur: 0.4, back: 90, lip: 6 };
export function startFellSlide(w) {
  const geo = w.geo, p = w.player, v = w.view;
  const from = { x: geo.chasmL - FELL.lip, y: geo.groundY };
  const to = { x: geo.chasmL - FELL.back, y: geo.groundY };
  v.fellSlide = { t: 0, from, to };
  p.x = from.x; p.y = from.y; p.vy = 0; p.airborne = false;
  p.moving = true; p.facing = -1; p.dir = 'left';
  w.walkTo = null; w.pending = null;                            // 落谷清走位（软重生绝不卡死）
}
export function stepFellSlide(w, dt) {
  const fs = w.view?.fellSlide, p = w.player;
  if (!fs) return false;
  fs.t += dt;
  const k = Math.min(1, fs.t / FELL.dur);
  const e = 1 - Math.pow(1 - k, 3);                             // ease-out：先快后稳
  p.x = fs.from.x + (fs.to.x - fs.from.x) * e;
  p.y = fs.from.y + (fs.to.y - fs.from.y) * e;
  p.vy = 0; p.airborne = false;
  p.moving = k < 1; p.facing = -1; p.dir = 'left';
  p.walkT = (p.walkT ?? 0) + dt;                                // 挣扎步帧
  if (k >= 1) {                                                 // 落点 = 安全点：任何 dt 都一次到位
    p.x = fs.to.x; p.y = fs.to.y; p.moving = false; p.squash = 0.6;
    w.view.fellSlide = null;
    return false;
  }
  return true;
}

// —— 谷底碎石/尘埃流（规格 §8）：2–3 粒坠落、稀疏、动态重生，只在谷底 120px 内 ——
export const RUBBLE = { n: 3, band: 120 };
export function makeRubble(geo, n = RUBBLE.n, seed = 137) {
  const r = rng(seed), out = [];
  for (let i = 0; i < n; i++) {
    out.push({
      x: geo.chasmL + 20 + r() * (geo.chasmR - geo.chasmL - 40),
      y: SIDE.H - RUBBLE.band + r() * RUBBLE.band,
      v: 26 + r() * 30,
      ph: r() * 6.28,
      sz: 1.4 + r() * 1.6
    });
  }
  return out;
}
export function stepRubble(list, dt, geo) {
  for (const m of list) {
    m.y += m.v * dt;
    if (m.y > SIDE.H + 4) {                                     // 落出谷底 → 回上沿重生
      m.y = SIDE.H - RUBBLE.band;
      m.x = geo.chasmL + 20 + Math.random() * (geo.chasmR - geo.chasmL - 40);
    }
  }
}

// —— 过坑自动化（规格 §10）：助跑止点与余量算术（sideJump vy=−740、moveSide 重力 1500）——
export const CROSS = { runUp: 28, speed: 330 };            // 助跑止点 = chasmL−28；速度显式设 330（缺省 300）
export function crossMargin(geo, speed = CROSS.speed) {
  const airT = 2 * 740 / 1500;                             // 滞空 ≈0.99s
  return speed * airT - (geo.chasmR - (geo.chasmL - CROSS.runUp));   // 射程 ≈326px − 需求 268px ≈ 58px 余量
}

// —— 对岸橘猫（规格 §9）：坐 (1015,600)；crossed 落地后 1s 内可点（meow + 竖耳）；t+1.0s 起身向右走出画面 ——
export const CAT = { x: 1015, r: 56, speed: 180, leaveDelay: 1.0 };   // 180px/s：起身后约 1.7s 走出画面
export function catClickable(w) {                          // 可点窗口：crossed 落地起 1s（catLeaveT 由 runExtras.crossed 开）
  const c = w.actors?.cat;
  return !!(c && c.seated && !c.gone && w.view.catLeaveT > 0);
}
export function stepCat(w, dt) {                           // 纯步进：倒计时满 → meow 起身；起身后向右走，出画即 gone
  const c = w.actors?.cat, v = w.view;
  if (!c || !v || c.gone) return [];
  if (c.seated) {
    if (!(v.catLeaveT > 0)) return [];
    v.catLeaveT -= dt;
    if (v.catLeaveT > 0) return [];
    c.seated = false; c.vx = CAT.speed;
    return [{ t: 'meow' }];                                // t+1.0s 起身喵一声（规格 §3.4）
  }
  c.x += (c.vx || 0) * dt;
  if (c.x > SIDE.W + 46) c.gone = true;                    // exit-2a 前已不在（规格 §9）
  return [];
}

// —— 环境风（规格 §9）：常态 8–14s 一阵，近裂口（±300px）间隔减半更密；chasm-try/fell/crossed 一次性 ——
export const WIND = { min: 8, max: 14, near: 300 };
export function windDelay(px, geo, rand = Math.random) {
  const base = WIND.min + rand() * (WIND.max - WIND.min);
  const near = Math.abs(px - geo.chasmL) <= WIND.near || Math.abs(px - geo.chasmR) <= WIND.near;
  return near ? base * 0.5 : base;
}
export function windNow(w) {                               // 一次性风：吹一声并把环境风计时重置（免紧跟又一阵）
  w.sfx.wind();
  w.view.windT = windDelay(w.player.x, w.geo);
}

// —— 指针命中表（纯函数；顺序镜像 findE：石 → 合成台 → 听声点 → 裂谷 → 出口 → 自身）——
// 本侧点对岸 = 过坑意图：未解锁走到裂口边试一次，已解锁自动助跑跳（规格 §10「点哪走哪 + 点对岸自动跳」）
export function tapTargetAt(w, p) {
  const { geo, player, stones } = w;
  const onLeft = player.x < geo.chasmL;                    // 还在本侧：对岸的一切先读作「过去」
  let best = null, bd = 1e9;
  const consider = (d, t, r) => { if (d < bd && d <= r) { bd = d; best = t; } };
  for (const s of stones) if (s.state === 'idle') {
    consider(Math.hypot(p.x - s.x, p.y - s.y), { kind: 'stone', ipa: s.ipa, x: s.x, y: s.y, stone: s }, 44);
  }
  consider(Math.abs(p.x - geo.benchX), { kind: 'obj', id: 'bench', x: geo.benchX, y: geo.groundY }, 80);
  for (const spot of (w.content.listening || [])) {        // 听声点：实体物件（auto 的自动响，不占指针）
    if (spot.auto) continue;
    if (onLeft && spot.x > geo.chasmL) continue;           // 对岸的听声点隔着裂口：点它 = 过坑
    consider(Math.hypot(p.x - spot.x, p.y - spot.y), { kind: 'obj', id: spot.id, x: spot.x, y: spot.y }, spot.r);
  }
  if (onLeft && p.x >= geo.chasmL) {                       // 裂口/对岸/出口：本侧点它们都是「要过去」
    consider(0, { kind: 'chasm', x: geo.chasmL - CROSS.runUp, y: geo.groundY }, 0);
  }
  consider(Math.abs(p.x - geo.exitX), { kind: 'obj', id: 'exit', x: geo.exitX, y: geo.groundY }, 80);
  if (w.game.hand?.kind === 'item') {                      // 手持词具：点自己 90px 内 = 对自己用（与拖拽同口径）
    consider(Math.hypot(p.x - player.x, p.y - (player.y - 40)), { kind: 'obj', id: 'self', x: player.x, y: player.y }, 90);
  }
  return best;
}

// 自动助跑跳：助跑到位后起跳，空中保持右推（落地由 cfg.onLand 收尾，规格 §10）
function startCross(w) {
  w.autoCross = true;
  sideJump(w); w.sfx.hop();
  w.keys.add('r');
  w.player.facing = 1; w.player.dir = 'right';
}

// —— #btn-jump 触屏跳键（规格 §10）：右下圆钮，unlocked 同拍显示；pointerdown → onSpace ——
function showJumpBtn(w) {
  if (typeof document === 'undefined') return;
  const btn = document.getElementById('btn-jump');
  if (!btn) return;
  if (!btn.firstChild) btn.innerHTML = `<img src="${iconURL('jump')}" alt="">`;   // 图标只装一次
  btn.classList.remove('hidden');
}
function wireJumpBtn(w, signal) {
  if (typeof document === 'undefined') return;
  const btn = document.getElementById('btn-jump');
  if (!btn) return;
  btn.addEventListener('pointerdown', () => kit.onSpace(w), { signal });
  if (w.game.jumpUnlocked) showJumpBtn(w);                 // 书档已解锁：开局即可跳
}

// hint 'unlocked' 不再绑定空格：键盘/触屏跳键/点对岸自动跳同一条路（规格 §10）
export const HINT_UNLOCKED = '能跳了。跑起来，跳。';

export const kit = {
  chapter: 2, W: SIDE.W, H: SIDE.H, titleRune: 'ᛚ',

  createGame, startGame, gameEvent, debug: jumpDebug,

  // 走到走廊尽头：无缝交接进入崖壁（第二间房后半，同页、无刷新，跳过其标题页）——壳读 kit.next
  next: { chapter: 2, page: 'chapter2b.html', load: () => import('./ch2b.js').then(m => m.kit) },

  voices: v => ({
    child: { voice: v.child, pitch: 1.25, rate: 1, rateSlow: 0.8 },
    door: { voice: v.door, pitch: 0.7, rate: 0.8, rateSlow: 0.6 }
  }),

  makeWorld({ content, profile, game, cv, signal }) {
    const geo = content.geometry;
    const actors = createActors();
    const player = actors.player;
    player.x = geo.spawnX; player.y = geo.groundY; player.dir = 'right';
    player.vy = 0; player.airborne = false; player.squash = 0;
    const cat = actors.cat;                                  // 对岸橘猫：坐 (1015,600) 等过坑（规格 §9）
    cat.x = CAT.x; cat.y = geo.groundY; cat.seated = true; cat.gone = false; cat.vx = 0;
    const w = {
      actors, player, geo, cv,
      lights: LIGHTS2(geo),                                    // 光锚唯一事实源（烘焙光池与动态光晕共用）
      stones: [],
      walkTo: null, pending: null, autoCross: false,           // 点哪走哪（指针 → walkTo + pending；自动助跑跳）
      view: {
        t: 0, stars: [], puffs: [], bubbleT: 0, mist: [],
        dust: makeDust(26, 99),                                // 浮尘 26 粒（rng(99) 确定布局，规格 §6.4）
        emberT: [0.4, 1.1],                                    // 双火把余烬计时（每颗间隔 0.7–1.4s）
        gold: makeGoldMotes(geo),                              // 出口 12 金尘（拱洞内循环上浮）
        glowT: 0, mistPulse: 0, torchSurge: 0,                 // crossed 演出计时（暖晕 1.2s / 雾脉冲 / 火把池 0.8s 涌亮）
        catLeaveT: 0,                                          // 猫离场倒计时（crossed 落地开 1s；窗口内可点，规格 §9）
        windT: windDelay(geo.spawnX, geo),                     // 环境风：8–14s 一阵，近裂口更密（规格 §9）
        // 光响应节拍（规格 §6.3）：拍计时与倍率（draw 读 lightScales 缩放 LIGHTS2 的 s）
        torchBeatT: 0, torchBeatM: 1, chasmBreathT: 0, chasmBoostT: 0, chasmBoostM: 1, chasmDipT: 0,
        ringT: 0, ringX: geo.spawnX, ringY: geo.groundY,       // unlocked 脚下青色声环 r16→64
        squeezeT: 0, fellSlide: null, demoLand: false,         // fell 暗角收拢 + 滑回；unlocked hint 延到落地
        rubble: makeRubble(geo)                                // 谷底碎石流 3 粒（规格 §8）
      },
      cfg: {
        gap: { L: geo.chasmL, R: geo.chasmR },
        speed: CROSS.speed,                                    // 330：助跑跳余量 ≈58px（规格 §10）
        canJump: game.jumpUnlocked,
        onLand: x => {                                         // 落地 thud（规格 §7.1）
          w.sfx.thud();
          if (w.autoCross) { w.autoCross = false; w.keys?.delete('r'); }   // 自动跳落地：收回空中右推
          w.view.puffs.push({ x: w.player.x - 10, y: geo.groundY, r: 6, a: 0.9 });   // 落地尘（规格 §3.2 拍 10）
          w.view.puffs.push({ x: w.player.x + 10, y: geo.groundY, r: 6, a: 0.9 });
          if (w.view.demoLand) {                               // unlocked hint 延到落地（规格 §3.2 拍 10）
            w.view.demoLand = false;
            w.ui?.setHint(HINT_UNLOCKED);
          }
          if (x > geo.chasmR) w.run(gameEvent(game, 'CROSS'));
        },
        onFell: () => w.run(gameEvent(game, 'FELL'))
      }
    };
    for (let i = 0; i < 14; i++) {
      w.view.mist.push({ o: Math.random(), ph: Math.random() * 6.28, v: 6 + Math.random() * 10 });
    }
    wireJumpBtn(w, signal);                                    // #btn-jump 触屏跳键（页面无此钮则静默）
    return w;
  },

  onBegin(w) { seedBegin(w); },                   // 开局记忆石：只带本章需要的旧音素（p）

  onSpace(w) {
    if (w.game.jumpUnlocked) {
      if (!w.player.airborne && !w.player.climbing) { sideJump(w); w.sfx.hop(); }   // 起跳 hop（规格 §7.1）
    } else if (!w.player.airborne && Math.abs(w.player.x - w.geo.chasmL) < 150) {
      w.run(gameEvent(w.game, 'CHASM'));
    }
  },

  onKey(w) { w.walkTo = null; w.pending = null; },                 // 方向键按下取消走位（规格 §10）

  onPointerDown(w, e, cv) {                                        // 点哪走哪：命中表 → walkTo + pending（tick 到位触发）
    const p = screenToLogical(e.clientX, e.clientY, cv.getBoundingClientRect());
    if (!p.inside) return;
    if (catClickable(w) && Math.hypot(p.x - w.actors.cat.x, p.y - (w.actors.cat.y - 26)) <= CAT.r) {
      w.run(gameEvent(w.game, 'CAT'));                             // 落地 1s 内点猫：喵 + 竖耳，不占用走位（规格 §9）
      return;
    }
    const t = tapTargetAt(w, p);
    w.walkTo = { x: Math.max(40, Math.min(SIDE.W - 40, t ? t.x : p.x)) };   // 未命中 = 走到点击 x（钳制）
    w.pending = t;
  },

  onDropItem(w, word, cx, cy) {                                    // 拖词具到场景：jump 拖到自己 90px 内 = 对自己用（规格 §10）
    const p = screenToLogical(cx, cy, w.cv.getBoundingClientRect());
    if (!p.inside) return;
    if (word === 'jump' && Math.hypot(p.x - w.player.x, p.y - (w.player.y - 40)) < 90) {
      w.run(gameEvent(w.game, 'USE', { word, target: 'player' }));
    } else w.sfx.mutter();                                         // 拖错：目标纹丝不动 + 咕哝
  },

  tick(w, dt) {
    const { view: v, geo } = w;
    v.t += dt;
    v.bubbleT = Math.max(0, v.bubbleT - dt);
    v.glowT = Math.max(0, v.glowT - dt);                       // crossed 暖晕：1.2s 光涌后熄
    v.mistPulse = Math.max(0, v.mistPulse - dt * 0.8);         // 谷雾脉冲（被风吹散后回稳）
    v.torchSurge = Math.max(0, v.torchSurge - dt / 0.8);       // 对岸火把池 0.8s 涌亮
    v.torchBeatT = Math.max(0, v.torchBeatT - dt);             // 光响应节拍衰减（规格 §6.3）
    v.chasmBreathT = Math.max(0, v.chasmBreathT - dt);
    v.chasmBoostT = Math.max(0, v.chasmBoostT - dt);
    v.chasmDipT = Math.max(0, v.chasmDipT - dt);
    v.ringT = Math.max(0, v.ringT - dt);
    v.squeezeT = Math.max(0, v.squeezeT - dt / 1.2);           // fell 暗角收拢后放开
    v.windT -= dt;                                             // 环境风：8–14s 一阵，近裂口更密（规格 §9）
    if (v.windT <= 0) { w.sfx.wind(); v.windT = windDelay(w.player.x, geo); }
    w.player.squash = Math.max(0, w.player.squash - dt * 2);
    w.cfg.canJump = w.game.jumpUnlocked;
    updateActors(w.actors, dt);
    w.run(stepCat(w, dt));                                     // 对岸猫：crossed 1s 后 meow 起身向右走出画面（规格 §9）
    moveSide(w, dt);
    stepWalkTo(w, dt);                                         // 点哪走哪（规格 §10；调在 moveSide 之后）
    stepFellSlide(w, dt);                                      // 坠谷滑回：tween 覆盖本帧位置（规格 §3.2）
    if (w.player.moving && (w.keys.has('l') || w.keys.has('r'))) w.player.walkT += dt;  // 行走帧推进（仅水平移动）
    // 走位到位（≤30px）→ 触发 pending：与按 E 同一条路径；出口无 E 动作，交给下面的 EXIT 判定
    if (w.pending && (!w.walkTo || Math.abs(w.player.x - w.walkTo.x) <= 30)) {
      const t = w.pending; w.pending = null; w.walkTo = null;
      if (t.kind === 'chasm') {                                // 裂口/对岸：未解锁走到边上试一次；已解锁自动助跑跳
        if (!w.game.jumpUnlocked) w.run(gameEvent(w.game, 'CHASM'));
        else if (!w.player.airborne && !w.player.climbing) startCross(w);
      } else if (t.id !== 'exit') w.doE(t);
    }
    // 走到走廊尽头：不再有门，直接进入下一关
    if (!w.game.exited && w.game.crossed && w.player.x >= geo.exitX - 10) w.run(gameEvent(w.game, 'EXIT'));
    // 保险：石头绝不落在裂隙里
    stepWorldStones(w, dt, () => geo.groundY,
      x => (x >= geo.chasmL && x <= geo.chasmR) ? geo.chasmL - 30 - Math.random() * 40 : null);
    for (const m of v.mist) m.ph += dt * m.v * 0.1;
    v.stars = v.stars.filter(st => (st.a -= dt * 1.2) > 0);
    stepEmbers(w, dt);                                          // 余烬：每火把 0.7–1.4s 一颗（复用星星池）
    stepDust(v.dust, dt);                                       // 浮尘：y<160 回 700（rng(99) 布局）
    stepRubble(v.rubble, dt, geo);                              // 谷底碎石流（规格 §8）
    for (const m of v.gold) {                                   // 出口金尘上浮循环
      m.y -= m.v * dt;
      if (m.y < geo.groundY - 176) m.y = geo.groundY - 6;       // 升到拱顶下 → 回拱底
    }
    v.puffs = v.puffs.filter(p => { p.r += dt * 40; p.a -= dt * 2; return p.a > 0; });
    // 环境听声点（火把等）：走近自动响，不用按 E
    for (const spot of (w.content.listening || [])) {
      if (!spot.auto) continue;
      const near = Math.abs(w.player.x - spot.x) < spot.r;
      const st = (v.listen ||= {})[spot.id] ||= { near: false };
      if (near && !st.near) w.run(gameEvent(w.game, 'LISTEN', spot.id));
      st.near = near;
    }
  },

  findE(w) {
    const { player, geo, stones } = w;
    let best = null, bd = 1e9;
    const consider = (d, t, r) => { if (d < bd && d <= r) { bd = d; best = t; } };
    for (const s of stones) if (s.state === 'idle') {
      consider(Math.hypot(player.x - s.x, geo.groundY - s.y), { kind: 'stone', ipa: s.ipa, x: s.x, y: s.y, stone: s }, 56);
    }
    consider(Math.abs(player.x - geo.benchX), { kind: 'obj', id: 'bench', x: geo.benchX, y: geo.groundY }, 80);
    for (const spot of (w.content.listening || [])) {           // 听声点：实体物件，走近按 E（auto 的自动响，不占 E）
      if (spot.auto) continue;
      consider(Math.abs(player.x - spot.x), { kind: 'obj', id: spot.id, x: spot.x, y: spot.y }, spot.r);
    }
    if (w.game.hand?.kind === 'item') consider(0, { kind: 'obj', id: 'self', x: player.x, y: player.y }, 0);
    return best;
  },

  onE: chapterOnE(gameEvent, (w, t) => {
    if (w.content.listening?.some(s => s.id === t.id)) w.run(gameEvent(w.game, 'LISTEN', t.id));
    else if (t.id === 'self' && w.game.hand?.kind === 'item') w.run(gameEvent(w.game, 'USE', { word: w.game.hand.word, target: 'player' }));
    else w.sfx.mutter();
  }),

  syncHeld,

  runExtras: {
    hint(w, ins) {                                     // hint 'unlocked' 覆盖文案（不再绑定空格，规格 §10）；其余照常走内容键
      w.ui.setHint(ins.key === 'unlocked' ? HINT_UNLOCKED : ins.key);
    },
    drop(w, ins) {                                     // chasm-try 掉石：hatPuff + 一次性风（规格 §7.1/§9）
      w.sfx.hatPuff();
      windNow(w);
      dropExtra(w => w.geo.chasmL)(w, ins);
    },
    dropBack: dropBackExtra(),
    shrug(w) {
      w.player.squash = 0.9;
      const v = w.view;                                  // chasm-try 光响应（规格 §6.3）
      v.torchBeatT = LIGHT_BEATS.chasmTry; v.torchBeatM = 1.25;    // 双火焰 ×1.25 / 0.5s
      v.chasmBreathT = LIGHT_BEATS.chasmBreath;          // 缝口呼吸 .16→.24→.16 / 1.6s
    },
    bubble(w) { w.view.bubbleT = 2.6; },
    fell(w) {                                          // 坠谷：wind（下坠）+ thud（落地）——不再 mutter（规格 §7.1）
      windNow(w); w.sfx.thud();
      if (w.autoCross) { w.autoCross = false; w.keys?.delete('r'); }   // 自动跳被中断：收回空中右推，防重生后继续冲谷
      w.view.puffs.push({ x: w.player.x, y: w.geo.groundY, r: 8, a: 1 });
      w.view.squeezeT = 1;                               // 暗角收拢（规格 §3.2 fell）
      w.view.chasmDipT = LIGHT_BEATS.chasmDip;           // 缝口暖光 ×0.5 持续 0.6s 再回升（一次「眨眼」，规格 §6.3）
      startFellSlide(w);                                 // 从崖缘滑回（非瞬移；软重生绝不卡死，规格 §3.2）
    },
    revealCard(w, ins) {                               // 合成成功后 +0.9s：卡开 chime + 揭示卡（规格 §7.1/§7.3）
      setTimeout(() => { w.sfx.chime(); w.ui.reveal(ins.word); }, 900);
    },
    crossed(w) {                                       // 过坑（核心成就，一次）：规格 §3.2 拍 11 / §3.4
      const { view: v, player: p } = w;
      p.squash = 0.9;                                  // t0 落地 squash + 尘环
      v.puffs.push({ x: p.x - 14, y: w.geo.groundY, r: 8, a: 1 });
      v.puffs.push({ x: p.x + 14, y: w.geo.groundY, r: 8, a: 1 });
      v.glowT = 1.2;                                   // 预渲染暖晕 (chasmR+50, groundY−80) r280：1.2s 光涌
      v.catLeaveT = CAT.leaveDelay;                    // 猫：落地 1s 内可点；t+1.0s meow 起身向右走远（规格 §9）
      for (let i = 0; i < 22; i++) {                   // 22 金星
        v.stars.push({ x: p.x + (Math.random() - 0.5) * 180, y: p.y - 30 - Math.random() * 130, a: 1, r: 2 + Math.random() * 3 });
      }
      w.sfx.chime();                                   // t0 落地 chime
      setTimeout(() => w.speak('Jump!', 'child'), 200);            // t+0.2s 童声喊 "Jump!"
      setTimeout(() => { windNow(w); v.mistPulse = 1; }, 400);     // t+0.4s 风一阵 + 谷雾被吹散
      setTimeout(() => { v.torchSurge = 0.8; }, 500);              // t+0.5s 对岸火把池 0.8s 涌亮（tick 衰减，draw 读）
      setTimeout(() => w.ui.setHint('exit'), 900);                 // hint 'exit' 延后 0.9s
    },
    teleport(w, ins) {                                 // 通用调试传送原语（规格 §3.5）：位置依赖拍截图用
      w.player.x = ins.x;
      if (ins.y != null) w.player.y = ins.y;
      w.player.vy = 0; w.player.airborne = false; w.player.moving = false;
      w.walkTo = null; w.pending = null;
      if (w.autoCross) { w.autoCross = false; w.keys?.delete('r'); }
      if (w.view) w.view.fellSlide = null;             // 清坠谷滑回 tween
    },
    effect(w, ins) {
      if (ins.name !== 'jumpUnlock') return;
      const v = w.view;
      if (ins.full) {
        w.sfx.hop();                                                       // 起跳 hop（规格 §7.1）
        w.player.vy = -740; w.player.airborne = true;                     // 示范跳
        for (let i = 0; i < 14; i++) {                                     // 14 金星（规格 §3.2 拍 10）
          v.stars.push({ x: w.player.x + (Math.random() - 0.5) * 60, y: w.player.y - 60 - Math.random() * 60, a: 1, r: 3 + Math.random() * 3 });
        }
        showJumpBtn(w);                                                    // #btn-jump 与 unlocked 同拍显示（规格 §10）
        v.demoLand = true;                                                 // hint 延到落地（onLand 给，规格 §3.2 拍 10）
        v.torchBeatT = LIGHT_BEATS.unlock; v.torchBeatM = 1.3;             // 双火把 ×1.3 / 0.6s（规格 §6.3）
        v.chasmBoostT = LIGHT_BEATS.unlock; v.chasmBoostM = 1.2;           // 缝口 +20%
        v.ringT = RING.dur; v.ringX = w.player.x; v.ringY = w.geo.groundY; // 脚下青色声环 r16→64 / 0.6s
      } else w.sfx.glowTick();                                             // 重复使用再念由事件机给 speak（规格 §4）
    }
  },

  summaryMerge(game) {
    return { everPicked: [...game.inv.everPicked], heard: [...game.heard], words: [...game.book], abilities: ['jump'], chapter: 2,
             picks: game.stonesPicked };                  // 2a 声音石拾取数进书档：与 2b 两半合计（规格 §12）
  },

  draw(w, x, eTarget) {
    const { view: v, geo, game, lights: L } = w;
    const sc = lightScales(v, !!game.crossed);                              // 光响应拍倍率（规格 §6.3；s 在 draw 时缩放）
    x.clearRect(0, 0, SIDE.W, SIDE.H);
    if (!w.bg) w.bg = makeBg(w);                                            // 墙/地/陈设一次性预渲染
    x.drawImage(w.bg, 0, 0);
    // 深谷、出口石拱（ᚱ 呼吸 + 金尘为 draw() 动态层）与断崖已烘进背景（makeBg，像素化）
    // 断口两侧：苔藓巨石断崖
    drawCliffCluster(x, geo.chasmL, +1, geo.groundY, 71);
    drawCliffCluster(x, geo.chasmR, -1, geo.groundY, 72);
    x.fillStyle = `rgba(90,100,120,${0.14 + v.mistPulse * 0.2})`;             // 谷雾：crossed 后脉冲变亮变宽（被风吹散）
    for (const m of v.mist) {
      const span = geo.chasmR - geo.chasmL;
      x.beginPath();
      x.ellipse(geo.chasmL + ((m.o * span + Math.sin(m.ph) * 20 + span) % span), geo.groundY + 26 + Math.sin(m.ph * 1.3) * 8, 34 + v.mistPulse * 14, 10, 0, 0, 7);
      x.fill();
    }
    drawWindBanner(x, 1030, geo.groundY, Math.sin(v.t * 1.6 + 0.7) * 0.06);   // 风幡绕顶摆 ±0.06rad（动态层）
    drawTorchSide(x, L.torchL.x, L.torchL.y, v.t, { r: L.torchL.r, a: L.torchL.s * sc.torchL });   // 火把（动态光晕读 LIGHTS2 锚点 × 拍倍率）
    drawTorchSide(x, L.torchR.x, L.torchR.y, v.t,                                  // 对岸火把：crossed 后 0.8s 涌亮
      { r: L.torchR.r * (1 + v.torchSurge * 0.2), a: L.torchR.s * sc.torchR * (1 + v.torchSurge * 1.4) });
    drawBenchSide(x, w.atlases, geo.benchX, geo.groundY, game.hand?.kind === 'stone', v.craftSlots, { candle: true, t: v.t });
    drawCatActor(w, x, v.t);                                                // 对岸橘猫（规格 §9）
    x.save();
    if (w.player.airborne) { x.translate(w.player.x, w.player.y); x.scale(1, 0.92); x.translate(-w.player.x, -w.player.y); }
    if (w.player.squash > 0) { const q = 1 - Math.sin(w.player.squash * Math.PI) * 0.08; x.translate(w.player.x, w.player.y); x.scale(1.06, q); x.translate(-w.player.x, -w.player.y); }
    drawPlayer(x, w.player, v.t, w.atlases);
    x.restore();
    for (const s of w.stones) drawSideStone(x, s, v.t);
    drawFX(w, x);
    // 黄昏级色：角色之后统一压暗（与第一关同法，全场同吃一级大气；值读 sideview.AMBIENT，规格 §6.4）
    x.fillStyle = `rgba(16,18,36,${AMBIENT.grade})`;
    x.fillRect(0, 0, SIDE.W, SIDE.H);
    // —— 级色之上的动态陈设（发光元素不吃压暗）：出口灯塔 / 水光 / 浮尘 / 光响应 ——
    drawExitBeacon(w, x);
    drawLightDelta(w, x, 'chasm', sc.chasm);           // 缝口暖核光响应（呼吸/加亮/压暗；坐标读 LIGHTS2）
    drawLightDelta(w, x, 'exit', sc.exit);             // crossed：出口升档 .12→.20
    drawPuddleGlints(x, 968, 602, v.t);
    drawDust(x, v.dust, v.t, L);
    drawRubble(x, v.rubble);                           // 谷底碎石流（规格 §8）
    drawCrossGlow(w, x);                               // crossed 1.2s 暖晕（预渲染，画在级色之上读作光）
    // 青声元素（脚下声环 / 听声点脉动 / E 提示）最后画：永远压在级色与一切暖光之上（规格 §6）
    drawSoundRing(w, x);                               // unlocked 脚下青色声环（规格 §6.3）
    drawListenSpots(x, w);
    drawEHint(x, eTarget, v.t);
    vignette(x);
    drawFellSqueeze(w, x);                             // 坠谷暗角收拢（规格 §3.2）
  }
};

// —— 裂口断崖：大块苔藓巨石参差咬合（顶面受光、底面没入深渊）+ 路面裂缝 + 碎石 ——
// dir=+1：左路肩（石块伸向裂口右方）；dir=-1：右路肩（伸向左方）
// §8：巨石用独立岩色 #5a5f6b 族（不再与砌墙同色）、块格放大到 26–34px；最上再叠一块压住直切谷缘
function drawCliffCluster(x, ex, dir, gy, seed) {
  const r = rng(seed);
  x.fillStyle = 'rgba(0,0,0,.32)';                         // 巨石压在路缘的接触阴影
  x.beginPath(); x.ellipse(ex + dir * 6, gy + 7, 34, 6, 0, 0, 7); x.fill();
  const rocks = [                                          // 四块巨石自下而上咬合路缘（先画底下层）
    { ox: -10, oy: 86, w: 50, h: 52, moss: 0    },
    { ox: -14, oy: 40, w: 66, h: 60, moss: 0.5  },
    { ox: -20, oy: -12, w: 84, h: 72, moss: 1   },
    { ox: -8, oy: -92, w: 96, h: 88, moss: 1    },         // 再长高 ~80px：压在谷缘上（避开石桥残墩）
  ];
  for (const rk of rocks) {
    const cx = ex + dir * (rk.ox + rk.w / 2);
    const cy = gy + rk.oy + rk.h / 2;
    const rx = rk.w / 2, ry = rk.h / 2;
    const n = 10, pts = [];
    for (let i = 0; i < n; i++) {                          // 墩实圆润的巨石轮廓
      const a = (i / n) * Math.PI * 2 - Math.PI / 2;
      const j = 0.8 + r() * 0.34;
      pts.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]);
    }
    x.save();
    x.beginPath();
    x.moveTo(pts[0][0], pts[0][1]);
    for (const [px, py] of pts.slice(1)) x.lineTo(px, py);
    x.closePath();
    x.save();
    x.clip();
    // 石块本体：独立岩色 #5a5f6b 族块状纹理（错缝凿石，看得出是一块块石头，不再是一团纯色）
    const bx0 = cx - rx - 8, by0 = cy - ry - 8, bw = rk.w + 16, bh = rk.h + 16;
    x.fillStyle = '#22252b';                                  // 灰浆底（冷灰）
    x.fillRect(bx0, by0, bw, bh);
    const cell = 26 + (seed % 9);                             // 块格 26–34px（§8）
    for (let yy = by0, row = 0; yy < by0 + bh; yy += cell, row++) {
      const off = (row % 2) ? cell / 2 : 0;                   // 错缝
      for (let xx = bx0 - off; xx < bx0 + bw; xx += cell) {
        const t = 0.9 + r() * 0.2, inset = 2;
        x.fillStyle = shade('#5a5f6b', t - 1);
        x.fillRect(xx + inset, yy + inset, cell - inset * 2, cell - inset * 2);
        x.fillStyle = shade('#5a5f6b', t - 1 + 0.18);         // 上/左受光
        x.fillRect(xx + inset, yy + inset, cell - inset * 2, 1.5);
        x.fillRect(xx + inset, yy + inset, 1.5, cell - inset * 2);
        x.fillStyle = shade('#5a5f6b', t - 1 - 0.22);         // 下缘沉影
        x.fillRect(xx + inset, yy + cell - inset - 1.5, cell - inset * 2, 1.5);
      }
    }
    if (rk.moss > 0) {                                        // 顶面苔藓盖头（去饱和绿，与砌石苔藓同族）
      x.globalAlpha = 0.55 * rk.moss;
      x.fillStyle = '#446355';
      x.fillRect(cx - rx - 8, cy - ry - 8, rk.w + 16, rk.h * 0.5 + 8);
      x.globalAlpha = 1;
    }
    const sh = x.createLinearGradient(0, cy - ry - 8, 0, cy + ry + 8);   // 顶受光、底没入深渊
    sh.addColorStop(0, 'rgba(255,240,214,.22)');
    sh.addColorStop(0.42, 'rgba(0,0,0,0)');
    sh.addColorStop(1, 'rgba(4,5,9,.74)');
    x.fillStyle = sh;
    x.fillRect(cx - rx - 8, cy - ry - 8, rk.w + 16, rk.h + 16);
    x.restore();
    x.strokeStyle = 'rgba(10,12,18,.9)'; x.lineWidth = 2.5;              // 巨石描边
    x.stroke();
    x.restore();
  }
  x.strokeStyle = 'rgba(20,24,34,.5)'; x.lineWidth = 1.6;   // 路面裂缝（向路里延伸）
  for (let c = 0; c < 2; c++) {
    let cx = ex - dir * (10 + r() * 20), cy = gy + 3 + r() * 5;
    x.beginPath(); x.moveTo(cx, cy);
    for (let i = 0; i < 3; i++) { cx -= dir * (10 + r() * 14); cy += (r() - 0.5) * 7; x.lineTo(cx, cy); }
    x.stroke();
  }
  x.fillStyle = 'rgba(186,190,200,.85)';                    // 散落碎石
  for (let i = 0; i < 5; i++) {
    x.beginPath();
    x.ellipse(ex - dir * (8 + r() * 48), gy + 4 + r() * 12, 2.2 + r() * 2.6, 1.6 + r() * 1.5, 0, 0, 7);
    x.fill();
  }
  x.fillStyle = 'rgba(210,214,224,.9)';                     // 石缝碎屑
  for (let i = 0; i < 3; i++) {
    x.beginPath();
    x.ellipse(ex - dir * (4 + r() * 12), gy + 2 + r() * 5, 1.6 + r() * 1.6, 1.2 + r(), 0, 0, 7);
    x.fill();
  }
}

// ================= 第二关背景：峡谷（像素语言） =================
// 远处崖层剪影：锯齿顶缘 + 顶缘受光（越远越浅），给峡谷纵深
// §8：只画到近景墙顶（bottomY=ridge）——不再画满画布高，最暗层不再盖住前层
function drawFarCliffs(x, topY, color, rim, seed, bottomY = SIDE.H) {
  const r = rng(seed);
  const pts = [];
  for (let px = 0; px <= SIDE.W; px += 22) pts.push([px, topY + (r() * 46 - 12)]);
  x.fillStyle = color;
  x.beginPath(); x.moveTo(0, bottomY); x.lineTo(pts[0][0], pts[0][1]);
  for (const [px, y] of pts.slice(1)) x.lineTo(px, y);
  x.lineTo(SIDE.W, bottomY); x.closePath(); x.fill();
  x.strokeStyle = rim; x.lineWidth = 2; x.beginPath();        // 顶缘受光（远山轮廓）
  x.moveTo(pts[0][0], pts[0][1]); for (const [px, y] of pts.slice(1)) x.lineTo(px, y);
  x.stroke();
}

// —— 缝内对壁：三层后退岩壁（值阶 #2a3546 → #1d2634 → #141a26）——
// 每层顶缘冷色轮廓光 + 层内岩层横纹（α≥.10）+ 层底霾带；越深越暗，读出「对面有崖」
function drawFarWallLayers(x, gx, gw, topY, botY, seed) {
  const r = rng(seed);
  const layers = [
    { c: '#2a3546', inset: 4,  rim: 'rgba(178,196,224,.22)', haze: 'rgba(150,168,192,.15)' },
    { c: '#1d2634', inset: 18, rim: 'rgba(160,180,210,.16)', haze: 'rgba(140,158,184,.13)' },
    { c: '#141a26', inset: 36, rim: 'rgba(148,168,200,.12)', haze: 'rgba(120,146,180,.22)' },   // 底层霾带更强：与渊底渐变接得住
  ];
  const step = (botY - topY) / layers.length;
  for (let i = 0; i < layers.length; i++) {
    const L = layers[i], y0 = topY + i * step;
    const x0 = gx + L.inset, x1 = gx + gw - L.inset;
    const pts = [];
    for (let px = x0; px < x1; px += 20) pts.push([px, y0 + 4 + r() * 18]);   // 顶缘岩肩微起伏
    pts.push([x1, y0 + 4 + r() * 18]);
    x.fillStyle = L.c;
    x.beginPath(); x.moveTo(x0, botY); x.lineTo(pts[0][0], pts[0][1]);
    for (const [px, py] of pts.slice(1)) x.lineTo(px, py);
    x.lineTo(x1, botY); x.closePath(); x.fill();
    for (let k = 0; k < 3; k++) {                                             // 岩层横纹（层内可见带）
      const ly = y0 + 26 + k * ((step - 36) / 3);
      if (ly > y0 + step - 14) break;
      x.fillStyle = `rgba(150,164,186,${0.10 + r() * 0.05})`;
      x.fillRect(x0 + 6, ly, x1 - x0 - 12, 3);
    }
    x.strokeStyle = L.rim; x.lineWidth = 2;                                   // 顶缘冷轮廓光
    x.beginPath(); x.moveTo(pts[0][0], pts[0][1]);
    for (const [px, py] of pts.slice(1)) x.lineTo(px, py);
    x.stroke();
    const hz = x.createLinearGradient(0, y0 + step - 30, 0, y0 + step);       // 层底霾带
    hz.addColorStop(0, 'rgba(90,108,138,0)'); hz.addColorStop(1, L.haze);
    x.fillStyle = hz; x.fillRect(x0, y0 + step - 30, x1 - x0, 30);
  }
}

// 近景崖壁顶缘：崩裂岩脊（压住砌石的平顶，让它读起来是崖顶不是墙头）
function drawRockRidge(x, y, W, seed) {
  const r = rng(seed);
  x.fillStyle = '#2f3139';
  x.beginPath(); x.moveTo(0, y + 46);
  for (let px = 0; px <= W; px += 18) x.lineTo(px, y + (r() * 32 - 6));
  x.lineTo(W, y + 46); x.closePath(); x.fill();
  x.strokeStyle = 'rgba(10,12,18,.75)'; x.lineWidth = 2; x.stroke();
  x.fillStyle = 'rgba(255,240,214,.07)';                       // 岩脊顶受光
  x.fillRect(0, y + 2, W, 2);
}

// 崖台细节：碎石 + 苔簇（让崖台不空、不塑料）
function drawLedgeDetail(x, geo, seed) {
  const r = rng(seed), gy = geo.groundY;
  for (const [bx, bw] of [[0, geo.chasmL], [geo.chasmR, SIDE.W - geo.chasmR]]) {
    for (let i = 0; i < 8; i++) {                              // 碎石
      const px = bx + 24 + r() * (bw - 48), t = 150 + (r() * 44 | 0);
      x.fillStyle = `rgba(${t},${t},${t + 12},.5)`;
      x.beginPath(); x.ellipse(px, gy - 2 - r() * 4, 2 + r() * 3, 1.4 + r() * 1.8, 0, 0, 7); x.fill();
    }
    for (let i = 0; i < 6; i++) {                              // 苔簇 / 草
      const px = bx + 34 + r() * (bw - 68), h = 6 + r() * 9;
      x.strokeStyle = i % 2 ? '#446355' : '#3a5646'; x.lineWidth = 2; x.lineCap = 'round';
      x.beginPath(); x.moveTo(px, gy - 2); x.lineTo(px + (r() - 0.5) * 7, gy - 2 - h); x.stroke();
    }
  }
}

// ================= 2a 陈设（静态件，全部烘进 makeBg；动态层见 draw()） =================

// 行囊与铺盖（底 195）：铺盖卷 + 皮袋 + 斜倚木杖——旅人在这里歇过脚
function drawBedroll(x, bx, gy) {
  x.strokeStyle = PAL.ink; x.lineWidth = 7; x.lineCap = 'round';       // 木杖（衬在铺盖后）
  x.beginPath(); x.moveTo(bx - 30, gy - 2); x.lineTo(bx - 44, gy - 60); x.stroke();
  x.strokeStyle = PAL.wood2; x.lineWidth = 4;
  x.beginPath(); x.moveTo(bx - 30, gy - 2); x.lineTo(bx - 44, gy - 60); x.stroke();
  x.save(); x.translate(bx - 6, gy - 11); x.rotate(-0.03);             // 铺盖卷（横放圆枕）
  x.fillStyle = '#7e6a4f';
  x.beginPath();
  if (x.roundRect) x.roundRect(-30, -9, 60, 18, 9); else x.rect(-30, -9, 60, 18);
  x.fill();
  x.strokeStyle = PAL.ink; x.lineWidth = 2.5; x.stroke();
  x.strokeStyle = 'rgba(40,32,22,.55)'; x.lineWidth = 2;               // 捆绳两道
  x.beginPath(); x.moveTo(-13, -9); x.lineTo(-13, 9); x.moveTo(13, -9); x.lineTo(13, 9); x.stroke();
  x.restore();
  x.save(); x.translate(bx + 24, gy - 15); x.rotate(0.14);             // 皮袋
  x.fillStyle = '#6b4a2e';
  x.beginPath(); x.ellipse(0, 0, 12, 14, 0, 0, 7); x.fill();
  x.strokeStyle = PAL.ink; x.lineWidth = 2.5; x.stroke();
  x.fillStyle = '#553a24'; x.fillRect(-6, -16, 12, 6);                 // 束口
  x.strokeStyle = PAL.ink; x.lineWidth = 2; x.strokeRect(-6, -16, 12, 6);
  x.restore();
}

// 货堆（底 256/314）：大木箱 + 叠小木箱 + 陶罐组（mi 图集 1:1 整倍）
function drawCrates(x, imgs, gy) {
  groundShadow(x, 256, gy, 30, 7, 0.28);
  groundShadow(x, 314, gy, 32, 7, 0.28);
  blit(x, imgs, 'crate_big', 230, gy - 46);
  blit(x, imgs, 'crate_sm', 240, gy - 46 - 45);                        // 小箱叠在大箱上
  blit(x, imgs, 'jars2', 284, gy - 34);
}

// 石桥残墩（签名地标，墩 cx=658 底 600）：砌石墩 + 路边断板 + 向缝下续 4 块渐隐断板
function drawBridgePier(x, cx, gy) {
  groundShadow(x, cx, gy, 38, 8, 0.30);
  const r = rng(83);
  const base = '#6f6a60';
  const blocks = [                                                     // 下宽上窄的墩身（错缝砌块）
    { dy: 0,   w: 58, h: 26 },
    { dy: -26, w: 52, h: 24 },
    { dy: -50, w: 44, h: 24 },
  ];
  for (const b of blocks) {
    const bx = cx - b.w / 2, by = gy + b.dy - b.h;
    x.fillStyle = shade(base, (r() - 0.5) * 0.18);
    x.fillRect(bx, by, b.w, b.h);
    x.fillStyle = shade(base, 0.10);                                   // 上/左受光
    x.fillRect(bx, by, b.w, 2); x.fillRect(bx, by, 2, b.h);
    x.fillStyle = shade(base, -0.26);                                  // 下/右沉影
    x.fillRect(bx, by + b.h - 2, b.w, 2); x.fillRect(bx + b.w - 2, by, 2, b.h);
  }
  const topY = gy - 74, jags = [];                                     // 桥面断掉后的参差石口
  for (let i = 0; i <= 4; i++) jags.push([cx - 22 + i * 11, topY - 4 - r() * 12]);
  x.fillStyle = shade(base, -0.06);
  x.beginPath(); x.moveTo(cx - 22, topY + 2);
  for (const [px, py] of jags) x.lineTo(px, py);
  x.lineTo(cx + 22, topY + 2); x.closePath(); x.fill();
  x.strokeStyle = 'rgba(10,12,18,.85)'; x.lineWidth = 2.5;             // 墩身 + 破口描边
  x.beginPath(); x.moveTo(cx - 29, gy); x.lineTo(cx - 29, gy - 50); x.lineTo(cx - 26, gy - 50);
  x.lineTo(cx - 26, topY + 2); x.lineTo(cx - 22, topY + 2);
  for (const [px, py] of jags) x.lineTo(px, py);
  x.lineTo(cx + 22, topY + 2); x.lineTo(cx + 26, topY + 2);
  x.lineTo(cx + 26, gy - 50); x.lineTo(cx + 29, gy - 50); x.lineTo(cx + 29, gy);
  x.stroke();
  x.save(); x.translate(614, gy - 4); x.rotate(-0.05);                 // 路边断板（旧桥面残片）
  x.fillStyle = '#6e4526'; x.fillRect(-24, -5, 48, 10);
  x.fillStyle = '#8a5a33'; x.fillRect(-24, -5, 48, 3);
  x.strokeStyle = PAL.ink; x.lineWidth = 2; x.strokeRect(-24, -5, 48, 10);
  x.restore();
  const frags = [[16, 10, 44, 9], [48, 38, 36, 8], [78, 74, 28, 7], [104, 116, 20, 6]];
  for (let i = 0; i < frags.length; i++) {                             // 向缝下续 4 块渐隐断板
    const [dx, dy, fw, fh] = frags[i];
    x.save();
    x.globalAlpha = 0.72 - i * 0.17;
    x.translate(cx + 10 + dx, gy + 4 + dy);
    x.rotate(0.24 + i * 0.16);
    x.fillStyle = i % 2 ? '#5d3b20' : '#6e4526';
    x.fillRect(-fw / 2, -fh / 2, fw, fh);
    x.strokeStyle = PAL.ink; x.lineWidth = 1.5; x.strokeRect(-fw / 2, -fh / 2, fw, fh);
    x.restore();
  }
  x.globalAlpha = 1;
}

// 水洼（听声点 shine 的实体，底 968/602）：矢量水面 + 暖竖反光（2 闪粒在 draw() 动态）
function drawPuddle(x, px, py) {
  groundShadow(x, px, py, 30, 6, 0.26);
  x.fillStyle = '#2b4a5e';
  x.beginPath(); x.ellipse(px, py, 30, 7, 0, 0, 7); x.fill();
  x.strokeStyle = 'rgba(10,12,18,.7)'; x.lineWidth = 2; x.stroke();
  x.fillStyle = 'rgba(255,214,130,.30)';                               // 暖竖反光（对岸/出口的光落在水上）
  x.fillRect(px - 2, py - 5, 3, 9); x.fillRect(px + 7, py - 3, 2, 6);
  x.fillStyle = 'rgba(150,200,220,.18)';                               // 冷天光横纹
  x.fillRect(px - 18, py - 1, 12, 2); x.fillRect(px + 11, py + 1, 9, 1.5);
}

// 风幡（气氛，杆底 1030）：矢量木杆 + 撕口布幡（绕顶摆 ±0.06rad 由 draw() 动态层负责）
function drawWindBanner(x, bx, gy, sway = 0) {
  groundShadow(x, bx, gy, 14, 4, 0.24);
  x.fillStyle = PAL.wood2; x.fillRect(bx - 2, gy - 152, 4, 152);       // 木杆
  x.strokeStyle = PAL.ink; x.lineWidth = 2; x.strokeRect(bx - 2, gy - 152, 4, 152);
  x.save();
  x.translate(bx + 2, gy - 150); x.rotate(sway);                       // 摆动轴 = 杆顶
  x.fillStyle = '#8c4f42';                                             // 撕口布幡（3 段撕口）
  x.beginPath();
  x.moveTo(0, 2); x.lineTo(44, 10); x.lineTo(30, 22);
  x.lineTo(50, 30); x.lineTo(26, 42); x.lineTo(36, 52); x.lineTo(0, 54);
  x.closePath(); x.fill();
  x.strokeStyle = PAL.ink; x.lineWidth = 2; x.stroke();
  x.fillStyle = 'rgba(255,236,200,.16)';                               // 布面受光
  x.beginPath(); x.moveTo(0, 2); x.lineTo(44, 10); x.lineTo(30, 22); x.lineTo(0, 20); x.closePath(); x.fill();
  x.restore();
}

// 火把铁托架（与第一关同款金属件，垫在火把柄下）
function drawTorchBracket(x, tx, ty) {
  x.fillStyle = '#4b4f5a';
  x.beginPath(); x.moveTo(tx - 10, ty); x.lineTo(tx + 10, ty); x.lineTo(tx + 5, ty + 10); x.lineTo(tx - 5, ty + 10); x.closePath(); x.fill();
  x.strokeStyle = PAL.ink; x.lineWidth = 1.5; x.stroke();
}

function makeBg(w) {
  const { geo } = w;
  const c = document.createElement('canvas');
  c.width = SIDE.W; c.height = SIDE.H;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  const gy = geo.groundY, wallH = gy - 16;
  const ridge = 176;                                           // 近景崖壁顶缘：其上露出天与远山（峡谷纵深）
  const segs = [[0, geo.chasmL], [geo.chasmR, SIDE.W - geo.chasmR]];   // 裂缝两侧的两块崖体
  const er = rng(43);                                          // 谷缘错位折线的抖动
  // 黄昏天幕（像素化：色带 + 拜耳抖动）
  pixelGradientV(x, 0, SIDE.W, 0, gy, [[0, '#0c1320'], [0.5, '#182233'], [0.82, '#28313f'], [1, '#39414d']]);
  // 远处崖层剪影（三层，越远越浅、顶缘受光）——只画到近景墙顶 ridge，最暗层不再盖住前层
  drawFarCliffs(x, 58,  '#2b3646', 'rgba(150,168,192,.10)', 11, ridge);
  drawFarCliffs(x, 104, '#212b3a', 'rgba(140,158,184,.09)', 23, ridge);
  drawFarCliffs(x, 150, '#18202d', 'rgba(130,148,176,.08)', 37, ridge);
  // 缝内对壁：三层后退岩壁（值阶 #2a3546 → #1d2634 → #141a26），替换平色天空
  drawFarWallLayers(x, geo.chasmL, geo.chasmR - geo.chasmL, 200, gy, 61);
  // 近景崖壁：砌石（自 ridge 起），顶缘压一道崩裂岩脊。
  // 关键：裂缝处整面断开——峡谷贯穿上下，缝里透出天与远山，才读得出"悬崖"。
  const floorH = SIDE.H - gy;
  const slabRows = slabPlan(31, SIDE.W, gy, floorH);
  for (const [bx, bw] of segs) {
    x.save(); x.beginPath(); x.rect(bx, 0, bw, wallH); x.clip();
    x.save(); x.translate(0, ridge);
    paintMasonry(x, masonryPlan(23, SIDE.W, wallH - ridge), SIDE.W, wallH - ridge);
    x.restore();
    drawRockRidge(x, ridge, SIDE.W, 31);
    x.restore();
    // 断崖立面：缝两侧的切面压暗 + 错位谷缘折线（让它像被劈开的岩体）
    const ex = bx === 0 ? geo.chasmL : geo.chasmR;
    const inLeft = bx === 0;                                   // 左块：切面在其右缘
    const gapDir = inLeft ? 1 : -1;                            // 谷缘朝向裂口的方向
    const eg = x.createLinearGradient(ex, 0, ex + (inLeft ? -1 : 1) * 34, 0);
    eg.addColorStop(0, 'rgba(0,0,0,.5)'); eg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = eg; x.fillRect(inLeft ? ex - 34 : ex, ridge, 34, wallH - ridge);
    // §8 谷缘：2–3 段错位折线（起伏 ≥6px），不再是一条 2px 直边；外加受光边
    const ep = [];
    for (let i = 0; i <= 3; i++) {
      const yy = ridge + (wallH - ridge) * i / 3;
      const jit = (i === 0 || i === 3) ? 0 : (6 + er() * 8) * (er() < 0.5 ? -1 : 1);
      ep.push([ex + jit, yy]);
    }
    x.strokeStyle = 'rgba(8,10,14,.85)'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(ep[0][0], ep[0][1]);
    for (const [px, py] of ep.slice(1)) x.lineTo(px, py);
    x.stroke();
    x.strokeStyle = 'rgba(255,226,170,.16)'; x.lineWidth = 1.4;  // 受光边：缝口暖光擦过切缘
    x.beginPath(); x.moveTo(ep[0][0] + gapDir * 2.5, ep[0][1]);
    for (const [px, py] of ep.slice(1)) x.lineTo(px + gapDir * 2.5, py);
    x.stroke();
    // 石质基座带（墙脚踢脚线，随崖体断开）
    x.fillStyle = '#5d5a52'; x.fillRect(bx, wallH, bw, 16);
    x.fillStyle = '#7b7669'; x.fillRect(bx, wallH, bw, 4);
    x.fillStyle = '#3a3833'; x.fillRect(bx, wallH + 12, bw, 4);
    // 地：大块凿石板（seed 31），随崖体断开
    x.save(); x.beginPath(); x.rect(bx, gy, bw, floorH); x.clip();
    paintSlabs(x, slabRows, SIDE.W, gy, floorH);
    x.restore();
  }
  // 深谷：渊底向 #070a0f 收（现渐变保留；岩层横纹由缝内三层对壁承担）
  pixelGradientV(x, geo.chasmL, geo.chasmR, gy, SIDE.H, [[0, '#33404f'], [0.42, '#1d2634'], [1, '#070a0f']]);
  // 崖台细节：碎石 + 苔簇
  drawLedgeDetail(x, geo, 53);
  // —— 陈设（静态件，§5.1）：拱门 / 火把托架 / 行囊铺盖 / 货堆 / 石桥残墩 / 水洼 ——
  // （风幡摆动、ᚱ 呼吸、金尘、水光、浮尘、余烬等会动/呼吸的件在 draw() 动态层）
  drawArchSide(x, 60, gy, { rune: 'ᚵ' });                      // 入口拱（ᚵ 阴刻，不发光）
  groundShadow(x, 60, gy, 62, 9, 0.30);
  drawArchSide(x, geo.exitX, gy, { rune: 'ᚱ', runeGlow: 1, runeColor: 'rgba(140,240,220,.6)' });   // 出口拱（呼吸符文与 12 金尘为 draw() 动态层，锚点 (exitX, gy)）
  groundShadow(x, geo.exitX, gy, 62, 9, 0.30);
  drawTorchBracket(x, 90, 266); drawTorchBracket(x, geo.chasmR + 120, 266);   // 火把铁托架
  groundShadow(x, 195, gy, 36, 8, 0.28);                       // 行囊与铺盖
  drawBedroll(x, 195, gy);
  drawCrates(x, w.atlases, gy);                                // 货堆：木箱×2 + 陶罐组
  drawBridgePier(x, 658, gy);                                  // 石桥残墩（签名地标）
  drawPuddle(x, 968, 602);                                     // 水洼（听声点 shine 实体；2 闪粒在 draw()）
  x.fillStyle = 'rgba(255,236,200,.09)';                       // 地面顶缘亮线（裂缝两侧）
  x.fillRect(0, gy, geo.chasmL, 2); x.fillRect(geo.chasmR, gy, SIDE.W - geo.chasmR, 2);
  const fsh = x.createLinearGradient(0, gy - 8, 0, gy + 36);   // 墙脚落地阴影
  fsh.addColorStop(0, 'rgba(0,0,0,.30)'); fsh.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = fsh; x.fillRect(0, gy - 8, SIDE.W, 44);
  const gsh = x.createLinearGradient(0, gy, 0, gy + 130);      // 地面下部压暗
  gsh.addColorStop(0, 'rgba(0,0,0,0)'); gsh.addColorStop(1, 'rgba(0,0,0,.42)');
  x.fillStyle = gsh;
  x.fillRect(0, gy, geo.chasmL, 130); x.fillRect(geo.chasmR, gy, SIDE.W - geo.chasmR, 130);
  // 光池烘焙：唯一事实源 LIGHTS2（暖火族一色）——火把/蜡烛/缝口/出口同表同坐标，一次预渲染（规格 §6.2-①）
  for (const t of Object.values(w.lights)) pixelGlow(x, t.x, t.y, t.r, [255, 198, 112], t.s);
  w.crossGlow = makeCrossGlow(geo);                          // crossed 暖晕一次性预渲染（draw 直接贴图，规格 §3.2 拍 11）
  // 黄昏级色不再烘焙进背景：改到 draw() 角色之后统一压暗（与第一关同法）
  return c;
}

// ================= 2a 动态陈设（draw() 层：会动/呼吸的件；全部矢量，无逐帧 ImageData） =================

// 过坑暖晕（一次性预渲染）：跨过裂口时在 (chasmR+50, groundY−80) r280 涌起 1.2s（规格 §3.2 拍 11）
function makeCrossGlow(geo) {
  const R = 280, c = document.createElement('canvas');
  c.width = c.height = R * 2;
  const g = c.getContext('2d');
  const rg = g.createRadialGradient(R, R, 6, R, R, R);
  rg.addColorStop(0, 'rgba(255,214,140,.85)');
  rg.addColorStop(0.45, 'rgba(255,196,120,.38)');
  rg.addColorStop(1, 'rgba(255,190,110,0)');
  g.fillStyle = rg; g.fillRect(0, 0, R * 2, R * 2);
  return { cv: c, x: geo.chasmR + 50, y: geo.groundY - 80, r: R };   // 当前几何 = (990,520)
}

function drawCrossGlow(w, x) {
  const v = w.view, g = w.crossGlow;
  if (!v.glowT || !g) return;
  x.globalAlpha = Math.min(1, v.glowT / 0.5);              // 前 0.7s 满档，末 0.5s 淡出
  x.drawImage(g.cv, g.x - g.r, g.y - g.r);
  x.globalAlpha = 1;
}

// 光锚的拍增量：m>1 暖增（总读 s×m）；m<1 黑罩压暗（总读 s×m）。坐标/半径读 LIGHTS2，不复制（规格 §6.3）
function drawLightDelta(w, x, key, m) {
  if (Math.abs(m - 1) < 0.02) return;
  const L = w.lights[key];
  const g = x.createRadialGradient(L.x, L.y, 4, L.x, L.y, L.r);
  if (m > 1) {
    g.addColorStop(0, `rgba(255,198,112,${Math.min(1, L.s * (m - 1))})`);
    g.addColorStop(1, 'rgba(255,198,112,0)');
  } else {
    g.addColorStop(0, `rgba(5,7,12,${Math.min(1, 1 - m)})`);
    g.addColorStop(1, 'rgba(5,7,12,0)');
  }
  x.fillStyle = g;
  x.beginPath(); x.arc(L.x, L.y, L.r, 0, 7); x.fill();
}

// 脚下青色声环（unlocked 拍）：r16→64、0.6s，压在级色之上（规格 §6.3）
function drawSoundRing(w, x) {
  const v = w.view;
  if (!(v.ringT > 0)) return;
  const p = 1 - v.ringT / RING.dur;
  const r = RING.r0 + (RING.r1 - RING.r0) * p;
  x.strokeStyle = `rgba(84,224,200,${0.55 * (1 - p)})`;
  x.lineWidth = 3.5;
  x.beginPath(); x.ellipse(v.ringX, v.ringY + 2, r, r * 0.38, 0, 0, 7); x.stroke();
}

// 坠谷暗角收拢：fell 后 1.2s 内收紧再放开（规格 §3.2「暗角收拢」）
function drawFellSqueeze(w, x) {
  const k = w.view.squeezeT;
  if (!(k > 0)) return;
  const g = x.createRadialGradient(640, 360, 380 - 150 * k, 640, 360, 780 - 180 * k);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, `rgba(0,0,0,${0.5 * k})`);
  x.fillStyle = g; x.fillRect(0, 0, SIDE.W, SIDE.H);
}

// 谷底碎石/尘埃流（规格 §8）：动态稀疏；绘制时轻摆（模拟中只沿谷底 120px 下落）
function drawRubble(x, list) {
  x.fillStyle = 'rgba(198,204,216,.5)';
  for (const m of list) {
    x.fillRect(m.x + Math.sin(m.ph + m.y / 24) * 2 - m.sz / 2, m.y, m.sz, m.sz * 1.4);
  }
}

// 对岸橘猫（规格 §9）：复用 actors.js drawCat；离场时补一点颠步（不改 actors.js）
function drawCatActor(w, x, t) {
  const c = w.actors?.cat;
  if (!c || c.gone) return;
  if (c.seated !== false) { drawCat(x, c, t); return; }
  x.save();
  x.translate(c.x, c.y - Math.abs(Math.sin(t * 9)) * 2.5);
  drawCat(x, { x: 0, y: 0, earT: c.earT, meowT: c.meowT }, t);
  x.restore();
}

// 出口金尘：12 粒在拱洞内循环上浮（rng(7) 定布局；规格 §5.1#10「ᚱ 灯塔 + 洞内暖金 + 12 金尘」）
function makeGoldMotes(geo) {
  const r = rng(7), out = [];
  for (let i = 0; i < 12; i++) {
    out.push({ x: geo.exitX - 34 + r() * 68, y: geo.groundY - 8 - r() * 160, v: 12 + r() * 16, ph: r() * 6.28 });
  }
  return out;
}

// 余烬：每火把 0.7–1.4s 一颗，复用星星池（kind:'ember' 供 drawFX 与庆祝金星区分；规格 §6.4）
function stepEmbers(w, dt) {
  const v = w.view, srcs = [w.lights.torchL, w.lights.torchR];
  for (let i = 0; i < srcs.length; i++) {
    v.emberT[i] -= dt;
    if (v.emberT[i] > 0) continue;
    v.emberT[i] = 0.7 + Math.random() * 0.7;
    const s = srcs[i];
    v.stars.push({ x: s.x + (Math.random() - 0.5) * 8, y: s.y - 6, a: 1, r: 1.5 + Math.random() * 1.5, kind:'ember' });
  }
}

// 出口灯塔：ᚱ 呼吸青（α .35→.7）+ 12 金尘上浮——画在级色之上，读作「光」（规格 §5.1#10 / §3.2 拍 13）
function drawExitBeacon(w, x) {
  const { view: v, lights: L, game } = w;
  const rx = L.exit.x, ry = L.exit.y - 44;                     // 拱顶符文位（drawArchSide：baseY−230+6）
  const amp = game?.crossed ? 0.8 : 0.5;                       // crossed：呼吸振幅 ×1.6（规格 §6.3）
  const breathe = Math.max(0, 0.5 + Math.sin(v.t * 1.1) * amp);
  const g = x.createRadialGradient(rx, ry, 4, rx, ry, 64);
  g.addColorStop(0, `rgba(84,224,200,${0.30 * breathe})`);
  g.addColorStop(1, 'rgba(84,224,200,0)');
  x.fillStyle = g; x.beginPath(); x.arc(rx, ry, 64, 0, 7); x.fill();
  x.fillStyle = `rgba(140,240,220,${0.35 + breathe * 0.35})`;  // 呼吸 α .35→.7
  x.font = '26px serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText('ᚱ', rx, ry);
  x.fillStyle = '#ffd98a';                                     // 洞内暖金：12 金尘上浮
  for (const m of v.gold) {
    x.globalAlpha = 0.35 + 0.45 * (0.5 + Math.sin(v.t * 2.1 + m.ph) * 0.5);
    x.fillRect(m.x + Math.sin(v.t * 1.3 + m.ph) * 2.5 - 1.1, m.y, 2.2, 2.2);
  }
  x.globalAlpha = 1;
}

// 水洼 2 闪粒：两枚错相位的十字星闪（规格 §5.1#7）
function drawPuddleGlints(x, px, py, t) {
  for (const [gx, gy, ph] of [[px - 9, py - 4, 0], [px + 11, py - 2, 1.9]]) {
    const k = Math.max(0, Math.sin(t * 2.4 + ph));
    if (k < 0.2) continue;
    x.fillStyle = `rgba(255,238,196,${0.3 + k * 0.6})`;
    x.fillRect(gx - 3.2, gy - 0.7, 6.4, 1.4);
    x.fillRect(gx - 0.7, gy - 3.2, 1.4, 6.4);
  }
}

function drawFX(w, x) {
  const v = w.view, p = w.player;
  for (const st of v.stars) {
    x.globalAlpha = st.a;
    if (st.kind === 'ember') {                                 // 余烬：暖橙小星，上飘更远、轻摆
      x.fillStyle = '#ffb347';
      x.beginPath(); x.arc(st.x + Math.sin((v.t + st.x) * 5) * 1.4, st.y - (1 - st.a) * 46, st.r, 0, 7); x.fill();
      continue;
    }
    x.fillStyle = PAL.gold;
    x.beginPath(); x.arc(st.x, st.y - (1 - st.a) * 30, st.r, 0, 7); x.fill();
  }
  for (const pf of v.puffs) {
    x.globalAlpha = pf.a * 0.5;
    x.fillStyle = '#cfc9ba';
    x.beginPath(); x.arc(pf.x, pf.y - 6, pf.r, 0, 7); x.fill();
  }
  x.globalAlpha = 1;
  if (v.bubbleT <= 0) return;
  const a = Math.min(1, v.bubbleT / 0.4);
  const bx = p.x + 8, by = p.y - 108;
  x.save();
  x.globalAlpha = a;
  x.fillStyle = 'rgba(247,244,234,.95)';
  x.beginPath();
  if (x.roundRect) x.roundRect(bx - 44, by - 30, 88, 52, 14); else x.rect(bx - 44, by - 30, 88, 52);
  x.fill();
  x.beginPath(); x.moveTo(bx - 6, by + 22); x.lineTo(bx + 2, by + 36); x.lineTo(bx + 10, by + 22); x.closePath(); x.fill();
  x.lineWidth = 2.5; x.strokeStyle = PAL.ink; x.strokeRect(bx - 44, by - 30, 88, 52);
  const fx = bx - 20, fy = by + 2;
  x.strokeStyle = PAL.ink; x.lineWidth = 2.5;
  x.beginPath(); x.arc(fx, fy - 12, 4, 0, 7); x.stroke();
  x.beginPath(); x.moveTo(fx, fy - 8); x.lineTo(fx, fy + 2); x.stroke();
  x.beginPath(); x.moveTo(fx, fy - 4); x.lineTo(fx - 6, fy - 12); x.stroke();
  x.beginPath(); x.moveTo(fx, fy - 4); x.lineTo(fx + 6, fy - 12); x.stroke();
  x.beginPath(); x.moveTo(fx, fy + 2); x.lineTo(fx - 5, fy + 10); x.stroke();
  x.beginPath(); x.moveTo(fx, fy + 2); x.lineTo(fx + 5, fy + 10); x.stroke();
  x.strokeStyle = '#e5484d'; x.lineWidth = 5; x.lineCap = 'round';        // 红叉（用户指定）
  x.beginPath(); x.moveTo(bx + 8, by - 14); x.lineTo(bx + 34, by + 12); x.stroke();
  x.beginPath(); x.moveTo(bx + 34, by - 14); x.lineTo(bx + 8, by + 12); x.stroke();
  x.restore();
}

mount(kit);
