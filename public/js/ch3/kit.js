// —— 析声者 · 第三关浏览器 kit（侧视河程）：自 ch3.js kit 段原样迁入 ——
import { createGame, startGame, gameEvent, ch3Debug, interact } from './event.js';
import { drawScene, createScene, initScene, drawBankObjects, drawCreviceObjects, drawDeepObjects, drawBubble, currentGround,
         RAFT_DECK } from './render.js';
import { chapterOnE, syncHeld, dropBackExtra, stepWorldStones } from '../chapter.js';
import { mount } from '../shell.js';
import {
  SIDE, moveSide, sideJump, spawnSideStone, drawSideStone,
  drawEHint, vignette
} from '../sideview.js';
import { drawBulb } from '../art.js';
import { createActors, updateActors, drawPlayer } from '../actors.js';
import { screenToLogical } from '../ch1/physics.js';

// ================= 浏览器 Kit =================

// —— E 目标表：每房间的可视锚点 + 命中半径；when 过滤随进度出现的目标 ——
// E、画布点击共用这张表做命中；命中后的规则只写一份（event.js 的 interact）。
// 审计原则：没有视觉锚点的目标不上表（裂隙出生点的隐形回程门、深水停泊筏均已移除）。
const TARGETS = {
  bank: [
    { id: 'bench', x: w => w.geo.bank.benchX, y: w => w.geo.bank.groundY, r: 82 },
    // r 收到 90：与 water（760±92 = 668..852）拉开，否则站在水边偏左按 E 会误开裂缝
    { id: 'creviceDoor', x: w => w.geo.bank.doorX, y: w => w.geo.bank.groundY, r: 90 },
    { id: 'water', x: w => w.geo.bank.waterX, y: w => w.geo.bank.groundY, r: 92 },
    { id: 'raft', x: w => w.raft.x, y: w => w.raft.y, r: 130, when: g => g.raftAssembled }
  ],
  crevice: [
    { id: 'bench', x: w => w.geo.crevice.benchX, y: w => w.geo.crevice.groundY, r: 110 },
    { id: 'creviceLog', x: w => w.geo.crevice.logX, y: w => w.geo.crevice.groundY, r: 100 },
    { id: 'bankDoor', x: w => w.geo.crevice.spawnX, y: w => w.geo.crevice.groundY, r: 110 }
  ]
  // 暗河不设 E 目标：授音随 STALL 自动播放，pole 用背包剩余音素拼出，壁龛/岩画为场景陈设
};

function nearestObjTarget(w, x) {
  let best = null;
  let bd = Infinity;
  for (const t of TARGETS[w.currentRoom] ?? []) {
    if (t.when && !t.when(w.game)) continue;
    const d = Math.abs(x - t.x(w));
    if (d <= t.r && d < bd) { bd = d; best = t; }
  }
  return best;
}

function pickTarget(w) {
  const { game, player } = w;
  if (w.transition) return null;
  let best = null;
  let bd = Infinity;
  const consider = (d, t) => { if (d <= t.r && d < bd) { bd = d; best = t; } };
  for (const stone of w.stones) if (stone.state === 'idle') {
    consider(Math.hypot(player.x - stone.x, player.y - stone.y),
      { kind: 'stone', ipa: stone.ipa, stone, x: stone.x, y: stone.y, r: 58 });
  }
  for (const t of TARGETS[w.currentRoom] ?? []) {
    if (t.when && !t.when(w.game)) continue;
    consider(Math.abs(player.x - t.x(w)), { kind: 'obj', id: t.id, x: t.x(w), y: t.y(w), r: t.r });
  }
  // 自身目标只在手持词具时出现（对自己使用 raft/pole），空手按 E 不再凭空给一个目标
  if (!best && game.hand?.kind === 'item') best = { kind: 'obj', id: 'self', x: player.x, y: player.y, r: 0 };
  return best;
}

export const kit = {
  chapter: 3,
  W: SIDE.W,
  H: SIDE.H,
  titleRune: 'ᚩ',
  createGame,
  startGame,
  gameEvent,
  debug: ch3Debug,
  voices: v => ({
    child: { voice: v.child, pitch: 1.25, rate: 1, rateSlow: 0.8 },
    door: { voice: v.door, pitch: 0.7, rate: 0.8, rateSlow: 0.6 }
  }),

  makeWorld({ content, game, cv, atlases }) {
    const actors = createActors();
    const geo = content.geometry;
    const sc = createScene();
    initScene(sc, atlases, geo);              // boot 时烘焙岸边静态层（Node 环境自动跳过）
    const player = actors.player;
    player.x = geo.bank.spawnX;
    player.y = geo.bank.groundY;
    player.dir = 'right';
    player.airborne = false;
    const w = {
      actors, player, geo, cv, sc, currentRoom: 'bank',
      stones: [],
      raft: { x: geo.bank.raftX, y: geo.bank.groundY - 6, bob: 0 },
      transition: null,
      view: { t: 0, fadeAlpha: 0, bubbleT: 0, shrugT: 0, bulbT: 0, poleT: 0, puffs: [] },
      cfg: {
        speed: 300,
        onLand: x => {                      // 岸边落水：溅水花，冲回滩涂
          if (w.currentRoom === 'bank' && x > w.geo.bank.waterX - 6) {
            w.view.puffs.push({ x, y: w.geo.bank.groundY - 10, r: 10, a: 1 });
            w.sfx.water();
            w.player.x = w.geo.bank.waterX - 40;
          }
        }
      }
    };
    return w;
  },

  onBegin(w) {
    w.hb.refresh(w.game.inv);
    w.ui.setHint('start');
  },

  // 跳跃：步行态（岸边/裂隙/深水停滞落地后）可跳；筏上航行与过场淡入淡出不跳
  onSpace(w) {
    if (w.transition) return;
    const g = w.game;
    if (g.embarked && w.currentRoom === 'deep' && (!g.stalled || g.poled)) return;
    sideJump(w);
    w.sfx.click();
  },

  tick(w, dt) {
    const { game, player, view } = w;
    view.t += dt;
    view.bubbleT = Math.max(0, view.bubbleT - dt);
    view.shrugT = Math.max(0, view.shrugT - dt);
    view.bulbT = Math.max(0, view.bulbT - dt);
    view.poleT = Math.max(0, view.poleT - dt);
    updateActors(w.actors, dt);

    // 停泊的木筏 = 可跳平台（岸边组装后 / 深水停滞时）；航行中不设
    const raftParked = game.raftAssembled &&
      (w.currentRoom === 'bank' || (w.currentRoom === 'deep' && game.stalled && !game.poled));
    w.cfg.wall = raftParked
      ? { X: w.raft.x - 90, W: 180, topY: w.raft.y - RAFT_DECK, blockGround: false, jumpable: true }
      : null;

    if (w.transition) {
      const tr = w.transition;
      tr.alpha += dt * 2.4 * tr.dir;
      w.view.fadeAlpha = Math.max(0, Math.min(1, tr.alpha));
      if (tr.dir > 0 && tr.alpha >= 1) {
        w.currentRoom = tr.room;
        placeRoom(w, tr.room);
        tr.dir = -1;
      } else if (tr.dir < 0 && tr.alpha <= 0) {
        w.transition = null;
        w.view.fadeAlpha = 0;
      }
    } else if (w.currentRoom === 'bank' || w.currentRoom === 'crevice' || (w.currentRoom === 'deep' && game.stalled && !game.poled)) {
      // 停滞落地交给 moveSide 的着地逻辑（非空中即贴地），不再每帧强制压回，跳跃才不会被吞掉
      moveSide(w, dt);
      if (player.moving && (w.keys.has('l') || w.keys.has('r'))) player.walkT += dt;
    }

    // 岸边水界：地面行走止步于水线（跳进水里由 cfg.onLand 冲回滩涂；筏面站台不受限）
    if (w.currentRoom === 'bank' && !player.airborne &&
        player.y >= w.geo.bank.groundY - 2 && player.x > w.geo.bank.waterX - 6) {
      player.x = w.geo.bank.waterX - 6;
    }

    // 暗河不允许水上行走：停滞期落到水里（或站到水面）即溅水花冲回木筏
    if (w.currentRoom === 'deep' && game.stalled && !w.transition && !player.airborne &&
        player.y >= w.geo.deep.groundY - 2) {
      w.view.puffs.push({ x: player.x, y: w.geo.deep.groundY - 10, r: 10, a: 1 });
      w.sfx.water();
      player.x = w.raft.x;
      player.y = w.raft.y - RAFT_DECK;
    }

    if (game.embarked && w.currentRoom === 'deep') {
      w.raft.bob += dt;
      if (!game.stalled) {
        w.raft.x += 110 * dt;
        if (w.raft.x >= w.geo.deep.stallX) w.run(gameEvent(game, 'STALL'));
      } else if (game.poled && !game.summary) {
        w.raft.x += 360 * dt;
        if (w.raft.x > SIDE.W + 80) w.run(gameEvent(game, 'EXIT'));
      }
      if (!game.stalled || game.poled) {
        player.x = w.raft.x;
        player.y = w.raft.y - RAFT_DECK;
        player.moving = false;                    // 随筏漂行是站立，不播走路动画（筏面上自己走动时才走）
        player.dir = 'right';
      }
    }

    // 岸边音素石不入水：越过水线的石头推回滩涂
    stepWorldStones(w, dt, currentGround, w.currentRoom === 'bank'
      ? x => (x > w.geo.bank.waterX - 6 ? w.geo.bank.waterX - 30 - Math.random() * 60 : null)
      : null);
    view.puffs = view.puffs.filter(p => { p.r += dt * 40; p.a -= dt * 2; return p.a > 0; });
  },

  findE(w) {
    return pickTarget(w);
  },

  // 石头/合成台公共段走 chapterOnE；其余目标的规则只写一份（event.js 的 interact）
  onE: chapterOnE(gameEvent, (w, target) => {
    w.run(interact(w.game, target.id));
  }),

  onPointerDown(w, e, cv) {
    const p = screenToLogical(e.clientX, e.clientY, cv.getBoundingClientRect());
    if (!p.inside || w.transition) return;
    const t = nearestObjTarget(w, p.x);            // 点击命中同一张目标表，规则走 interact
    if (t) w.run(interact(w.game, t.id));
  },

  onDropItem(w, word, cx, cy) {
    const p = screenToLogical(cx, cy, w.cv.getBoundingClientRect());
    if (!p.inside) return;
    // 拖放词具：岸边近水 = 交给水边；近身 = 交给自己；规则同样只走 interact
    const nearWater = w.currentRoom === 'bank' && Math.abs(p.x - w.geo.bank.waterX) < 130;
    const id = nearWater ? 'water' : Math.hypot(p.x - w.player.x, p.y - w.player.y) < 130 ? 'self' : null;
    if (id) w.run(interact(w.game, id, word));
  },

  syncHeld,

  runExtras: {
    drop(w, ins) {                        // 本章掉落按 only 名单定点排布（与公共 dropExtra 的散开策略不同）
      const def = w.content.words[ins.word];
      const flow = w.content.flows[ins.word];
      const only = ins.only || def.phonemes.map(([ipa]) => ipa);
      only.forEach((ipa, i) => spawnSideStone(w.stones, ipa, flow.drop[0] + i * 42, flow.drop[1] - 120, (Math.random() - 0.5) * 35, -120));
    },
    dropBack: dropBackExtra(currentGround, -50),
    shrug(w) { w.view.shrugT = 1.2; },
    bubble(w) { w.view.bubbleT = 2.6; },
    effect(w, ins) {
      if (ins.name === 'roomTransition') {
        w.transition = { room: ins.room, alpha: 0, dir: 1 };
      } else if (ins.name === 'placeLog') {
        if (ins.full) {                   // 第 slot 根原木落水处溅水花
          const k = (ins.slot ?? 1) - 1;
          w.view.puffs.push({ x: w.geo.bank.waterX - 20 + k * 44, y: w.geo.bank.groundY - 20, r: 8, a: 1 });
        } else w.sfx.glowTick();          // 已放满：只给轻响，不再放置
      } else if (ins.name === 'assembleRaft') {
        w.view.puffs.push({ x: w.geo.bank.waterX + 50, y: w.geo.bank.groundY - 30, r: 10, a: 1 });
        w.sfx.itemIn();
      } else if (ins.name === 'raftRiderUnlock') {
        if (ins.full) w.view.bulbT = 2.8;
        else w.sfx.glowTick();
      } else if (ins.name === 'embark') {
        w.sfx.water();
      } else if (ins.name === 'poleRiver') {
        if (ins.full) { w.view.poleT = 1.2; w.sfx.sweepUp(); }
        else w.sfx.glowTick();
      }
    }
  },

  summaryMerge(game) {
    return { everPicked: [...game.inv.everPicked], words: [...game.book], abilities: ['raft'], chapter: 3 };
  },

  onFinal(w) {
    w.ui.setHint('end');
    const walk = document.getElementById('btn-walk');
    walk.textContent = '旅程完成';
    walk.onclick = null;
  },

  draw(w, x, eTarget) {
    const { game, view, sc } = w;
    x.clearRect(0, 0, SIDE.W, SIDE.H);
    drawScene(x, sc, w);
    if (w.currentRoom === 'bank') drawBankObjects(w, x);
    if (w.currentRoom === 'crevice') drawCreviceObjects(w, x);
    if (w.currentRoom === 'deep') drawDeepObjects(w, x);
    x.save();
    if (view.shrugT > 0) { x.translate(w.player.x, w.player.y); x.scale(1.05, 0.92); x.translate(-w.player.x, -w.player.y); }
    drawPlayer(x, w.player, view.t, w.atlases);
    x.restore();
    for (const stone of w.stones) drawSideStone(x, stone, view.t);
    for (const pf of view.puffs) {                      // 水花/尘土
      x.globalAlpha = pf.a * 0.5; x.fillStyle = '#cfc9ba';
      x.beginPath(); x.arc(pf.x, pf.y - 6, pf.r, 0, 7); x.fill();
    }
    x.globalAlpha = 1;
    if (view.bulbT > 0) drawBulb(x, w.player.x, w.player.y - 100, view.bulbT / 2.8);
    if (view.bubbleT > 0) drawBubble(x, w.player, view.bubbleT);
    drawEHint(x, eTarget, view.t);
    vignette(x);
    if (view.fadeAlpha > 0) { x.fillStyle = `rgba(0,0,0,${view.fadeAlpha})`; x.fillRect(0, 0, SIDE.W, SIDE.H); }
    if (game.summary) { x.fillStyle = 'rgba(255,220,150,.12)'; x.fillRect(0, 0, SIDE.W, SIDE.H); }
  }
};

function placeRoom(w, room) {
  const geo = w.geo[room];
  w.player.x = geo.spawnX;
  w.player.y = geo.groundY;
  w.player.airborne = false;
  w.player.moving = false;
  if (room === 'deep') {
    w.raft.x = w.game.stalled ? geo.stallX : geo.raftX;   // 调试跳拍进停滞态时，筏应已停在停滞点
    w.raft.y = geo.groundY - 6;
  }
}

mount(kit);
