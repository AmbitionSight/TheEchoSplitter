// —— 回响之石 · 第三间房：rope（r·əʊ·p；əʊ/p 为旧识凝石）——
// 横版崖壁：高墙上垂一截断绳 → E 断绳（Rope…）→ 掉 r → 搬运合成 rope →
// 对断绳使用 → 绳索补全 → 按住 ↑ 攀爬 → 翻上墙顶 → 出口门。
import { createInventory, addStone, canConsume, consume,
         createHotbar, isVowel } from './hotbar.js';

const cap = w => w[0].toUpperCase() + w.slice(1) + '.';

// ================= 纯事件机（Node 可测） =================
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
    case 'ROPE': {                        // E 断绳：世界低语 Rope… + 童声疑惑 + 只掉 r
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
      g.hand = { kind: 'item', word };
      return [{ t: 'speak', who: 'child', text: cap(word) }, { t: 'hand' }, { t: 'hint', key: 'give' }];
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
    case 'USE': {                          // rope 词具对断绳使用 → 补全
      const { word, target } = arg;
      const def = c.words[word]?.use;
      if (!def || target !== def.target) return [{ t: 'mutter' }];
      if (g.mended) return [{ t: 'speak', who: 'child', text: cap(word) }, { t: 'effect', name: 'mendRope', full: false }];
      g.mended = true; g.hand = null;
      return [{ t: 'speak', who: 'child', text: cap(word) }, { t: 'hand' }, { t: 'effect', name: 'mendRope', full: true }];
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

// ================= 浏览器 kit（崖壁 + 断绳 + 攀爬） =================
import { PAL, drawRune } from './art.js';
import { Speech, Sfx, pickVoices } from './audio.js';
import { createActors, updateActors, drawPlayer, drawCat } from './actors.js';
import { createUI } from './ui.js';
import { loadProfile, saveProfile, mergeProfile, seedMemory } from './profile.js';

const G = { W: 1280, H: 720 };

function boot() {
  const el = id => document.getElementById(id);
  const cv = el('game'), ctx = cv.getContext('2d');
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = G.W * dpr; cv.height = G.H * dpr;
  ctx.scale(dpr, dpr);
  const fit = () => {
    const s = Math.min(innerWidth / G.W, innerHeight / G.H);
    el('stage').style.width = `${G.W * s}px`; el('stage').style.height = `${G.H * s}px`;
  };
  fit(); addEventListener('resize', fit);
  window.__errors = [];
  addEventListener('error', e => __errors.push(String(e.message)));
  addEventListener('unhandledrejection', e => __errors.push(String(e.reason)));
  fetch('/api/chapter3').then(r => r.json()).catch(() => null).then(content => start(content));
}

function start(content) {
  const el = id => document.getElementById(id);
  const cv = el('game'), ctx = cv.getContext('2d');
  const geo = content.geometry;
  const profile = loadProfile(localStorage);

  const speech = new Speech(), sfx = new Sfx();
  let voices = { uncle: null, child: null, door: null };
  const scan = () => { if (speech.ready) voices = pickVoices(speechSynthesis.getVoices()); };
  scan();
  if (speech.ready) speechSynthesis.addEventListener('voiceschanged', scan);
  addEventListener('pointerdown', () => { sfx.ctx?.resume(); speech.warmup(); }, { once: true });

  let chain = Promise.resolve();
  function speak(text, who = 'door', slow = false) {
    const conf = {
      child: { voice: voices.child, pitch: 1.25, rate: slow ? 0.8 : 1 },
      door: { voice: voices.door, pitch: 0.7, rate: slow ? 0.6 : 0.8 }
    }[who];
    chain = chain.then(() => speech.speak(text, { ...conf })).catch(() => {});
    return chain;
  }

  const game = createGame(content, profile);
  const seeded = seedMemory(game.inv, addStone, profile.everPicked);           // 旧识凝石
  const canJump = profile.abilities.includes('jump');

  const actors = createActors();
  const player = actors.player;
  player.x = geo.spawnX; player.y = geo.groundY;
  player.vy = 0; player.airborne = false; player.climbing = false;
  actors.cat.x = geo.spawnX - 70; actors.cat.y = geo.groundY + 12;

  const stones = [];
  const view = { t: 0, stars: [], puffs: [], ropeMendT: 0 };
  let eTarget = null, started = false;

  const ui = createUI({ content });
  const hb = createHotbar({
    words: content.words,
    crafting: content.crafting || { progressiveGlow: true },
    onSpeakCarrier: ipa => { sfx.click(); speak(content.carriers[ipa], 'child'); },
    onCraft: word => run(gameEvent(game, 'CRAFT', word)),
    onTakeItem: word => run(gameEvent(game, 'HOLD_ITEM', word)),
    onDropItem: () => {}
  });
  hb.show(); hb.refresh(game.inv);
  if (seeded.length) setTimeout(() => { sfx.chime(); }, 900);

  function spawnDrop(word) {
    const f = content.flows[word];
    content.words[word].phonemes.forEach(([ipa], i) => {
      stones.push({ ipa, x: f.drop[0] + i * 46, y: f.drop[1] - 170, vx: (Math.random() - 0.5) * 30, vy: -110,
                    state: 'fly', t: 0, phase: Math.random() * 6.28 });
    });
  }
  function stepStone(s, dt) {
    s.vy += 1300 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.y >= geo.groundY - 14 && s.vy > 0) { s.y = geo.groundY - 14; s.vy = 0; s.vx = 0; s.state = 'idle'; }
  }
  function spawnOne(ipa, x) {
    stones.push({ ipa, x, y: geo.groundY - 120, vx: -60, vy: -100, state: 'fly', t: 0, phase: Math.random() * 6.28 });
  }

  function run(instructions) {
    for (const ins of instructions) {
      switch (ins.t) {
        case 'speak': speak(ins.text, ins.who, ins.slow); break;
        case 'carrier': sfx.click(); speak(content.carriers[ins.ipa], 'child'); break;
        case 'drop': spawnDrop(ins.word); break;
        case 'dropBack': spawnOne(ins.ipa, player.x - 20); break;
        case 'hint': ui.setHint(ins.key); break;
        case 'beat': game.beat = ins.beat; break;
        case 'bank': sfx.itemIn(); hb.refresh(game.inv); break;
        case 'hand': ui.updateHand(game.hand); syncHeld(); break;
        case 'resonate': sfx.resonate(); hb.refresh(game.inv); break;
        case 'itemIn': sfx.itemIn(); hb.refresh(game.inv); break;
        case 'mutter': sfx.mutter(); break;
        case 'meow': sfx.meow(); actors.cat.earT = 1; actors.cat.meowT = 0.6; break;
        case 'effect': applyEffect(ins.name, ins.full); break;
        case 'summary': finish(); break;
      }
    }
  }

  function applyEffect(name, full) {
    if (name === 'mendRope') {
      if (full) { sfx.itemIn(); view.ropeMendT = 1.2; ui.setHint('mended'); }
      else sfx.glowTick();
    }
  }

  function syncHeld() {
    if (!game.hand) { player.held = null; player.heldVowel = false; player.heldIcon = null; return; }
    if (game.hand.kind === 'stone') { player.held = game.hand.ipa; player.heldVowel = isVowel(game.hand.ipa); player.heldIcon = null; }
    else { player.held = null; player.heldVowel = false; player.heldIcon = content.words[game.hand.word].icon; }
  }

  function finish() {
    const p = mergeProfile(loadProfile(localStorage), {
      everPicked: [...game.inv.everPicked], words: [...game.book],
      abilities: ['climb'], chapter: 3
    });
    saveProfile(localStorage, p);
    ui.summary(game);
    const walk = document.getElementById('btn-walk');
    walk.textContent = '第四间房 · 敬请期待';
    walk.onclick = () => { /* 第四章未完待续 */ };
    ui.setHint('end');
  }

  // —— 输入 ——
  const keys = new Set();
  const KM = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', ArrowUp: 'u', KeyW: 'u' };
  addEventListener('keydown', e => {
    if (KM[e.code]) { keys.add(KM[e.code]); if (KM[e.code] !== 'u') return; }
    if (e.code === 'Space' && canJump && !player.airborne && !player.climbing) {
      e.preventDefault();
      player.vy = -740; player.airborne = true; sfx.click();
    }
    if (e.code === 'KeyE' && started && eTarget) doE();
  });
  addEventListener('keyup', e => { if (KM[e.code]) keys.delete(KM[e.code]); });
  addEventListener('blur', () => keys.clear());

  const ropeX = geo.wallX + geo.wallW / 2;
  function doE() {
    sfx.click();
    if (eTarget.kind === 'stone') {
      const i = stones.indexOf(eTarget.stone);
      if (i >= 0) stones.splice(i, 1);
      run(gameEvent(game, 'PICKUP', eTarget.ipa));
    }
    else if (eTarget.id === 'bench') run(gameEvent(game, 'BANK'));
    else if (eTarget.id === 'cat') run([{ t: 'meow' }]);
    else if (eTarget.id === 'rope') {
      if (game.hand?.kind === 'item' && game.hand.word === 'rope') run(gameEvent(game, 'USE', { word: 'rope', target: 'rope' }));
      else run(gameEvent(game, 'ROPE'));
    }
    else if (eTarget.id === 'exit') run(gameEvent(game, 'EXIT'));
    else sfx.mutter();
  }

  function findE() {
    let best = null, bd = 1e9;
    const consider = (d, t, r) => { if (d < bd && d <= r) { bd = d; best = t; } };
    for (const s of stones) if (s.state === 'idle') consider(Math.hypot(player.x - s.x, player.y - s.y), { kind: 'stone', ipa: s.ipa, x: s.x, y: s.y, stone: s }, 56);
    consider(Math.abs(player.x - geo.benchX), { kind: 'obj', id: 'bench', x: geo.benchX, y: geo.groundY }, 80);
    consider(Math.hypot(player.x - ropeX, player.y - (geo.groundY - 80)), { kind: 'obj', id: 'rope', x: ropeX, y: geo.groundY - 80 }, 90);
    consider(Math.abs(player.x - geo.exitX), { kind: 'obj', id: 'exit', x: geo.exitX, y: geo.topY }, 80);
    consider(Math.abs(player.x - actors.cat.x), { kind: 'obj', id: 'cat', x: actors.cat.x, y: actors.cat.y }, 50);
    return best;
  }

  // —— 主循环 ——
  const onTop = () => player.y <= geo.topY + 2;
  const atRope = () => game.mended && Math.abs(player.x - ropeX) < 34;
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    view.t += dt;
    view.ropeMendT = Math.max(0, view.ropeMendT - dt);
    updateActors(actors, dt);

    // 攀爬（补绳后，绳下按住 ↑）
    if (player.climbing) {
      player.moving = false;
      if (!atRope()) player.climbing = false;
      if (keys.has('u')) { player.y -= 170 * dt; player.walkT += dt; }
      if (keys.has('d')) player.y += 130 * dt;
      player.y = Math.max(geo.topY, Math.min(geo.groundY, player.y));
      if (player.y <= geo.topY + 1) { player.climbing = false; run(gameEvent(game, 'CLIMBED')); sfx.chime(); }
    } else {
      const sp = 300 * dt;
      if (keys.has('l')) { player.x -= sp; player.facing = -1; }
      if (keys.has('r')) { player.x += sp; player.facing = 1; }
      player.moving = keys.size > 0 && !player.airborne;
      // 高墙阻挡（墙顶才可越过）
      const inWallX = player.x > geo.wallX - 14 && player.x < geo.wallX + geo.wallW + 14;
      if (inWallX && player.y > geo.topY + 4) {
        player.x = player.x < geo.wallX + geo.wallW / 2 ? geo.wallX - 14 : geo.wallX + geo.wallW + 14;
      }
      if (atRope() && keys.has('u') && !player.airborne && player.y > geo.topY) player.climbing = true;
      // 跳跃/重力
      if (player.airborne) {
        player.vy += 1500 * dt; player.y += player.vy * dt;
        const groundY = onTop() && player.x > geo.wallX && player.x < geo.wallX + geo.wallW ? geo.topY : geo.groundY;
        if (player.vy > 0 && player.y >= groundY) {
          player.y = groundY; player.vy = 0; player.airborne = false;
          view.puffs.push({ x: player.x, y: groundY, r: 6, a: 1 });
        }
      } else {
        player.y = (player.x > geo.wallX && player.x < geo.wallX + geo.wallW && player.y <= geo.topY + 2) ? geo.topY : geo.groundY;
      }
    }
    player.x = Math.max(40, Math.min(G.W - 40, player.x));

    const tx = player.y < geo.groundY - 160 ? actors.cat.x : Math.max(geo.spawnX - 70, Math.min(player.x - 80, geo.wallX - 70));
    actors.cat.x += (tx - actors.cat.x) * Math.min(1, dt * 2.5);

    for (let i = stones.length - 1; i >= 0; i--) if (stones[i].state !== 'idle') stepStone(stones[i], dt);
    view.stars = view.stars.filter(st => (st.a -= dt * 1.2) > 0);
    view.puffs = view.puffs.filter(p => { p.r += dt * 40; p.a -= dt * 2; return p.a > 0; });

    eTarget = started ? findE() : null;
    if (started) run(gameEvent(game, 'TICK', dt));

    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function draw() {
    const x = ctx;
    x.clearRect(0, 0, G.W, G.H);
    drawScene(x);
    drawCat(x, actors.cat, view.t);
    x.save();
    if (player.climbing) {                                                // 攀爬贴墙姿态
      x.translate(player.x, player.y);
      x.rotate(0.12);
      x.translate(-player.x, -player.y);
    }
    drawPlayer(x, player, view.t);
    x.restore();
    if (player.climbing) drawClimbArms(x);
    for (const s of stones) drawStone(x, s);
    drawFX(x);
    drawEHint(x);
    vignette(x);
  }

  function drawScene(x) {
    // 背崖（渐暗远山 + 星点）
    const sky = x.createLinearGradient(0, 0, 0, G.H);
    sky.addColorStop(0, '#0b0e18'); sky.addColorStop(1, '#1c1610');
    x.fillStyle = sky; x.fillRect(0, 0, G.W, G.H);
    x.fillStyle = 'rgba(244,240,216,.5)';
    for (let i = 0; i < 20; i++) x.fillRect((i * 137 + 60) % G.W, (i * 89 + 40) % 320, 2, 2);
    // 高墙
    x.fillStyle = shade(PAL.wallA, -0.1);
    x.fillRect(geo.wallX, geo.topY, geo.wallW, geo.groundY - geo.topY);
    x.strokeStyle = PAL.wallDark; x.lineWidth = 3;
    for (let ry = geo.topY + 30; ry < geo.groundY; ry += 60) {
      x.beginPath(); x.moveTo(geo.wallX, ry); x.lineTo(geo.wallX + geo.wallW, ry); x.stroke();
    }
    // 墙顶平台
    x.fillStyle = shade(PAL.floorB, -0.02);
    x.fillRect(geo.wallX, geo.topY - 14, geo.wallW, 16);
    x.fillStyle = 'rgba(255,236,200,.1)';
    x.fillRect(geo.wallX, geo.topY - 14, geo.wallW, 3);
    // 地面
    x.fillStyle = shade(PAL.floorB, -0.05);
    x.fillRect(0, geo.groundY, G.W, G.H - geo.groundY);
    x.fillStyle = 'rgba(255,236,200,.07)'; x.fillRect(0, geo.groundY, G.W, 3);
    // 断绳 / 补全绳
    const sway = Math.sin(view.t * 1.6) * 6;
    x.strokeStyle = '#c9a35e'; x.lineCap = 'round';
    if (!game.mended) {
      x.lineWidth = 7;
      x.beginPath();                                                       // 残绳（随风摆）
      x.moveTo(ropeX - 4, geo.topY - 10);
      x.quadraticCurveTo(ropeX - 10 + sway, geo.topY + 130, ropeX - 2 + sway, geo.topY + 190);
      x.stroke();
      x.lineWidth = 3; x.strokeStyle = '#a8814a';                          // 散絮断口
      for (const [dx, dy] of [[-5, 8], [4, 10], [0, 14]]) {
        x.beginPath(); x.moveTo(ropeX - 2 + sway, geo.topY + 190); x.lineTo(ropeX - 2 + sway + dx * 2, geo.topY + 190 + dy); x.stroke();
      }
      const gp = Math.sin(view.t * 3) * 0.5 + 0.5;                         // 断口微光 beckoning
      const g = x.createRadialGradient(ropeX + sway, geo.topY + 192, 4, ropeX + sway, geo.topY + 192, 44 + gp * 16);
      g.addColorStop(0, `rgba(123,216,143,${0.3 + gp * 0.25})`); g.addColorStop(1, 'rgba(123,216,143,0)');
      x.fillStyle = g; x.beginPath(); x.arc(ropeX + sway, geo.topY + 192, 60, 0, 7); x.fill();
    } else {
      const grow = Math.min(1, (1.2 - view.ropeMendT) / 0.9);
      const endY = geo.topY + 190 + (geo.groundY - 14 - geo.topY - 190) * grow;
      x.lineWidth = 8;
      x.beginPath();
      x.moveTo(ropeX - 4, geo.topY - 10);
      x.quadraticCurveTo(ropeX - 10 + sway * 0.5, (geo.topY + geo.groundY) / 2 - 60, ropeX + sway * 0.4, endY);
      x.stroke();
      x.fillStyle = PAL.rugGold;                                           // 两个绳结
      for (const ky of [geo.topY + 220, geo.topY + 320]) {
        x.beginPath(); x.ellipse(ropeX + sway * 0.4, ky, 8, 5, 0, 0, 7); x.fill();
        x.lineWidth = 2; x.strokeStyle = PAL.ink; x.stroke();
      }
    }
    drawTorchSide(x, 90, 180, view.t);
    drawBench(x, geo.benchX, geo.groundY);
    drawExit(x, geo.exitX, geo.topY);
  }

  function drawTorchSide(x, tx, ty, t) {
    x.strokeStyle = PAL.wood2; x.lineWidth = 6;
    x.beginPath(); x.moveTo(tx, ty + 26); x.lineTo(tx, ty); x.stroke();
    const f = Math.sin(t * 13 + tx) * 0.12 + 1;
    x.fillStyle = PAL.fire2;
    x.beginPath();
    x.moveTo(tx, ty - 18 * f);
    x.bezierCurveTo(tx + 10, ty - 6, tx + 8, ty + 6, tx, ty + 10);
    x.bezierCurveTo(tx - 8, ty + 6, tx - 10, ty - 6, tx, ty - 18 * f);
    x.fill();
    x.fillStyle = PAL.fireCore;
    x.beginPath(); x.arc(tx, ty + 2, 4, 0, 7); x.fill();
    const g = x.createRadialGradient(tx, ty, 4, tx, ty, 110);
    g.addColorStop(0, 'rgba(255,170,80,.22)'); g.addColorStop(1, 'rgba(255,170,80,0)');
    x.fillStyle = g; x.beginPath(); x.arc(tx, ty, 110, 0, 7); x.fill();
  }

  function drawBench(x, bx, gy) {
    x.fillStyle = 'rgba(0,0,0,.25)';
    x.beginPath(); x.ellipse(bx, gy + 6, 60, 9, 0, 0, 7); x.fill();
    x.strokeStyle = PAL.ink; x.lineWidth = 4;
    for (const lx of [bx - 40, bx + 40]) { x.beginPath(); x.moveTo(lx - 5, gy - 38); x.lineTo(lx + 3, gy); x.stroke(); }
    x.fillStyle = PAL.wood;
    x.beginPath(); x.roundRect ? x.roundRect(bx - 62, gy - 62, 124, 22, 6) : x.rect(bx - 62, gy - 62, 124, 22);
    x.fill(); x.lineWidth = 4.5; x.stroke();
    x.fillStyle = shade(PAL.stoneD, -0.2);
    x.beginPath(); x.roundRect ? x.roundRect(bx - 48, gy - 58, 96, 14, 6) : x.rect(bx - 48, gy - 58, 96, 14);
    x.fill(); x.lineWidth = 3; x.stroke();
    for (let i = 0; i < 4; i++) {
      const sx = bx - 33 + i * 22;
      x.fillStyle = 'rgba(0,0,0,.4)';
      x.beginPath(); x.arc(sx, gy - 51, 5, 0, 7); x.fill();
      if (game.hand?.kind === 'stone') { x.fillStyle = 'rgba(84,224,200,.25)'; x.beginPath(); x.arc(sx, gy - 51, 9, 0, 7); x.fill(); }
    }
  }

  function drawExit(x, ex, ty) {
    x.fillStyle = PAL.stone;
    x.beginPath();
    x.moveTo(ex - 40, ty); x.lineTo(ex - 40, ty - 78);
    x.arc(ex, ty - 78, 40, Math.PI, 0); x.lineTo(ex + 40, ty); x.closePath();
    x.fill(); x.lineWidth = 6; x.strokeStyle = PAL.stoneD; x.stroke();
    const open = game.climbed;
    x.fillStyle = open ? 'rgba(255,214,130,.85)' : 'rgba(20,24,34,.9)';
    x.beginPath();
    x.moveTo(ex - 25, ty); x.lineTo(ex - 25, ty - 72);
    x.arc(ex, ty - 72, 25, Math.PI, 0); x.lineTo(ex + 25, ty); x.closePath();
    x.fill();
    drawRune(x, 'ᚱ', ex, ty - 58, 22, open ? PAL.glowRune : 'rgba(30,32,44,.8)', 4);
    if (open) {
      const g = x.createRadialGradient(ex, ty - 40, 10, ex, ty - 40, 80);
      g.addColorStop(0, 'rgba(255,214,130,.28)'); g.addColorStop(1, 'rgba(255,214,130,0)');
      x.fillStyle = g; x.beginPath(); x.arc(ex, ty - 40, 80, 0, 7); x.fill();
    }
  }

  function drawClimbArms(x) {                                              // 攀爬交替手
    const ph = Math.sin(player.walkT * 8) * 6;
    x.strokeStyle = PAL.ink; x.lineWidth = 4; x.lineCap = 'round';
    x.beginPath(); x.moveTo(player.x + 6, player.y - 40); x.lineTo(player.x + 16, player.y - 52 - ph); x.stroke();
    x.beginPath(); x.moveTo(player.x + 6, player.y - 36); x.lineTo(player.x + 16, player.y - 44 + ph); x.stroke();
  }

  function drawStone(x, s) {
    const bob = s.state === 'idle' ? Math.sin(view.t * 2.2 + s.phase) * 3 : 0;
    x.save();
    x.translate(s.x, s.y + bob);
    x.fillStyle = isVowel(s.ipa) ? PAL.vowel : PAL.cons;
    x.beginPath(); x.arc(0, 0, 15, 0, 7); x.fill();
    x.lineWidth = 3.5; x.strokeStyle = PAL.ink; x.stroke();
    x.fillStyle = PAL.ink; x.font = 'bold 13px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(s.ipa, 0, 1);
    x.restore();
  }

  function drawFX(x) {
    for (const p of view.puffs) {
      x.globalAlpha = p.a * 0.5;
      x.fillStyle = '#cfc9ba';
      x.beginPath(); x.arc(p.x, p.y - 6, p.r, 0, 7); x.fill();
    }
    x.globalAlpha = 1;
  }

  function drawEHint(x) {
    if (!eTarget || !started) return;
    const t = eTarget, pulse = Math.sin(view.t * 3.2) * 0.5 + 0.5;
    x.save();
    x.translate(t.x, t.y + 6);
    x.scale(1, 0.38);
    const rr = 30 + pulse * 8;
    const gg = x.createRadialGradient(0, 0, rr * 0.25, 0, 0, rr);
    gg.addColorStop(0, 'rgba(84,224,200,.32)'); gg.addColorStop(1, 'rgba(84,224,200,0)');
    x.fillStyle = gg;
    x.beginPath(); x.arc(0, 0, rr, 0, 7); x.fill();
    x.restore();
    const kx = t.x + 28, ky = t.y - 58 + Math.sin(view.t * 2.6) * 2.5;
    x.save();
    x.translate(kx, ky); x.rotate(0.1);
    x.fillStyle = 'rgba(24,27,36,.92)';
    x.beginPath();
    if (x.roundRect) x.roundRect(-11, -11, 22, 22, 6); else x.rect(-11, -11, 22, 22);
    x.fill();
    x.lineWidth = 1.5; x.strokeStyle = PAL.glowRune; x.stroke();
    x.fillStyle = '#F5F5F7'; x.font = 'bold 12px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText('E', 0, 0.5);
    x.restore();
  }

  function vignette(x) {
    const v = x.createRadialGradient(640, 380, 340, 640, 380, 760);
    v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.5)');
    x.fillStyle = v; x.fillRect(0, 0, G.W, G.H);
  }

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const cl = v => Math.max(0, Math.min(255, Math.round(v)));
    return `rgb(${cl(((n >> 16) & 255) * (1 + f))},${cl(((n >> 8) & 255) * (1 + f))},${cl((n & 255) * (1 + f))})`;
  }

  function begin() {
    started = true;
    ui.updateHand(null);
    run(startGame(game));
  }
  addEventListener('game:start', begin);
  window.G = { game, jump(b) { started = true; run(ropeDebug(game, b)); hb.refresh(game.inv); } };
  const params = new URLSearchParams(location.search);
  el('title').querySelector('h1').textContent = content.meta.title;
  el('title').querySelector('.sub').textContent = content.meta.titleEn;
  if (params.get('autostart') === '1') {
    el('title').classList.add('hidden');
    dispatchEvent(new CustomEvent('game:start'));
  } else {
    el('title').classList.remove('hidden');
    el('btn-start').addEventListener('click', () => {
      el('title').classList.add('hidden');
      const pro = el('prologue');
      pro.querySelector('p:nth-child(1)').textContent = content.meta.intro[0];
      pro.querySelector('p:nth-child(2)').textContent = content.meta.intro[1];
      pro.querySelector('p:nth-child(3)').textContent = content.meta.intro[2];
      pro.classList.remove('hidden');
      pro.addEventListener('click', () => { pro.classList.add('hidden'); dispatchEvent(new CustomEvent('game:start')); }, { once: true });
    }, { once: true });
  }
}

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', boot);
