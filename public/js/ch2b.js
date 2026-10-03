// —— 析声者 · 第二间房·崖壁（rope：r·əʊ·p；əʊ/p 为旧识凝石）——
import { createInventory } from './hotbar.js';
import { pickupStone, bankHeld, holdItem, craftWord,
         chapterOnE, syncHeld, seedBegin, dropExtra, dropBackExtra, stepWorldStones } from './chapter.js';

// ================= 纯事件机（Node 可测，行为与重构前一致；公共段见 chapter.js） =================
export function createGame(content, profile) {
  return {
    content, beat: 'start',
    inv: createInventory(),
    book: new Set(), stonesPicked: 0,
    hand: null, attempted: false,
    mended: profile.abilities.includes('climb') ? true : false,
    climbed: false, exited: false, heard: new Set(), teaseClock: 0
  };
}

export function startGame(g) {
  return [{ t: 'hint', key: 'start' }, { t: 'beat', beat: 'start' }];
}

export function gameEvent(g, ev, arg = null) {
  const c = g.content;
  switch (ev) {
    case 'ROPE': {
      const first = !g.attempted;
      g.attempted = true;
      const out = [
        { t: 'speak', who: 'door', text: c.flows.rope.listen[0], slow: true },
        { t: 'speak', who: 'child', text: c.flows.rope.puzzled[0] },
        { t: 'sfx', name: 'strain' },                          // 低语/童声 + strain（规格 §7.1）
        { t: 'ropeFirst' }                                     // 绳尾一摆 + 断口纤维散开（规格 §3.3 拍 5）
      ];
      if (first) out.push({ t: 'drop', word: 'rope' }, { t: 'hint', key: 'carrying' });   // 掉 r + 干扰 h/m（decoys）
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
      if (g.mended) return [{ t: 'effect', name: 'mendRope', full: false }];
      g.mended = true; g.hand = null;
      return [{ t: 'hand' }, { t: 'effect', name: 'mendRope', full: true }];
    }
    case 'CLIMBED': {
      if (g.climbed) return [];
      g.climbed = true;
      return [{ t: 'hint', key: 'top' }, { t: 'beat', beat: 'top' }, { t: 'topReached' }];   // chime + wind + 窗醒（规格 §3.3 拍 9）
    }
    case 'EXIT': {
      if (g.exited) return [];
      g.exited = true;
      g.beat = 'summary';
      return [{ t: 'summary' }];
    }
    case 'LISTEN': {                                          // 听声点：走近按 E 触发（纯听觉，不进库存）
      const spot = (c.listening || []).find(s => s.id === arg);
      if (!spot) return [];
      return [{ t: 'sfx', name: 'glowTick' }, { t: 'echo', ipas: spot.echo, say: spot.say }];
    }
    case 'TICK': {
      g.teaseClock += arg;
      if (g.teaseClock < 45) return [];
      g.teaseClock = 0;
      if (!g.attempted) return [{ t: 'hint', key: 'start' }];
      if (!g.book.has('rope')) return [{ t: 'hint', key: 'carrying' }];
      if (!g.mended) return [{ t: 'hint', key: 'give' }];
      if (!g.climbed) return [{ t: 'hint', key: 'mended' }];
      return [{ t: 'hint', key: 'top' }];
    }
    default:
      return [];
  }
}

export function ropeDebug(g, beat) {
  switch (beat) {
    case 'rope-first': case 'drop': return gameEvent(g, 'ROPE');            // 拍名总表 + 旧调试名别名（规格 §3.6）
    case 'craft-rope': case 'crafted': {
      let out = ropeDebug(g, 'rope-first');
      for (const [ipa] of g.content.words.rope.phonemes) {
        out = out.concat(gameEvent(g, 'PICKUP', ipa), gameEvent(g, 'BANK'));
      }
      return out.concat(gameEvent(g, 'CRAFT', 'rope'));
    }
    case 'mend-rope': case 'mended':
      return ropeDebug(g, 'craft-rope').concat(gameEvent(g, 'USE', { word: 'rope', target: 'rope' }));
    case 'climb': return ropeDebug(g, 'mend-rope').concat([{ t: 'climbUp' }]);   // 位置依赖拍：绳下起爬（规格 §3.5）
    case 'top': {                                                               // 位置依赖拍：传送到顶台再登顶演出
      const geo = g.content.geometry;
      return ropeDebug(g, 'mend-rope').concat([{ t: 'teleport', x: geo.wallX + 35, y: geo.topY }, gameEvent(g, 'CLIMBED')]);
    }
    case 'window': return ropeDebug(g, 'top').concat([{ t: 'windowExit' }]);     // 位置依赖拍：窗边推窗
    default: return [];
  }
}

// ================= 浏览器 kit（壳 + 横版共用件） =================
import { mount } from './shell.js';
import { SIDE, moveSide, sideJump, stepWalkTo,
         drawSideStone, drawTorchSide, drawBenchSide, drawEHint, vignette, drawFloorSide, drawListenSpots,
         drawArchSide, groundShadow, benchCandle } from './sideview.js';
import { PAL, drawRune, iconURL } from './art.js';
import { blit } from './sprites.js';
import { createActors, updateActors, drawPlayer, drawCat } from './actors.js';
import { screenToLogical } from './ch1/physics.js';
import { rng, masonryPlan, slabPlan } from './ch1/planners.js';
import { shade, paintMasonry, paintSlabs, pixelGlow } from './masonry.js';

// —— 2b 光法则（唯一事实源，规格 §6.1 2b 表 / §6.2）：一个光源 = 一个坐标 = 烘焙光池（makeBg）
//    = 动态光晕（draw）= 面纱挖孔（makeVeil）。veil = 夜色面纱挖孔半径与强度（仅 2b，规格 §6.2-③）——
export function LIGHTS2(geo) {
  return {
    torch:  { x: 240, y: 240, r: 180, s: 0.26, veil: { r: 180, s: 0.85 } },                          // 左火把（= warm 听声点实体）
    rope:   { x: 868, y: 430, r: 170, s: 0.20, veil: { r: 170, s: 0.80 } },                          // 绳位火把（照亮绳根与绞盘）
    candle: { ...benchCandle(geo.benchX, geo.groundY), r: 110, s: 0.20, veil: { r: 120, s: 0.72 } }, // 合成台蜡烛 (benchX+62, groundY−90)
    window: { x: geo.exitX, y: geo.topY, r: 200, s: 0.28, veil: { r: 230, s: 0.80 } }                // 高窗（出口 + 攀登灯塔）
  };
}

// —— 窗台橘猫（跨半场活物，规格 §9）：坐 (935,120) 先到一步；window 拍先钻出窗 ——
export const CATB = { x: 935, speed: 90 };                 // 90px/s：约 0.5s 走到窗 (980) 钻出

// —— 指针命中表（纯函数；顺序镜像 findE：石 → 合成台 → 听声点 stone/high → 绳 → 窗）——
// 绳只在绳下（地面）可点、窗只在顶台可点——与 findE 的可交条件同源（规格 §10）
export function tapTargetAt(w, p) {
  const { geo, player, stones } = w;
  let best = null, bd = 1e9;
  const consider = (d, t, r) => { if (d < bd && d <= r) { bd = d; best = t; } };
  for (const s of stones) if (s.state === 'idle') {
    consider(Math.hypot(p.x - s.x, p.y - s.y), { kind: 'stone', ipa: s.ipa, x: s.x, y: s.y, stone: s }, 44);
  }
  consider(Math.abs(p.x - geo.benchX), { kind: 'obj', id: 'bench', x: geo.benchX, y: geo.groundY }, 80);
  for (const spot of (w.content.listening || [])) {        // 听声点：auto 的自动响，不占指针（stone/high）
    if (spot.auto) continue;
    consider(Math.hypot(p.x - spot.x, p.y - spot.y), { kind: 'obj', id: spot.id, x: spot.x, y: spot.y }, spot.r);
  }
  const ropeX = geo.wallX + 12;
  if (player.y >= geo.groundY - 20) {
    consider(Math.abs(p.x - ropeX), { kind: 'obj', id: 'rope', x: ropeX, y: geo.groundY }, 65);
  }
  if (player.y <= geo.topY + 2) {
    consider(Math.abs(p.x - geo.exitX), { kind: 'obj', id: 'exit', x: geo.exitX, y: geo.topY }, 80);
  }
  return best;
}

// —— #btn-jump 触屏跳键（规格 §10）：右下圆钮，有 jump 能力即显示；pointerdown → onSpace ——
function showJumpBtn(w) {
  if (typeof document === 'undefined') return;
  const btn = document.getElementById?.('btn-jump');       // 无 DOM（Node 测试 mock）时静默
  if (!btn) return;
  if (!btn.firstChild) btn.innerHTML = `<img src="${iconURL('jump')}" alt="">`;   // 图标只装一次
  btn.classList.remove('hidden');
}
function wireJumpBtn(w, signal) {
  if (typeof document === 'undefined') return;
  const btn = document.getElementById?.('btn-jump');
  if (!btn) return;
  btn.addEventListener('pointerdown', () => kit.onSpace(w), { signal });
  if (w.canJump) showJumpBtn(w);                           // 书档已有 jump：进场即显示
}

export const kit = {
  chapter: 2, contentId: '2b', W: SIDE.W, H: SIDE.H, titleRune: 'ᚱ',

  createGame, startGame, gameEvent, debug: ropeDebug,

  // 崖壁走到尽头：无缝交接进入第三间房（暗河）——壳读 kit.next
  next: { chapter: 3, page: 'chapter3.html', load: () => import('./ch3.js').then(m => m.kit) },
  summaryFirst: true,                                      // 章末先出结算卡，[下一间房 →] 再交接（规格 §7.4）

  voices: v => ({
    child: { voice: v.child, pitch: 1.25, rate: 1, rateSlow: 0.8 },
    door: { voice: v.door, pitch: 0.7, rate: 0.8, rateSlow: 0.6 }
  }),

  makeWorld({ content, profile, game, cv, signal }) {
    const geo = content.geometry;
    const ropeX = geo.wallX + 12;
    const actors = createActors();
    const player = actors.player;
    player.x = geo.spawnX; player.y = geo.groundY; player.dir = 'right';
    player.vy = 0; player.airborne = false; player.climbing = false;
    const cat = actors.cat;                                    // 窗台橘猫：坐 (935,120) 先到一步（规格 §9）
    cat.x = CATB.x; cat.y = geo.topY; cat.seated = true; cat.gone = false; cat.vx = 0;
    const canJump = profile.abilities.includes('jump');
    const w = {
      actors, player, geo, canJump, cv,
      lights: LIGHTS2(geo),                                    // 光锚唯一事实源（烘焙光池/动态光晕/面纱挖孔共用，规格 §6.1 2b 表）
      stones: [],
      walkTo: null, pending: null,                             // 点哪走哪（指针 → walkTo + pending；tick 到位 doE，规格 §10）
      view: {
        t: 0, puffs: [], ropeMendT: 0, winOpen: false,
        swayKick: 0, tautT: 0,                                 // 断绳一摆 / 绷直一沉（Task 16）
        climbT: 0, climbStrain: 0,                             // 攀爬 strain 节律（每 0.6s，≤6 次）
        mendPuffT: 0, fibres: [],                              // 重编纤维 puff 节拍 + 断口/生长纤维粒子
        winT: 0, motes: [], catGo: false                       // 推窗 hold 计时 / 12 风尘扑入 / 猫先钻出窗
      },
      cfg: {
        wall: { X: geo.wallX, W: geo.wallW, topY: geo.topY, blockGround: false },  // 出口已是高窗：窗户以下墙面畅通，仅保留墙顶平台
        rope: { ok: () => w.game.mended, x: () => ropeX },
        canJump
      }
    };
    const updateRopeCursor = e => {
      if (w.game?.mended) { cv.style.cursor = 'default'; return; }
      const p = screenToLogical(e.clientX, e.clientY, cv.getBoundingClientRect());
      const hit = p.inside && Math.hypot(p.x - ropeX, p.y - (geo.topY + 192)) <= 60;
      cv.style.cursor = hit ? 'pointer' : 'default';
    };
    cv.style.cursor = 'default';
    cv.addEventListener('pointermove', updateRopeCursor, { signal });
    cv.addEventListener('pointerleave', () => { cv.style.cursor = 'default'; }, { signal });
    wireJumpBtn(w, signal);                                    // #btn-jump 触屏跳键（页面无此钮则静默）
    return w;
  },

  onBegin(w) { seedBegin(w); },                   // 开局记忆石：只带本章需要的旧音素（əʊ、p）

  onSpace(w) { if (w.canJump) { sideJump(w); w.sfx.click(); } },

  tick(w, dt) {
    const { view: v, geo, player } = w;
    const ropeX = geo.wallX + 12;
    v.t += dt;
    v.ropeMendT = Math.max(0, v.ropeMendT - dt);
    v.swayKick = Math.max(0, v.swayKick - dt * 1.6);       // 断绳一摆回稳
    v.tautT = Math.max(0, v.tautT - dt);                   // 绷直一沉回稳
    updateActors(w.actors, dt);
    if (player.climbing) {
      v.climbT += dt;
      if (v.climbT >= 0.6) {                               // strain 节律每 0.6s（≤6 次）+ 每拍落尘（规格 §3.3 拍 8）
        v.climbT -= 0.6;
        if (v.climbStrain < 6) { w.sfx.strain(); v.climbStrain++; }
        v.puffs.push({ x: player.x + (Math.random() - 0.5) * 10, y: player.y - 8, r: 2.5, a: 1 });
      }
      player.x = ropeX;
      player.y -= 170 * dt;
      player.dir = 'up';
      player.moving = true;
      player.walkT += dt;
      player.airborne = false;
      if (player.y <= geo.topY) {
        player.y = geo.topY;
        player.x = geo.wallX + 35;
        player.climbing = false;
        player.moving = false;
        w.run(gameEvent(w.game, 'CLIMBED'));               // chime + wind + 窗醒由 topReached 演出段给（规格 §3.3 拍 9）
      }
    } else {
      const rope = w.cfg.rope;
      w.cfg.rope = null;
      moveSide(w, dt);
      w.cfg.rope = rope;
      stepWalkTo(w, dt);                                   // 点哪走哪（规格 §10；调在 moveSide 之后）
      if (player.y <= geo.topY + 2) {                     // 塔顶平台：不许走出边缘掉下去
        player.x = Math.max(geo.wallX + 20, Math.min(geo.wallX + geo.wallW - 20, player.x));
      }
      // 走位到位（≤30px）→ 触发 pending：与按 E 同一条路径（规格 §10）
      if (w.pending && (!w.walkTo || Math.abs(player.x - w.walkTo.x) <= 30)) {
        const t = w.pending; w.pending = null; w.walkTo = null;
        w.doE(t);
      }
      if (player.moving && (w.keys.has('l') || w.keys.has('r'))) player.walkT += dt;
    }
    // mend-rope：绳身自上而下重编 0.9s，生长前沿纤维 puff（规格 §3.3 拍 7）
    if (w.game.mended && v.ropeMendT > 0.3 && v.ropeMendT <= 1.2) {
      v.mendPuffT -= dt;
      if (v.mendPuffT <= 0) {
        v.mendPuffT = 0.12;
        const grow = Math.min(1, Math.max(0, (1.2 - v.ropeMendT) / 0.9));
        const anchorY = geo.topY - 10, endY = geo.groundY - 14;
        spawnFibres(v, ropeX, anchorY + (endY - anchorY) * grow, 1);
      }
    }
    stepFibres(v, dt);
    // window：光柱下泄 1.4s + hold 1.8s → 自动 EXIT（结算卡；规格 §3.3 拍 10）
    if (v.winOpen && !w.game.exited) {
      v.winT += dt;
      for (const m of v.motes) { m.x += m.vx * dt; m.y += m.vy * dt; m.a = Math.max(0, m.a - dt / 1.4); }
      if (v.winT >= 1.8) w.run(gameEvent(w.game, 'EXIT'));
    }
    const cat = w.actors?.cat;                             // 窗台猫：window 拍先钻出窗（规格 §9）
    if (v.catGo && cat && !cat.gone) {
      cat.x += CATB.speed * dt;
      if (cat.x >= geo.exitX - 2) cat.gone = true;
    }
    // 保险：石头绝不落在墙里/墙后
    stepWorldStones(w, dt, () => geo.groundY,
      x => (x >= geo.wallX && x <= geo.wallX + geo.wallW) ? geo.wallX - 30 - Math.random() * 40 : null);
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
    if (player.climbing) return null;
    const ropeX = geo.wallX + 12;
    let best = null, bd = 1e9;
    const consider = (d, t, r) => { if (d < bd && d <= r) { bd = d; best = t; } };
    for (const s of stones) if (s.state === 'idle') {
      consider(Math.hypot(player.x - s.x, player.y - s.y), { kind: 'stone', ipa: s.ipa, x: s.x, y: s.y, stone: s }, 56);
    }
    consider(Math.abs(player.x - geo.benchX), { kind: 'obj', id: 'bench', x: geo.benchX, y: geo.groundY }, 80);
    for (const spot of (w.content.listening || [])) {           // 听声点：实体物件，走近按 E（auto 的自动响，不占 E）
      if (spot.auto) continue;
      consider(Math.abs(player.x - spot.x), { kind: 'obj', id: spot.id, x: spot.x, y: spot.y }, spot.r);
    }
    if (player.y >= geo.groundY - 20) {                         // 绳升为正式 E 目标（规格 §10）：未接=听/接，已接=攀爬
      consider(Math.abs(player.x - ropeX), { kind: 'obj', id: 'rope', x: ropeX, y: geo.groundY }, 65);
    }
    consider(Math.hypot(player.x - geo.exitX, player.y - geo.topY), { kind: 'obj', id: 'exit', x: geo.exitX, y: geo.topY }, 80);  // 须在顶台（y≈topY）才可交
    return best;
  },

  onPointerDown(w, e, cv) {                                        // 点哪走哪：命中表 → walkTo + pending（tick 到位 doE，规格 §10）
    const { player, geo } = w;
    if (player.climbing) return;                                   // 攀爬中不接点
    const p = screenToLogical(e.clientX, e.clientY, cv.getBoundingClientRect());
    if (!p.inside) return;
    const t = tapTargetAt(w, p);
    const onTop = player.y <= geo.topY + 2;                        // 顶台钳在平台内 [920,990]，地面钳在走廊内 [40,1240]
    const x0 = onTop ? geo.wallX + 20 : 40;
    const x1 = onTop ? geo.wallX + geo.wallW - 20 : SIDE.W - 40;
    const tx = t ? t.x : p.x;
    w.walkTo = { x: Math.max(x0, Math.min(x1, tx)) };              // 未命中 = 走到点击 x（钳制）
    w.pending = t && tx >= x0 && tx <= x1 ? t : null;              // 钳位改变了目标 x = 本层够不到：只走位不交互
  },

  onDropItem(w, word, cx, cy) {                                    // 拖词具到场景：rope 拖到绳带 = 接绳（规格 §10）
    const p = screenToLogical(cx, cy, w.cv.getBoundingClientRect());
    if (!p.inside) return;
    const ropeX = w.geo.wallX + 12;
    if (word === 'rope' && Math.abs(p.x - ropeX) <= 45 && p.y >= w.geo.topY + 10 && p.y <= w.geo.groundY - 20) {
      w.run(gameEvent(w.game, 'USE', { word, target: 'rope' }));   // 绳带 = |x−912|≤45 且 y∈[130,600]
    } else w.sfx.mutter();                                         // 拖错：目标纹丝不动 + 咕哝
  },

  onKey(w) { w.walkTo = null; w.pending = null; },                 // 方向键按下取消走位（规格 §10）

  onE: chapterOnE(gameEvent, (w, t) => {
    const { game } = w;
    if (w.content.listening?.some(s => s.id === t.id)) { w.run(gameEvent(game, 'LISTEN', t.id)); return; }
    if (t.id === 'rope') {                                     // 绳升为正式 E 目标（规格 §10）
      if (!game.mended) {
        if (game.hand?.kind === 'item' && game.hand.word === 'rope') {
          w.run(gameEvent(game, 'USE', { word: 'rope', target: 'rope' }));   // 持绳 E = 接绳
        } else {
          w.run(gameEvent(game, 'ROPE'));                      // 空手 E = 听断绳（掉石/低语）
        }
      } else if (w.player.y >= w.geo.groundY - 20) {
        w.player.climbing = true;                              // 已接 + 地面 E = 攀爬
        w.player.airborne = false;
        w.player.x = w.geo.wallX + 12;
        w.player.y = w.geo.groundY;
        w.view.climbT = 0; w.view.climbStrain = 0;             // 起爬：strain 节律清零
        w.walkTo = null; w.pending = null;
      } else w.sfx.mutter();
    }
    else if (t.id === 'exit') w.run([{ t: 'windowExit' }]);
    else w.sfx.mutter();
  }),

  syncHeld,

  runExtras: {
    drop: dropExtra(w => w.geo.wallX, { dropH: 170, spread: 30, up: -110 }),
    dropBack: dropBackExtra(),
    ropeFirst(w) {                                           // 断绳一拍：绳尾一摆 + 断口纤维散开（规格 §3.3 拍 5）
      w.view.swayKick = 1;
      spawnFibres(w.view, w.geo.wallX + 12, w.geo.topY - 10 + 198, 6);
    },
    effect(w, ins) {
      if (ins.name !== 'mendRope') return;
      if (ins.full) {
        w.cv.style.cursor = 'default'; w.sfx.itemIn(); w.view.ropeMendT = 1.2; w.ui.setHint('mended');
        setTimeout(() => {                                   // 重编 0.9s 完成：绷直一沉 + strain（规格 §3.3 拍 7 / §7.1）
          w.sfx.strain();
          w.view.tautT = 0.35;
          w.view.swayKick = 0;
        }, 900);
      }
      else w.sfx.glowTick();
    },
    topReached(w) {                                          // 登顶：chime + wind（更大了）；窗缝呼吸加快由 climbed 驱动（规格 §3.3 拍 9）
      w.sfx.chime();
      w.sfx.wind();
    },
    revealCard(w, ins) {                                     // 合成成功后 +0.9s：卡开 chime + 揭示卡（规格 §7.1/§7.3）
      setTimeout(() => { w.sfx.chime(); w.ui.reveal(ins.word); }, 900);
    },
    windowExit(w) {                                          // 推窗：creak → gust + 光柱 1.4s + 12 风尘扑入 + hold 1.8s（规格 §3.3 拍 10）
      const v = w.view;
      if (v.winOpen) return;
      v.winOpen = true; v.winT = 0;
      w.sfx.creak();
      setTimeout(() => w.sfx.gust(), 300);                   // 窗开 → 当面风 gust（规格 §7.1）
      v.motes = makeWindMotes(w.geo);                        // 12 风尘扑入
      const c = w.actors?.cat;
      if (c) { c.earT = 1; c.meowT = 0.6; v.catGo = true; }  // 猫先钻出窗（规格 §9）
      w.sfx.meow();
    },
    climbUp(w) {                                             // 调试：绳下起爬（位置依赖拍，规格 §3.5）
      w.player.climbing = true;
      w.player.airborne = false;
      w.player.x = w.geo.wallX + 12;
      w.player.y = w.geo.groundY;
      w.view.climbT = 0; w.view.climbStrain = 0;
      w.walkTo = null; w.pending = null;
    },
    teleport(w, ins) {                                       // 通用调试传送原语（规格 §3.5）：位置依赖拍截图用
      w.player.x = ins.x;
      if (ins.y != null) w.player.y = ins.y;
      w.player.vy = 0; w.player.airborne = false; w.player.moving = false;
      w.walkTo = null; w.pending = null;
    }
  },

  summaryMerge(game) {
    return { everPicked: [...game.inv.everPicked], heard: [...game.heard], words: [...game.book], abilities: ['climb'], chapter: 2,
             picks: game.stonesPicked };                  // 本章声音石拾取数 → 书档累加（规格 §12）
  },

  onFinal(w) {
    w.ui.setHint('end');
    const walk = document.getElementById('btn-walk');
    walk.textContent = '下一间房 →';
    walk.onclick = () => { location.href = '/chapter3.html'; };
  },

  draw(w, x, eTarget) {
    const { view: v, geo, game, lights: L } = w;
    const ropeX = geo.wallX + 12;
    x.clearRect(0, 0, SIDE.W, SIDE.H);
    if (!w.bg) w.bg = makeBg(w);                                            // 夜空/高墙/地面一次性预渲染
    x.drawImage(w.bg, 0, 0);
    drawRope(x, w, ropeX);
    drawFibres(x, v);                                                       // 断口/重编纤维粒子
    drawTorchSide(x, L.torch.x, L.torch.y, v.t, { r: L.torch.r, a: L.torch.s });   // 左火把（= warm 听声点实体）：动态光晕读 LIGHTS2（规格 §6.2-②）
    drawTorchSide(x, L.rope.x, L.rope.y, v.t, { r: L.rope.r, a: L.rope.s });       // 绳位火把：同上（照亮绳根与绞盘，§5.2#6）
    drawBenchSide(x, w.atlases, geo.benchX, geo.groundY, game.hand?.kind === 'stone', v.craftSlots, { candle: true, t: v.t });
    drawWindow(x, geo.exitX, geo.topY, v.winOpen, game.climbed, v.t);
    if (w.actors?.cat && !w.actors.cat.gone) drawCat(x, w.actors.cat, v.t); // 窗台橘猫：坐 (935,120) 先到一步（规格 §9）
    x.save();
    if (w.player.climbing) { x.translate(w.player.x, w.player.y); x.rotate(0.12); x.translate(-w.player.x, -w.player.y); }
    drawPlayer(x, w.player, v.t, w.atlases);
    x.restore();
    if (w.player.climbing) drawClimbArms(x, w.player);
    for (const s of w.stones) drawSideStone(x, s, v.t);
    for (const pf of v.puffs) {
      x.globalAlpha = pf.a * 0.5; x.fillStyle = '#cfc9ba';
      x.beginPath(); x.arc(pf.x, pf.y - 6, pf.r, 0, 7); x.fill();
    }
    x.globalAlpha = 1;
    // 黄昏级色：角色之后统一压暗（与第一关同法，全场同吃一级大气）
    x.fillStyle = 'rgba(16,18,36,.30)';
    x.fillRect(0, 0, SIDE.W, SIDE.H);
    // 夜色面纱：画在级色之后、青声之前（规格 §6.2-③；四孔已按 LIGHTS2 veil 锚挖好，一次性预渲染）
    if (w.veil) x.drawImage(w.veil, 0, 0);
    drawWindowBeat(w, x);                                  // 推窗：光柱 1.4s + 台面光池 + 12 风尘（画在级色/面纱之上读作光）
    drawListenSpots(x, w);
    drawEHint(x, eTarget, v.t);
    vignette(x);
    // 过曝白：窗开 t=1.2s→1.8s 的 0.6s 白（规格 §6.3；盖在暗角之上，读作过曝）
    if (v.winOpen && v.winT >= 1.2 && v.winT < 1.8) {
      const k = Math.sin(((v.winT - 1.2) / 0.6) * Math.PI);
      x.fillStyle = `rgba(255,252,244,${Math.min(0.9, k * 0.95)})`;
      x.fillRect(0, 0, SIDE.W, SIDE.H);
    }
  }
};

// ================= 2b 陈设（静态件，全部烘进 makeBg；火把火焰/绳/窗/呼吸符文在 draw() 动态层） =================

// 石刻带（规格 §5.2#5）：x300–664 y≈310 八枚暗青阴刻（含 ᚱ 本章音 / ᚩ 窗 / ᛈ rope 的 p）；导出供测试锁坐标
export const RUNE_BAND = { x0: 300, step: 52, y: 310, runes: ['ᚱ', 'ᛚ', 'ᚩ', 'ᚦ', 'ᛈ', 'ᛞ', 'ᚹ', 'ᚷ'] };
// 入口拱洞内暖光溢出范围（出生区照明，规格 §5.2#1）
export const ARCH_SPILL = { x0: 60, x1: 220 };

// 墙挂件落影（软阴影）：火把/残碑等贴墙件
function wallShadow(x, cx, cy, r) {
  const g = x.createRadialGradient(cx + 4, cy + 8, 2, cx + 4, cy + 8, r);
  g.addColorStop(0, 'rgba(0,0,0,.32)');
  g.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = g;
  x.beginPath(); x.arc(cx + 4, cy + 8, r, 0, 7); x.fill();
}

// 入口拱洞内暖光溢出 60→220（规格 §5.2#1）：洞口暖核 + 沿墙暖洗 + 地面光池
function drawArchSpill(x, geo) {
  const { x0, x1 } = ARCH_SPILL, gy = geo.groundY;
  const mouth = x.createRadialGradient(x0, gy - 96, 8, x0, gy - 96, 170);
  mouth.addColorStop(0, 'rgba(255,206,130,.22)');
  mouth.addColorStop(0.55, 'rgba(255,198,112,.10)');
  mouth.addColorStop(1, 'rgba(255,198,112,0)');
  x.fillStyle = mouth;
  x.beginPath(); x.arc(x0, gy - 96, 170, 0, 7); x.fill();
  const wash = x.createLinearGradient(x0, 0, x1, 0);
  wash.addColorStop(0, 'rgba(255,198,112,.14)');
  wash.addColorStop(1, 'rgba(255,198,112,0)');
  x.fillStyle = wash;
  x.fillRect(x0, gy - 214, x1 - x0, 214);
  const pool = x.createRadialGradient(x0 + 20, gy + 2, 6, x0 + 20, gy + 2, 150);
  pool.addColorStop(0, 'rgba(255,198,112,.16)');
  pool.addColorStop(1, 'rgba(255,198,112,0)');
  x.fillStyle = pool;
  x.beginPath(); x.ellipse(x0 + 40, gy + 4, 130, 26, 0, 0, 7); x.fill();
}

// 火把铁托架（与 ch1/ch2 同款金属件，垫在火把柄下）
function drawTorchBracket(x, tx, ty) {
  x.fillStyle = '#4b4f5a';
  x.beginPath(); x.moveTo(tx - 10, ty); x.lineTo(tx + 10, ty); x.lineTo(tx + 5, ty + 10); x.lineTo(tx - 5, ty + 10); x.closePath(); x.fill();
  x.strokeStyle = PAL.ink; x.lineWidth = 1.5; x.stroke();
}

// 墙面石刻带：凹槽 + 八枚 26px 暗青阴刻（ch1 墙上刻痕同族）
function drawRuneBand(x) {
  const { x0, step, y, runes } = RUNE_BAND;
  const w = (runes.length - 1) * step;
  x.fillStyle = 'rgba(20,22,30,.32)';                                  // 刻带凹槽
  x.fillRect(x0 - 34, y - 26, w + 68, 52);
  x.strokeStyle = 'rgba(10,12,18,.55)'; x.lineWidth = 2;
  x.strokeRect(x0 - 34, y - 26, w + 68, 52);
  x.fillStyle = 'rgba(255,240,214,.06)';                               // 凹槽上缘受光
  x.fillRect(x0 - 34, y - 26, w + 68, 2);
  runes.forEach((g, i) => drawRune(x, g, x0 + i * step, y, 26, 'rgba(40,66,60,.5)', 3));   // 暗青阴刻，不发光
}

// 嵌壁残碑（stone 听声点实体，碑心 780,300）+ 石托：残口石牌 + 四枚阴刻（ᛌ ᛏ ᚩ ᚾ = s t əʊ n）
function drawRuinTablet(x, cx, cy) {
  wallShadow(x, cx, cy, 56);
  x.save();
  x.fillStyle = '#5d5a52';                                             // 石托（承碑的墙上石台）
  x.beginPath();
  x.moveTo(cx - 34, cy + 28); x.lineTo(cx + 34, cy + 28);
  x.lineTo(cx + 26, cy + 46); x.lineTo(cx - 26, cy + 46);
  x.closePath(); x.fill();
  x.strokeStyle = PAL.ink; x.lineWidth = 2.5; x.stroke();
  x.fillStyle = 'rgba(255,240,214,.10)'; x.fillRect(cx - 34, cy + 28, 68, 2);   // 托面受光
  const r = rng(97);
  x.fillStyle = shade('#7b7669', -0.02);                               // 碑身（顶缘残口参差）
  x.beginPath();
  x.moveTo(cx - 24, cy + 28);
  x.lineTo(cx - 24, cy - 24);
  for (let i = 0; i <= 5; i++) x.lineTo(cx - 24 + i * 9.6, cy - 26 - r() * 10);
  x.lineTo(cx + 24, cy - 24);
  x.lineTo(cx + 24, cy + 28);
  x.closePath(); x.fill();
  x.strokeStyle = PAL.ink; x.lineWidth = 2.5; x.stroke();
  x.fillStyle = shade('#7b7669', 0.10);                                // 上/左受光
  x.fillRect(cx - 24, cy - 24, 2, 52); x.fillRect(cx - 24, cy + 26, 48, 2);
  for (const [g, gx, gy2] of [['ᛌ', cx - 11, cy - 8], ['ᛏ', cx + 11, cy - 8], ['ᚩ', cx - 11, cy + 12], ['ᚾ', cx + 11, cy + 12]]) {
    drawRune(x, g, gx, gy2, 14, 'rgba(40,66,60,.6)', 2);               // 阴刻 s t əʊ n（残碑上的名字）
  }
  x.restore();
}

// 绞盘与绳尾（签名地标，鼓心 908,620）：底架 + 鼓 + 双铁箍 + 摇柄 + 绕鼓绳尾（修好后正落鼓上）
function drawWinch(x, cx, gy) {
  groundShadow(x, cx, gy, 34, 8, 0.30);
  x.save();
  x.strokeStyle = PAL.wood2; x.lineWidth = 7; x.lineCap = 'round';     // 底架斜腿
  x.beginPath(); x.moveTo(cx - 26, gy - 2); x.lineTo(cx - 16, gy - 26); x.stroke();
  x.beginPath(); x.moveTo(cx + 26, gy - 2); x.lineTo(cx + 16, gy - 26); x.stroke();
  x.fillStyle = shade(PAL.wood2, 0.10);                                // 鼓（横卧圆木）
  x.beginPath();
  if (x.roundRect) x.roundRect(cx - 30, gy - 34, 60, 26, 9); else x.rect(cx - 30, gy - 34, 60, 26);
  x.fill();
  x.strokeStyle = PAL.ink; x.lineWidth = 3; x.stroke();
  x.fillStyle = shade(PAL.wood3, 0);                                   // 鼓面端头
  x.beginPath(); x.ellipse(cx - 30, gy - 21, 6, 13, 0, 0, 7); x.fill();
  x.strokeStyle = PAL.ink; x.lineWidth = 2.5; x.stroke();
  x.strokeStyle = '#4b4f5a'; x.lineWidth = 4;                          // 双铁箍
  x.beginPath(); x.moveTo(cx - 14, gy - 34); x.lineTo(cx - 14, gy - 8); x.stroke();
  x.beginPath(); x.moveTo(cx + 14, gy - 34); x.lineTo(cx + 14, gy - 8); x.stroke();
  x.strokeStyle = '#4b4f5a'; x.lineWidth = 5; x.lineCap = 'round';     // 摇柄（右端拐出）
  x.beginPath(); x.moveTo(cx + 30, gy - 21); x.lineTo(cx + 44, gy - 21); x.lineTo(cx + 44, gy - 36); x.stroke();
  x.fillStyle = PAL.wood3;
  x.beginPath(); x.arc(cx + 44, gy - 40, 4.5, 0, 7); x.fill();
  x.strokeStyle = PAL.ink; x.lineWidth = 2; x.stroke();
  x.strokeStyle = '#b98d55'; x.lineWidth = 4;                          // 绕鼓绳尾（§11 绳芯色）
  for (let i = 0; i < 3; i++) {
    x.beginPath(); x.ellipse(cx, gy - 21, 24 - i * 7, 11 - i * 3, 0, 0, 7); x.stroke();
  }
  x.strokeStyle = '#6e4526'; x.lineWidth = 4; x.lineCap = 'round';     // 散绳尾拖地
  x.beginPath(); x.moveTo(cx + 12, gy - 12); x.lineTo(cx + 18, gy - 2); x.stroke();
  x.beginPath(); x.moveTo(cx + 18, gy - 2); x.lineTo(cx + 26, gy - 1); x.stroke();
  x.restore();
}

// 货堆（底 300/368）：大木箱 + 叠小箱 + 陶罐组（mi 图集 1:1 整倍，同 2a#4）
function drawCrates(x, imgs, gy) {
  groundShadow(x, 300, gy, 30, 7, 0.28);
  groundShadow(x, 368, gy, 32, 7, 0.28);
  blit(x, imgs, 'crate_big', 274, gy - 46);
  blit(x, imgs, 'crate_sm', 284, gy - 46 - 45);                        // 小箱叠在大箱上
  blit(x, imgs, 'jars2', 338, gy - 34);
}

// 塔身壁柱 900–1010 y122–620：平面浮雕——只画不挡走（物理层 wall.blockGround=false，见 makeWorld）
function drawPilasters(x, geo) {
  const { wallX, wallW, topY, groundY } = geo;
  x.save();
  for (const px of [wallX + 10, wallX + wallW - 10]) {                 // 两根边柱（910 / 1000）
    x.fillStyle = 'rgba(255,240,214,.10)';                             // 柱身受光
    x.fillRect(px - 7, topY + 8, 14, groundY - topY - 8);
    x.fillStyle = 'rgba(0,0,0,.26)';                                   // 右侧沉影
    x.fillRect(px + 4, topY + 8, 3, groundY - topY - 8);
    x.fillStyle = shade('#7b7669', 0.06);                              // 柱头
    x.fillRect(px - 11, topY + 2, 22, 12);
    x.strokeStyle = PAL.ink; x.lineWidth = 1.6; x.strokeRect(px - 11, topY + 2, 22, 12);
    x.fillStyle = shade('#7b7669', -0.10);                             // 柱脚
    x.fillRect(px - 11, groundY - 28, 22, 28);
    x.strokeRect(px - 11, groundY - 28, 22, 28);
  }
  x.fillStyle = 'rgba(0,0,0,.30)';                                     // 柱脚暗带（接触影）
  x.fillRect(wallX, groundY - 6, wallW, 6);
  x.restore();
}

// 窗光柱：高窗 (980,120) 的静态冷锥，沿塔面下泄（规格 §5.2#9）
function drawWindowShaft(x, geo) {
  const wx = geo.exitX, wy = geo.topY + 6;
  const g = x.createLinearGradient(0, wy, 0, wy + 330);
  g.addColorStop(0, 'rgba(190,212,255,.15)');
  g.addColorStop(1, 'rgba(190,212,255,0)');
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(wx - 22, wy); x.lineTo(wx + 22, wy);
  x.lineTo(wx + 80, wy + 330); x.lineTo(wx - 80, wy + 330);
  x.closePath(); x.fill();
}

function makeBg(w) {
  const { geo } = w;
  const gy = geo.groundY;
  const c = document.createElement('canvas');
  c.width = SIDE.W; c.height = SIDE.H;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  // 全墙：程序生成像素砌石（seed 23），与第一关同源；替退役的照片苔墙
  paintMasonry(x, masonryPlan(23, SIDE.W, geo.groundY), SIDE.W, geo.groundY);
  // 窗沿（塔顶平台沿）
  drawFloorSide(x, w.atlases, geo.wallX, geo.topY - 14, geo.wallW, 16);
  x.fillStyle = 'rgba(255,236,200,.10)';
  x.fillRect(geo.wallX, geo.topY - 14, geo.wallW, 2);
  // 地：大块凿石板（seed 31）
  const floorH = SIDE.H - geo.groundY;
  paintSlabs(x, slabPlan(31, SIDE.W, geo.groundY, floorH), SIDE.W, geo.groundY, floorH);
  x.fillStyle = 'rgba(255,236,200,.09)'; x.fillRect(0, geo.groundY, SIDE.W, 2);
  const fsh = x.createLinearGradient(0, geo.groundY - 8, 0, geo.groundY + 36);
  fsh.addColorStop(0, 'rgba(0,0,0,.30)'); fsh.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = fsh; x.fillRect(0, geo.groundY - 8, SIDE.W, 44);
  const gsh = x.createLinearGradient(0, geo.groundY, 0, SIDE.H);
  gsh.addColorStop(0, 'rgba(0,0,0,0)'); gsh.addColorStop(1, 'rgba(0,0,0,.40)');
  x.fillStyle = gsh; x.fillRect(0, geo.groundY, SIDE.W, SIDE.H - geo.groundY);
  // —— 陈设（静态件，规格 §5.2）：入口拱 / 火把托架 / 石刻带 / 残碑 / 塔柱 / 货堆 / 绞盘 / 木架树 ——
  // （火把火焰、断绳、高窗、ᚩ 呼吸等会动/呼吸的件在 draw() 动态层）
  drawArchSide(x, 60, gy, { rune: 'ᚱ' });                      // 入口拱：ᚱ 阴刻、不发光（与 2a 出口同构 = 无缝交接暗号）
  groundShadow(x, 60, gy, 62, 9, 0.30);
  drawArchSpill(x, geo);                                       // 洞内暖光溢出 60→220（出生区照明）
  wallShadow(x, 240, 258, 34); drawTorchBracket(x, 240, 266);  // 左火把托架 + 墙影（火焰在 draw()，位置 = warm 听声点）
  wallShadow(x, 868, 448, 34); drawTorchBracket(x, 868, 456);  // 绳位火把托架 + 墙影（照亮绳根与绞盘）
  drawRuneBand(x);                                             // 墙面石刻带 x300–664 y≈310（8 枚暗青阴刻）
  drawRuinTablet(x, 780, 300);                                 // 嵌壁残碑 + 石托（stone 听声点实体）
  drawPilasters(x, geo);                                       // 塔身壁柱 900–1010 y122–620（平面浮雕，不阻走）
  drawWindowShaft(x, geo);                                     // 窗光柱：高窗 (980,120) 静态冷锥
  drawCrates(x, w.atlases, gy);                                // 货堆：木箱×2 + 陶罐组（底 300/368）
  drawWinch(x, 908, gy);                                       // 绞盘与绳尾（签名地标，鼓心 908,620；盖在壁柱前）
  groundShadow(x, 1070, gy, 32, 6, 0.26);
  blit(x, w.atlases, 'shelf', 1070, gy, { ax: 0.5, ay: 1 });   // 木架（底 1070）
  groundShadow(x, 1180, gy, 20, 5, 0.26);
  blit(x, w.atlases, 'tree', 1180, gy, { ax: 0.5, ay: 1 });    // 盆栽树（底 1180）
  // 上部墙转冷（规格 §6.3 climb「从暖池爬进冷光」）：y<300 叠靛蓝冷调、向下渐隐
  const cold = x.createLinearGradient(0, 0, 0, 300);
  cold.addColorStop(0, 'rgba(30,44,78,.30)');
  cold.addColorStop(0.65, 'rgba(30,44,78,.12)');
  cold.addColorStop(1, 'rgba(30,44,78,0)');
  x.fillStyle = cold; x.fillRect(0, 0, SIDE.W, 300);
  // 光池烘焙：唯一事实源 LIGHTS2（暖火族一色）——左火把/绳位火把/蜡烛/高窗同表同坐标，一次预渲染（规格 §6.2-①）
  for (const t of Object.values(w.lights)) pixelGlow(x, t.x, t.y, t.r, [255, 198, 112], t.s);
  // 夜色面纱：一次性预渲染（规格 §6.2-③）；draw() 画在级色之后、青声之前
  w.veil = makeVeil(w.lights);
  // 黄昏级色不再烘焙进背景：改到 draw() 角色之后统一压暗
  return c;
}

// 夜色面纱（规格 §6.2-③，仅 2b；2a 是黄昏亮场不启用）：全屏 rgba(8,10,20,.34) → destination-out
// 按 LIGHTS2 的 veil 锚挖四孔（径向内径 r*0.15，ch1 makeDarkness 同款 2px 拜耳抖动量化）；一次性预渲染
export function makeVeil(lights) {
  const c = document.createElement('canvas');
  c.width = SIDE.W; c.height = SIDE.H;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(8,10,20,.34)';
  x.fillRect(0, 0, SIDE.W, SIDE.H);
  x.globalCompositeOperation = 'destination-out';
  for (const L of Object.values(lights)) {
    if (!L.veil) continue;
    const h = x.createRadialGradient(L.x, L.y, L.veil.r * 0.15, L.x, L.y, L.veil.r);
    h.addColorStop(0, `rgba(0,0,0,${L.veil.s})`); h.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = h; x.beginPath(); x.arc(L.x, L.y, L.veil.r, 0, 7); x.fill();
  }
  x.globalCompositeOperation = 'source-over';
  // 像素抖动量化：平滑渐变 → 2px 拜耳有序抖动（与 ch1 makeDarkness / 砌石苔藓同一像素语言）
  const img = x.getImageData(0, 0, c.width, c.height);
  const B = [[0, 2], [3, 1]];
  for (let by = 0; by < c.height; by += 2) {
    for (let bx = 0; bx < c.width; bx += 2) {
      const i = (by * c.width + bx) * 4 + 3;
      const a = img.data[i] / 255;
      if (a <= 0 || a >= 1) continue;
      const q = Math.min(1, Math.floor(a * 6 + B[(by / 2) % 2][(bx / 2) % 2] / 4) / 6);
      img.data[i] = q * 255;
    }
  }
  x.putImageData(img, 0, 0);
  return c;
}

// —— 绳（规格 §11）：矢量 8px 双层编织（暗边 #6e4526 / 芯 #b98d55 / 高光 #d9b878）
//    + 每 6px 一道 2px 斜纹 + PAL.ink 描边；绳身自局部原点 (0,0) 垂直垂下 ——
function ropeBraid(x, len) {
  x.fillStyle = '#6e4526';                                   // 暗边层（背光侧）
  x.fillRect(-4, 0, 8, len);
  x.fillStyle = '#b98d55';                                   // 绳芯
  x.fillRect(-3, 0, 5, len);
  x.fillStyle = '#d9b878';                                   // 高光层（受光侧）
  x.fillRect(-3, 0, 2, len);
  for (let i = 0, y = 3; y < len - 2; i++, y += 6) {         // 斜纹：每 6px 一道 2px，明暗交替
    x.strokeStyle = i % 2 ? '#d9b878' : '#6e4526';
    x.lineWidth = 2;
    x.beginPath(); x.moveTo(-4, y); x.lineTo(4, Math.min(y + 4, len)); x.stroke();
  }
  x.strokeStyle = PAL.ink; x.lineWidth = 1.5;                // ink 描边（顶端没入锚点，不描顶）
  x.beginPath();
  x.moveTo(-4, 0); x.lineTo(-4, len);
  x.moveTo(4, 0); x.lineTo(4, len);
  x.stroke();
}

function drawRope(x, w, ropeX) {
  const geo = w.geo, v = w.view, game = w.game;
  const damp = 1 - Math.min(1, (v.tautT || 0) * 3) * 0.75;   // 绷直一沉：摆幅骤减后回稳（规格 §3.3 拍 7）
  const sway = (Math.sin(v.t * 1.6) * 6 + (v.swayKick || 0) * Math.sin(v.t * 7.5) * 12) * damp;   // rope-first 绳尾一摆
  const anchorY = geo.topY - 10;                             // 锚点（常量保持）
  if (!game.mended) {
    // 断绳：垂到半空，断端三股散开 + 一股打卷（矢量重写，规格 §11）
    const len = 198;                                         // 断绳长度（常量保持）
    x.save();
    x.translate(ropeX, anchorY);
    x.rotate(sway * 0.0022);                                 // 断绳摆幅（常量保持）
    const bodyLen = len - 14;
    ropeBraid(x, bodyLen);
    x.lineCap = 'round';
    const strands = [                                        // [色, 起点x, 控制x, 控制y, 末点x, 末点y]
      ['#d9b878', -1.5, -4, bodyLen + 7, -7.5, bodyLen + 13],
      ['#b98d55', 0.5, 1.5, bodyLen + 10, 0.5, bodyLen + 19],
      ['#6e4526', 2, 5, bodyLen + 6, 6.5, bodyLen + 11]
    ];
    for (const [c, sx, cx2, cy2, ex2, ey2] of strands) {     // 三股散开（先 ink 描边再上色）
      x.beginPath(); x.moveTo(sx, bodyLen); x.quadraticCurveTo(cx2, cy2, ex2, ey2);
      x.strokeStyle = PAL.ink; x.lineWidth = 3.2; x.stroke();
      x.strokeStyle = c; x.lineWidth = 2; x.stroke();
    }
    x.beginPath(); x.arc(7.5, bodyLen + 13.5, 3.2, -0.6, 3.6);  // 卷曲（右股末端打卷）
    x.strokeStyle = PAL.ink; x.lineWidth = 2.6; x.stroke();
    x.strokeStyle = '#b98d55'; x.lineWidth = 1.6; x.stroke();
    x.restore();
    // 绳端交互光：青 PAL.glowRune（修 #7bd88f 绿例外，规格 §11）；rope-first 断口青光一闪（规格 §3.3 拍 5）
    const endY = anchorY + len;
    const gp = Math.sin(v.t * 3) * 0.5 + 0.5;
    const flash = v.swayKick || 0;
    const g = x.createRadialGradient(ropeX, endY + 2, 4, ropeX, endY + 2, 44 + gp * 16 + flash * 20);
    g.addColorStop(0, `rgba(84,224,200,${0.3 + gp * 0.25 + flash * 0.4})`);
    g.addColorStop(1, 'rgba(84,224,200,0)');
    x.fillStyle = g; x.beginPath(); x.arc(ropeX, endY + 2, 60, 0, 7); x.fill();
  } else if (v.ropeMendT < 1.2) {
    // 好绳：矢量绳身随 ropeMendT 向下生长 + 末端绳结；生长前沿青微光（完成即熄）
    const endY = geo.groundY - 14;                           // 垂到地面上方 14px（常量保持）
    const grow = Math.min(1, Math.max(0, (1.2 - v.ropeMendT) / 0.9));
    const curLen = (endY - anchorY) * grow;
    if (curLen < 4) return;
    x.save();
    x.translate(ropeX, anchorY);
    x.rotate(sway * 0.0012);                                 // 好绳摆幅（常量保持）
    const knotH = Math.min(18, curLen * 0.5);
    ropeBraid(x, curLen - knotH);
    x.fillStyle = '#b98d55';                                 // 末端绳结
    x.beginPath(); x.ellipse(0, curLen - knotH / 2, 5.5, knotH / 2 + 0.5, 0, 0, 7); x.fill();
    x.strokeStyle = PAL.ink; x.lineWidth = 1.6; x.stroke();
    x.strokeStyle = '#6e4526'; x.lineWidth = 2;              // 双道缠绳
    x.beginPath(); x.moveTo(-5.2, curLen - knotH * 0.7); x.lineTo(5.2, curLen - knotH * 0.45); x.stroke();
    x.beginPath(); x.moveTo(-5.2, curLen - knotH * 0.35); x.lineTo(5.2, curLen - knotH * 0.6); x.stroke();
    x.strokeStyle = '#d9b878'; x.lineCap = 'round';          // 收头小尾
    x.beginPath(); x.moveTo(3.5, curLen - 2); x.lineTo(6.5, curLen + 2.5); x.stroke();
    if (grow < 1) {                                          // 生长前沿青微光
      const g = x.createRadialGradient(0, curLen, 1, 0, curLen, 15);
      g.addColorStop(0, 'rgba(84,224,200,.5)');
      g.addColorStop(1, 'rgba(84,224,200,0)');
      x.fillStyle = g; x.beginPath(); x.arc(0, curLen, 15, 0, 7); x.fill();
      x.fillStyle = 'rgba(160,245,225,.85)';
      x.beginPath(); x.arc(0, curLen, 1.6, 0, 7); x.fill();
    }
    x.restore();
  }
}

// —— 纤维粒子（rope-first 断口散开 / mend-rope 生长前沿 puff；规格 §3.3 拍 5/7）——
function spawnFibres(v, x, y, n) {
  for (let i = 0; i < n; i++) {
    v.fibres.push({
      x: x + (Math.random() - 0.5) * 8, y: y + (Math.random() - 0.5) * 6,
      vx: (Math.random() - 0.5) * 26, vy: 6 + Math.random() * 18,
      len: 3 + Math.random() * 5, ang: 0.6 + Math.random() * 1.4, a: 1
    });
  }
}
function stepFibres(v, dt) {
  for (const f of v.fibres) {
    f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 30 * dt;
    f.ang += Math.sin(v.t * 3 + f.x * 0.1) * dt * 0.8;
    f.a -= dt * 0.55;
  }
  v.fibres = v.fibres.filter(f => f.a > 0);
}
function drawFibres(x, v) {
  if (!v.fibres?.length) return;
  x.save();
  for (const f of v.fibres) {
    x.globalAlpha = Math.max(0, f.a) * 0.9;
    x.strokeStyle = f.a > 0.5 ? '#d9b878' : '#b98d55';       // §11 绳芯/高光同族
    x.lineWidth = 1.6;
    x.beginPath();
    x.moveTo(f.x, f.y);
    x.lineTo(f.x + Math.cos(f.ang) * f.len, f.y + Math.sin(f.ang) * f.len);
    x.stroke();
  }
  x.restore();
}

// —— 推窗演出（规格 §3.3 拍 10 / §6.3）：光柱下泄 1.4s + 台面光池 + 12 风尘扑入 ——
function makeWindMotes(geo) {
  const out = [];
  for (let i = 0; i < 12; i++) {
    out.push({
      x: geo.exitX + (Math.random() - 0.5) * 24, y: geo.topY - 6 + Math.random() * 12,
      vx: -26 - Math.random() * 46, vy: 46 + Math.random() * 54,
      r: 1.4 + Math.random() * 1.6, a: 1
    });
  }
  return out;
}
function drawWindowBeat(w, x) {
  const v = w.view, geo = w.geo;
  if (!v.winOpen) return;
  const wx = geo.exitX, wy = geo.topY - 6;
  if (v.winT < 1.4) {                                        // 光柱下泄 1.4s（渐收）
    const k = 1 - v.winT / 1.4;
    const g = x.createLinearGradient(0, wy, 0, wy + 360);
    g.addColorStop(0, `rgba(214,228,255,${0.34 * k})`);
    g.addColorStop(0.6, `rgba(214,228,255,${0.16 * k})`);
    g.addColorStop(1, 'rgba(214,228,255,0)');
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(wx - 24, wy); x.lineTo(wx + 24, wy);
    x.lineTo(wx + 92, wy + 360); x.lineTo(wx - 92, wy + 360);
    x.closePath(); x.fill();
  }
  const pool = x.createRadialGradient(wx, geo.topY + 6, 4, wx, geo.topY + 6, 130);   // 台面光池
  pool.addColorStop(0, 'rgba(255,214,140,.22)');
  pool.addColorStop(1, 'rgba(255,214,140,0)');
  x.fillStyle = pool;
  x.beginPath(); x.ellipse(wx, geo.topY + 6, 120, 22, 0, 0, 7); x.fill();
  for (const m of v.motes) {                                 // 12 风尘扑入
    if (m.a <= 0) continue;
    x.globalAlpha = m.a * 0.8;
    x.fillStyle = '#dfe8ff';
    x.fillRect(m.x, m.y, m.r, m.r);
  }
  x.globalAlpha = 1;
}

// 塔顶出口：矢量拱龛 + 双页木窗（规格 §11；退役照片贴图）
// 关 = 两页木窗合拢（顶部随拱收弧）；开 = 木页绕外缘旋出 70°（平行四边形投影），夜空 + 暖光点透出
function drawWindow(x, ex, ty, open, lit, t) {
  const hw = 22, top = ty - 84, base = ty - 4;
  const arch = () => {                                       // 洞口拱形（ch1 门拱同族）
    x.beginPath();
    x.moveTo(ex - hw, base);
    x.lineTo(ex - hw, top + 26);
    x.quadraticCurveTo(ex, top - 6, ex + hw, top + 26);
    x.lineTo(ex + hw, base);
    x.closePath();
  };
  if (!open) {                                               // 窗缝微光慢呼吸；登顶后加快（规格 §3.3 拍 1/9）
    const sp = lit ? 3.2 : 1.1;
    const gp = Math.sin(t * sp) * 0.5 + 0.5;
    const g = x.createRadialGradient(ex, ty - 40, 6, ex, ty - 40, 48 + gp * 12);
    const a0 = lit ? 0.16 + gp * 0.16 : 0.05 + gp * 0.06;
    g.addColorStop(0, `rgba(255,214,130,${a0})`); g.addColorStop(1, 'rgba(255,214,130,0)');
    x.fillStyle = g; x.beginPath(); x.arc(ex, ty - 40, 60, 0, 7); x.fill();
  }
  x.save();
  x.fillStyle = shade('#7b7669', 0.03);                      // 拱龛石框
  x.beginPath();
  x.moveTo(ex - hw - 10, base + 6);
  x.lineTo(ex - hw - 10, top + 20);
  x.quadraticCurveTo(ex, top - 18, ex + hw + 10, top + 20);
  x.lineTo(ex + hw + 10, base + 6);
  x.closePath(); x.fill();
  x.strokeStyle = PAL.ink; x.lineWidth = 3; x.stroke();
  x.fillStyle = 'rgba(255,240,214,.08)';                     // 龛框左缘受光
  x.fillRect(ex - hw - 10, top + 20, 3, base - top - 14);
  x.fillStyle = 'rgba(0,0,0,.30)';                           // 龛内沉影
  arch(); x.fill();
  x.save(); arch(); x.clip();
  const sky = x.createLinearGradient(0, top, 0, base);       // 夜空（洞口外的天色）
  sky.addColorStop(0, '#0a0f1e'); sky.addColorStop(1, '#1e2743');
  x.fillStyle = sky; x.fillRect(ex - hw, top - 8, hw * 2, base - top + 12);
  const r = rng(88);                                         // 远处暖光点（确定布局）
  for (let i = 0; i < 7; i++) {
    const dx = ex - hw + 7 + r() * (hw * 2 - 14), dy = top + 12 + r() * (base - top - 20);
    x.fillStyle = 'rgba(255,214,130,.14)'; x.beginPath(); x.arc(dx, dy, 3.4, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,226,168,.9)'; x.beginPath(); x.arc(dx, dy, 1.2, 0, 7); x.fill();
  }
  if (!open) {
    for (const s of [-1, 1]) {                               // 关：两页合拢，板缝 + 拉手
      const px = s < 0 ? ex - hw : ex;
      x.fillStyle = shade(PAL.wood3, s < 0 ? 0.06 : -0.05);
      x.fillRect(px, top - 8, hw, base - top + 10);
      x.strokeStyle = 'rgba(32,26,20,.5)'; x.lineWidth = 1.3;
      for (let i = 1; i < 3; i++) {
        x.beginPath(); x.moveTo(px + (hw * i) / 3, top - 6); x.lineTo(px + (hw * i) / 3, base + 2); x.stroke();
      }
      x.strokeStyle = PAL.ink; x.lineWidth = 2;
      x.strokeRect(px, top - 8, hw, base - top + 10);
      x.fillStyle = '#4b4f5a';
      x.beginPath(); x.arc(px + (s < 0 ? hw - 4 : 4), base - 26, 2.2, 0, 7); x.fill();
      x.strokeStyle = PAL.ink; x.lineWidth = 1.2; x.stroke();
    }
    x.strokeStyle = PAL.ink; x.lineWidth = 1.6;              // 中缝
    x.beginPath(); x.moveTo(ex, top - 6); x.lineTo(ex, base + 2); x.stroke();
  } else {
    const pw = hw * 0.34;                                    // 旋出 70°：cos70°≈0.34 的投影宽
    for (const s of [-1, 1]) {
      const hx = s < 0 ? ex - hw : ex + hw;                  // 铰链在外缘
      x.beginPath();                                         // 平行四边形木页
      x.moveTo(hx, top + 22);
      x.lineTo(hx - s * pw, top + 28);
      x.lineTo(hx - s * pw, base + 7);
      x.lineTo(hx, base);
      x.closePath();
      x.fillStyle = shade(PAL.wood3, s < 0 ? 0.06 : -0.05);
      x.fill();
      x.strokeStyle = PAL.ink; x.lineWidth = 2; x.stroke();
      x.strokeStyle = 'rgba(32,26,20,.5)'; x.lineWidth = 1.3;  // 板缝
      x.beginPath(); x.moveTo(hx - s * pw * 0.5, top + 25); x.lineTo(hx - s * pw * 0.5, base + 3.5); x.stroke();
      x.fillStyle = '#4b4f5a';                               // 拉手
      x.beginPath(); x.arc(hx - s * (pw - 2.5), base - 24, 2, 0, 7); x.fill();
      x.strokeStyle = PAL.ink; x.lineWidth = 1.1; x.stroke();
    }
  }
  x.restore();
  arch(); x.strokeStyle = PAL.ink; x.lineWidth = 2.5; x.stroke();   // 洞口描边
  x.restore();
  x.fillStyle = shade('#7b7669', 0.06);                      // 窗台石沿（压在洞口下缘）
  x.fillRect(ex - hw - 14, base, hw * 2 + 28, 8);
  x.strokeStyle = PAL.ink; x.lineWidth = 2; x.strokeRect(ex - hw - 14, base, hw * 2 + 28, 8);
  x.fillStyle = 'rgba(255,240,214,.12)';
  x.fillRect(ex - hw - 14, base, hw * 2 + 28, 2);
}

function drawClimbArms(x, p) {
  const ph = Math.sin(p.walkT * 8) * 6;
  x.strokeStyle = PAL.ink; x.lineWidth = 4; x.lineCap = 'round';
  x.beginPath(); x.moveTo(p.x + 6, p.y - 40); x.lineTo(p.x + 16, p.y - 52 - ph); x.stroke();
  x.beginPath(); x.moveTo(p.x + 6, p.y - 36); x.lineTo(p.x + 16, p.y - 44 + ph); x.stroke();
}

mount(kit);
