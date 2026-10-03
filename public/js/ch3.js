// —— 回响之石 · 第三间房：rope（r·əʊ·p；əʊ/p 为旧识凝石）——
import { createInventory, addStone, canConsume, consume } from './hotbar.js';

const cap = w => w[0].toUpperCase() + w.slice(1) + '.';

// ================= 纯事件机（Node 可测，行为与重构前一致） =================
export function createGame(content, profile) {
  return {
    content, beat: 'start',
    inv: createInventory(),
    book: new Set(), stonesPicked: 0,
    hand: null, attempted: false,
    mended: profile.abilities.includes('climb') ? true : false,
    climbed: false, exited: false, teaseClock: 0
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
        { t: 'speak', who: 'child', text: c.flows.rope.puzzled[0] }
      ];
      if (first) out.push({ t: 'drop', word: 'rope' }, { t: 'hint', key: 'carrying' });
      return out;
    }
    case 'PICKUP': {
      const ipa = arg;
      const out = [];
      if (g.hand?.kind === 'stone') out.push({ t: 'dropBack', ipa: g.hand.ipa });
      g.hand = { kind: 'stone', ipa };
      g.inv.everPicked.add(ipa);
      g.stonesPicked++;
      out.push({ t: 'carrier', ipa }, { t: 'hand' });
      if (g.stonesPicked === 1) out.push({ t: 'hint', key: 'carrying' });
      return out;
    }
    case 'BANK': {
      if (g.hand?.kind !== 'stone') return [];
      const ipa = g.hand.ipa;
      g.hand = null;
      addStone(g.inv, ipa);
      return [{ t: 'bank', ipa }, { t: 'hand' }];
    }
    case 'HOLD_ITEM': {
      const word = arg;
      if (!g.inv.items.has(word)) return [];
      if (g.hand?.kind === 'item' && g.hand.word === word) {
        g.hand = null;                                   // 再点一次 = 放下
        return [{ t: 'hand' }];
      }
      g.hand = { kind: 'item', word };
      return [{ t: 'hand' }, { t: 'hint', key: 'give' }];
    }
    case 'CRAFT': {
      const word = arg;
      if (!c.words[word] || g.inv.items.has(word)) return [];
      const phon = c.words[word].phonemes.map(p => p[0]);
      if (!canConsume(g.inv, phon)) return [];
      consume(g.inv, phon);
      g.inv.items.set(word, true);
      g.book.add(word);
      return [
        { t: 'resonate', word },
        { t: 'speak', who: 'child', text: cap(word) },
        { t: 'itemIn', word },
        { t: 'hint', key: 'give' }
      ];
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
      return [{ t: 'hint', key: 'top' }, { t: 'beat', beat: 'top' }];
    }
    case 'EXIT': {
      if (g.exited) return [];
      g.exited = true;
      g.beat = 'summary';
      return [{ t: 'summary' }];
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
    case 'drop': return gameEvent(g, 'ROPE');
    case 'crafted': {
      let out = ropeDebug(g, 'drop');
      for (const [ipa] of g.content.words.rope.phonemes) {
        out = out.concat(gameEvent(g, 'PICKUP', ipa), gameEvent(g, 'BANK'));
      }
      return out.concat(gameEvent(g, 'CRAFT', 'rope'));
    }
    case 'mended': return ropeDebug(g, 'crafted').concat(gameEvent(g, 'USE', { word: 'rope', target: 'rope' }));
    default: return [];
  }
}

// ================= 浏览器 kit（壳 + 横版共用件） =================
import { mount } from './shell.js';
import { SIDE, shade, moveSide, sideJump, spawnSideStone, stepSideStone, planDropStones,
         drawSideStone, drawTorchSide, drawBenchSide, drawEHint, vignette, drawFloorSide, drawMossyWall } from './sideview.js';
import { PAL, drawRune } from './art.js';
import { blit, tile, SPR } from './sprites.js';
import { createActors, updateActors, drawPlayer } from './actors.js';
import { seedMemory, neededSeeds } from './profile.js';
import { isVowel } from './hotbar.js';
import { screenToLogical } from './scene.js';

const kit = {
  chapter: 3, W: SIDE.W, H: SIDE.H, titleRune: 'ᚱ',

  createGame, startGame, gameEvent, debug: ropeDebug,

  voices: v => ({
    child: { voice: v.child, pitch: 1.25, rate: 1, rateSlow: 0.8 },
    door: { voice: v.door, pitch: 0.7, rate: 0.8, rateSlow: 0.6 }
  }),

  makeWorld({ content, profile, game, cv }) {
    const geo = content.geometry;
    const ropeX = geo.wallX + 12;
    const actors = createActors();
    const player = actors.player;
    player.x = geo.spawnX; player.y = geo.groundY; player.dir = 'right';
    player.vy = 0; player.airborne = false; player.climbing = false;
    const canJump = profile.abilities.includes('jump');
    const w = {
      actors, player, geo, canJump, cv,
      stones: [],
      view: { t: 0, puffs: [], ropeMendT: 0, winOpen: false },
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
    cv.addEventListener('pointermove', updateRopeCursor);
    cv.addEventListener('pointerleave', () => { cv.style.cursor = 'default'; });
    return w;
  },

  onBegin(w) {
    const seeds = neededSeeds(w.content, w.profile.everPicked);              // 只带本章需要的旧音素（əʊ、p）
    const seeded = seedMemory(w.game.inv, addStone, seeds);
    if (seeded.length) setTimeout(() => { w.sfx.chime(); w.hb.refresh(w.game.inv); }, 900);
    w.hb.refresh(w.game.inv);
  },

  onSpace(w) { if (w.canJump) { sideJump(w); w.sfx.click(); } },

  tick(w, dt) {
    const { view: v, geo, player } = w;
    const ropeX = geo.wallX + 12;
    v.t += dt;
    v.ropeMendT = Math.max(0, v.ropeMendT - dt);
    updateActors(w.actors, dt);
    if (player.climbing) {
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
        w.run(gameEvent(w.game, 'CLIMBED'));
        w.sfx.chime();
      }
    } else {
      const rope = w.cfg.rope;
      w.cfg.rope = null;
      moveSide(w, dt);
      w.cfg.rope = rope;
      if (player.y <= geo.topY + 2) {                     // 塔顶平台：不许走出边缘掉下去
        player.x = Math.max(geo.wallX + 20, Math.min(geo.wallX + geo.wallW - 20, player.x));
      }
      if (player.moving && (w.keys.has('l') || w.keys.has('r'))) player.walkT += dt;
    }
    for (const s of w.stones) {
      if (s.state === 'idle') continue;
      stepSideStone(s, dt, geo.groundY);
      if (s.state === 'idle' && s.x >= geo.wallX && s.x <= geo.wallX + geo.wallW)
        s.x = geo.wallX - 30 - Math.random() * 40;                          // 保险：石头绝不落在墙里/墙后
    }
    v.puffs = v.puffs.filter(p => { p.r += dt * 40; p.a -= dt * 2; return p.a > 0; });
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
    if (w.game.mended && player.y >= geo.groundY - 20) {
      consider(Math.abs(player.x - ropeX), { kind: 'obj', id: 'rope', x: ropeX, y: geo.groundY }, 65);
    }
    consider(Math.hypot(player.x - geo.exitX, player.y - geo.topY), { kind: 'obj', id: 'exit', x: geo.exitX, y: geo.topY }, 80);  // 须在顶台（y≈topY）才可交
    return best;
  },

  onPointerDown(w, e, cv) {
    if (w.game.mended) { cv.style.cursor = 'default'; return; }
    const p = screenToLogical(e.clientX, e.clientY, cv.getBoundingClientRect());
    const ropeX = w.geo.wallX + 12;
    if (!p.inside || Math.hypot(p.x - ropeX, p.y - (w.geo.topY + 192)) > 60) return;
    if (w.game.hand?.kind === 'item' && w.game.hand.word === 'rope') {
      w.run(gameEvent(w.game, 'USE', { word: 'rope', target: 'rope' }));
    } else {
      w.run(gameEvent(w.game, 'ROPE'));
    }
    cv.style.cursor = 'default';
  },

  onE(w, t) {
    const { game } = w;
    if (t.kind === 'stone') {
      const i = w.stones.indexOf(t.stone);
      if (i >= 0) w.stones.splice(i, 1);
      w.run(gameEvent(game, 'PICKUP', t.ipa));
    }
    else if (t.id === 'bench') w.run(gameEvent(game, 'BANK'));
    else if (t.id === 'rope' && game.mended) {
      w.player.climbing = true;
      w.player.airborne = false;
      w.player.x = w.geo.wallX + 12;
      w.player.y = w.geo.groundY;
    }
    else if (t.id === 'exit') w.run([{ t: 'windowExit' }]);
    else w.sfx.mutter();
  },

  syncHeld(w) {
    const p = w.player, h = w.game.hand;
    if (!h) { p.held = null; p.heldVowel = false; p.heldIcon = null; return; }
    if (h.kind === 'stone') { p.held = h.ipa; p.heldVowel = isVowel(h.ipa); p.heldIcon = null; }
    else { p.held = null; p.heldVowel = false; p.heldIcon = w.content.words[h.word].icon; }
  },

  runExtras: {
    drop(w, ins) {
      const f = w.content.flows[ins.word];
      for (const s of planDropStones(w.content.words[ins.word], w.game.inv, f.drop, w.geo.wallX)) {
        spawnSideStone(w.stones, s.ipa, s.x, f.drop[1] - 170, (Math.random() - 0.5) * 30, -110);
      }
    },
    dropBack(w, ins) { spawnSideStone(w.stones, ins.ipa, w.player.x - 20, w.geo.groundY - 120, -60, -100); },
    effect(w, ins) {
      if (ins.name !== 'mendRope') return;
      if (ins.full) { w.cv.style.cursor = 'default'; w.sfx.itemIn(); w.view.ropeMendT = 1.2; w.ui.setHint('mended'); }
      else w.sfx.glowTick();
    },
    windowExit(w) {
      if (w.view.winOpen) { w.run(gameEvent(w.game, 'EXIT')); return; }
      w.view.winOpen = true;                                  // 推开窗
      w.sfx.creak();
      setTimeout(() => w.run(gameEvent(w.game, 'EXIT')), 500); // 稍作停留再结算
    }
  },

  summaryMerge(game) {
    return { everPicked: [...game.inv.everPicked], words: [...game.book], abilities: ['climb'], chapter: 3 };
  },

  onFinal(w) {
    w.ui.setHint('end');
    const walk = document.getElementById('btn-walk');
    walk.textContent = '下一间房 →';
    walk.onclick = () => { location.href = '/chapter4.html'; };
  },

  draw(w, x, eTarget) {
    const { view: v, geo, game } = w;
    const ropeX = geo.wallX + 12;
    x.clearRect(0, 0, SIDE.W, SIDE.H);
    if (!w.bg) w.bg = makeBg(w);                                            // 夜空/高墙/地面一次性预渲染
    x.drawImage(w.bg, 0, 0);
    drawRope(x, w, ropeX);
    drawTorchSide(x, 90, 180, v.t);
    drawBenchSide(x, w.atlases, geo.benchX, geo.groundY, game.hand?.kind === 'stone');
    drawWindow(x, w.atlases, geo.exitX, geo.topY, v.winOpen, game.climbed, v.t);
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
    drawEHint(x, eTarget, v.t);
    vignette(x);
  }
};

function makeBg(w) {
  const { geo } = w;
  const c = document.createElement('canvas');
  c.width = SIDE.W; c.height = SIDE.H;
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  // 全墙：一二关同款青苔墙砖（整面都是墙）
  drawMossyWall(x, w.atlases, SIDE.W, SIDE.H, 23);
  const wsh = x.createLinearGradient(0, 0, 0, 340);
  wsh.addColorStop(0, 'rgba(10,12,20,.42)'); wsh.addColorStop(0.6, 'rgba(10,12,20,0)');
  x.fillStyle = wsh; x.fillRect(0, 0, SIDE.W, 340);
  // 窗沿（塔顶平台沿）
  drawFloorSide(x, w.atlases, geo.wallX, geo.topY - 14, geo.wallW, 16);
  x.fillStyle = 'rgba(255,236,200,.10)';
  x.fillRect(geo.wallX, geo.topY - 14, geo.wallW, 2);
  // 地面：一二关同款砖石地砖
  tile(x, w.atlases, 'floor_brick', 0, geo.groundY, SIDE.W, SIDE.H - geo.groundY, 0.25);
  x.fillStyle = 'rgba(255,236,200,.09)'; x.fillRect(0, geo.groundY, SIDE.W, 2);
  const fsh = x.createLinearGradient(0, geo.groundY - 8, 0, geo.groundY + 36);
  fsh.addColorStop(0, 'rgba(0,0,0,.30)'); fsh.addColorStop(1, 'rgba(0,0,0,0)');
  x.fillStyle = fsh; x.fillRect(0, geo.groundY - 8, SIDE.W, 44);
  const gsh = x.createLinearGradient(0, geo.groundY, 0, SIDE.H);
  gsh.addColorStop(0, 'rgba(0,0,0,0)'); gsh.addColorStop(1, 'rgba(0,0,0,.40)');
  x.fillStyle = gsh; x.fillRect(0, geo.groundY, SIDE.W, SIDE.H - geo.groundY);
  // 黄昏底色：与一二关统一
  x.fillStyle = 'rgba(16,18,36,.30)';
  x.fillRect(0, 0, SIDE.W, SIDE.H);
  return c;
}

function drawRope(x, w, ropeX) {
  const geo = w.geo, v = w.view, game = w.game;
  const sway = Math.sin(v.t * 1.6) * 6;
  const anchorY = geo.topY - 10;
  if (!game.mended) {
    // 断绳：散头贴图从墙顶垂下（15 倍缩小须平滑采样），末端轻摆 + 互动绿光
    const len = 198, wid = 13;
    x.save();
    x.translate(ropeX, anchorY);
    x.rotate(sway * 0.0022);
    x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
    blit(x, w.atlases, 'rope_broken', 0, 0, { w: wid, h: len, ax: 0.5 });
    x.restore();
    const endY = anchorY + len;
    const gp = Math.sin(v.t * 3) * 0.5 + 0.5;
    const g = x.createRadialGradient(ropeX, endY + 2, 4, ropeX, endY + 2, 44 + gp * 16);
    g.addColorStop(0, `rgba(123,216,143,${0.3 + gp * 0.25})`); g.addColorStop(1, 'rgba(123,216,143,0)');
    x.fillStyle = g; x.beginPath(); x.arc(ropeX, endY + 2, 60, 0, 7); x.fill();
  } else if (v.ropeMendT < 1.2) {
    // 好绳：绳身贴图平铺（交替垂直镜像，接缝无痕）+ 绳结收尾；随 ropeMendT 向下生长
    const endY = geo.groundY - 14;
    const grow = Math.min(1, Math.max(0, (1.2 - v.ropeMendT) / 0.9));
    const curLen = (endY - anchorY) * grow;
    if (curLen < 4) return;
    const atlas = w.atlases?.furn;
    if (!atlas) return;
    const spr = SPR.rope_fixed;                          // 16x120：绳身 y=8..88，绳结 y=88..120
    const s = 1.3;                                       // 绳身 5px×1.3=6.5px，与断绳视觉宽度(≈6.6px)一致
    const segW = spr.w * s, segH = 80 * s;
    const knotH = (spr.h - 88) * s;
    const dx = -segW * 0.44;                             // 绳芯对齐 ropeX
    x.save();
    x.translate(ropeX, anchorY);
    x.rotate(sway * 0.0012);
    x.imageSmoothingEnabled = false;
    let y = 0, flip = false;
    const limit = curLen > knotH ? curLen - knotH : curLen;
    while (y < limit) {                                  // 绳身平铺
      const h = Math.min(segH, limit - y);
      const srcH = 80 * (h / segH);
      if (flip) {                                        // 垂直镜像：底边接上一块的底边，无痕
        x.save();
        x.translate(0, y + h); x.scale(1, -1);
        x.drawImage(atlas, spr.x, spr.y + 8, spr.w, srcH, dx, 0, segW, h);
        x.restore();
      } else {
        x.drawImage(atlas, spr.x, spr.y + 8, spr.w, srcH, dx, y, segW, h);
      }
      y += h; flip = !flip;
    }
    if (curLen > knotH) {                                // 末端绳结
      x.drawImage(atlas, spr.x, spr.y + 88, spr.w, spr.h - 88, dx, curLen - knotH, segW, knotH);
    }
    x.restore();
  }
}

// 塔顶出口：窗户立在窗沿上（关=拱形窗，按 E 推开=双页窗）
function drawWindow(x, imgs, ex, ty, open, lit, t) {
  if (!open && lit) {                                        // 可互动时的暖光提示
    const gp = Math.sin(t * 3) * 0.5 + 0.5;
    const g = x.createRadialGradient(ex, ty - 40, 6, ex, ty - 40, 48 + gp * 12);
    g.addColorStop(0, `rgba(255,214,130,${0.16 + gp * 0.16})`); g.addColorStop(1, 'rgba(255,214,130,0)');
    x.fillStyle = g; x.beginPath(); x.arc(ex, ty - 40, 60, 0, 7); x.fill();
  }
  if (open) blit(x, imgs, 'window_open', ex - 28, ty - 78, { w: 56, h: 78 });
  else blit(x, imgs, 'window_closed', ex - 28, ty - 78, { w: 56, h: 78 });
}

function drawClimbArms(x, p) {
  const ph = Math.sin(p.walkT * 8) * 6;
  x.strokeStyle = PAL.ink; x.lineWidth = 4; x.lineCap = 'round';
  x.beginPath(); x.moveTo(p.x + 6, p.y - 40); x.lineTo(p.x + 16, p.y - 52 - ph); x.stroke();
  x.beginPath(); x.moveTo(p.x + 6, p.y - 36); x.lineTo(p.x + 16, p.y - 44 + ph); x.stroke();
}

mount(kit);
