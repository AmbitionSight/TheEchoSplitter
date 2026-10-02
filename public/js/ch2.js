// —— 回响之石 · 第二间房：jump（dʒ·ʌ·m·p；p 为第一关旧识）——
// 横版走廊：地板裂缝阻路 → 空格尝试失败（耸肩+红叉气泡）→ 掉 dʒ ʌ m →
// E 搬运合成 jump → 对自己使用解锁跳跃 → 助跑跳过裂缝 → 出口门。
import { createInventory, addStone, canConsume, consume, craftMatch,
         createHotbar, isVowel } from './hotbar.js';

const cap = w => w[0].toUpperCase() + w.slice(1) + '.';

// ================= 纯事件机（Node 可测） =================
export function createGame(content, profile) {
  return {
    content, beat: 'start',
    inv: createInventory(),
    book: new Set(), stonesPicked: 0,
    hand: null,
    attempted: false,
    jumpUnlocked: profile.abilities.includes('jump'),
    crossed: false, exited: false, fell: false,
    teaseClock: 0
  };
}

export function startGame(g) {
  return [
    { t: 'hint', key: 'start' },
    { t: 'beat', beat: 'start' }
  ];
}

export function gameEvent(g, ev, arg = null) {
  const c = g.content;
  switch (ev) {
    case 'CHASM': {                       // 未解锁时在裂缝边按空格：耸肩 + 红叉气泡 + 掉新音素
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
    case 'USE': {                          // jump 对自己使用 → 解锁跳跃
      const { word, target } = arg;
      const def = c.words[word]?.use;
      if (!def || target !== def.target) return [{ t: 'mutter' }];
      if (g.jumpUnlocked) return [{ t: 'speak', who: 'child', text: cap(word) }, { t: 'effect', name: 'jumpUnlock', full: false }];
      g.jumpUnlocked = true;
      return [{ t: 'speak', who: 'child', text: cap(word) }, { t: 'effect', name: 'jumpUnlock', full: true }];
    }
    case 'CROSS':                          // 落到对岸
      if (g.crossed) return [];
      g.crossed = true;
      return [{ t: 'hint', key: 'exit' }, { t: 'beat', beat: 'crossed' }];
    case 'FELL':                           // 掉进裂缝（软重生，无惩罚）
      return [{ t: 'fell' }, { t: 'meow' }, { t: 'hint', key: 'fell' }];
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
      if (!g.book.has('jump')) return [{ t: 'hint', key: 'carrying' }];
      if (!g.jumpUnlocked) return [{ t: 'hint', key: 'give' }];
      if (!g.crossed) return [{ t: 'hint', key: 'unlocked' }];
      return [{ t: 'hint', key: 'exit' }];
    }
    default:
      return [];
  }
}

// —— 调试跳拍 ——
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
    default: return [];
  }
}

// ================= 浏览器 kit（横版走廊 + 跳跃物理） =================
import { iconURL, PAL, drawRune } from './art.js';
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
  fetch('/api/chapter2').then(r => r.json()).catch(() => null).then(content => start(content));
}

function start(content) {
  const el = id => document.getElementById(id);
  const cv = el('game'), ctx = cv.getContext('2d');
  const geo = content.geometry;
  const profile = loadProfile(localStorage);
  const seeded = seedMemory(createInventory(), addStone, profile.everPicked);   // 播种用（真实播种在 game.inv）

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
  seedMemory(game.inv, addStone, profile.everPicked);                          // 旧识凝石入袋
  if (seeded.length) setTimeout(() => run([{ t: 'memoryStones', ipas: seeded }]), 900);

  const actors = createActors();
  actors.player.x = geo.spawnX; actors.player.y = geo.groundY;
  actors.cat.x = geo.spawnX - 70; actors.cat.y = geo.groundY + 12;
  const player = actors.player;
  player.vy = 0; player.airborne = false; player.pose = 'walk'; player.squash = 0;

  const stones = [];
  const view = { t: 0, crossed: false, stars: [], puffs: [], mist: [] };
  let bubbleT = 0, eTarget = null, started = false, exitOpen = false;
  for (let i = 0; i < 14; i++) view.mist.push({ x: geo.chasmL + Math.random() * (geo.chasmR - geo.chasmL), ph: Math.random() * 6.28, v: 6 + Math.random() * 10 });

  const ui = createUI({ content });
  const hb = createHotbar({
    words: content.words,
    crafting: content.crafting || { progressiveGlow: true },
    onSpeakCarrier: ipa => { sfx.click(); speak(content.carriers[ipa], 'child'); },
    onCraft: word => run(gameEvent(game, 'CRAFT', word)),
    onTakeItem: word => run(gameEvent(game, 'HOLD_ITEM', word)),
    onDropItem: (word, cx, cy) => { /* 横版：词具只对自己/门用，走 E */ }
  });
  hb.show(); hb.refresh(game.inv);

  function spawnDrop(word) {
    const f = content.flows[word];
    content.words[word].phonemes.forEach(([ipa], i) => {
      const s = { ipa, x: f.drop[0] + i * 46, y: f.drop[1] - 180, vx: (Math.random() - 0.5) * 40, vy: -120,
                  state: 'fly', t: 0, phase: Math.random() * 6.28 };
      stones.push(s);
    });
  }
  function stepStone(s, dt) {
    s.vy += 1300 * dt; s.x += s.vx * dt; s.y += s.vy * dt;
    if (s.y >= geo.groundY - 14 && s.vy > 0) {
      if (s.x > geo.chasmL && s.x < geo.chasmR) { s.x = geo.chasmL - 30 - Math.random() * 30; }   // 不许掉坑
      s.y = geo.groundY - 14; s.vy = 0; s.vx = 0; s.state = 'idle';
    }
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
        case 'shrug': player.squash = 0.9; break;
        case 'bubble': bubbleT = 2.6; break;
        case 'memoryStones': sfx.chime(); hb.refresh(game.inv); break;
        case 'fell': {
          sfx.mutter();
          view.puffs.push({ x: player.x, y: geo.groundY, r: 8, a: 1 });
          player.x = geo.chasmL - 90; player.y = geo.groundY - 160; player.vy = 0; player.airborne = false;
          break;
        }
        case 'effect': applyEffect(ins.name, ins.full); break;
        case 'summary': finish(); break;
      }
    }
  }

  function applyEffect(name, full) {
    if (name === 'jumpUnlock') {
      if (full) {
        player.vy = -740; player.airborne = true;                          // 示范跳
        for (let i = 0; i < 10; i++) view.stars.push({ x: player.x + (Math.random() - 0.5) * 60, y: player.y - 60 - Math.random() * 60, a: 1, r: 3 + Math.random() * 3 });
        ui.setHint('unlocked');
      } else sfx.glowTick();
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
      abilities: ['jump'], chapter: 2
    });
    saveProfile(localStorage, p);
    ui.summary(game);                                                   // 结算只算本关：1 词 · 3 石
    const walk = document.getElementById('btn-walk');
    walk.textContent = '下一间房 →';
    walk.onclick = () => { location.href = 'chapter3.html'; };
  }

  // —— 输入 ——
  const keys = new Set();
  const KM = { ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
  addEventListener('keydown', e => {
    if (KM[e.code]) { keys.add(KM[e.code]); return; }
    if (e.code === 'Space') {
      e.preventDefault();
      if (!started) return;
      if (game.jumpUnlocked && !player.airborne) {
        player.vy = -740; player.airborne = true; sfx.click();
      } else if (!game.jumpUnlocked && !player.airborne && Math.abs(player.x - geo.chasmL) < 150) {
        run(gameEvent(game, 'CHASM'));
      }
    }
    if (e.code === 'KeyE' && started && eTarget) doE();
  });
  addEventListener('keyup', e => { if (KM[e.code]) keys.delete(KM[e.code]); });
  addEventListener('blur', () => keys.clear());

  function doE() {
    sfx.click();
    if (eTarget.kind === 'stone') {
      const i = stones.indexOf(eTarget.stone);
      if (i >= 0) stones.splice(i, 1);
      run(gameEvent(game, 'PICKUP', eTarget.ipa));
    }
    else if (eTarget.id === 'bench') run(gameEvent(game, 'BANK'));
    else if (eTarget.id === 'cat') run([{ t: 'meow' }]);
    else if (eTarget.id === 'exit') run(gameEvent(game, 'EXIT'));
    else if (eTarget.id === 'self' && game.hand?.kind === 'item') run(gameEvent(game, 'USE', { word: game.hand.word, target: 'player' }));
    else sfx.mutter();
  }

  function findE() {
    let best = null, bd = 1e9;
    const consider = (d, t, r) => { if (d < bd && d <= r) { bd = d; best = t; } };
    for (const s of stones) if (s.state === 'idle') consider(Math.hypot(player.x - s.x, geo.groundY - s.y), { kind: 'stone', ipa: s.ipa, x: s.x, y: s.y, stone: s }, 56);
    consider(Math.abs(player.x - geo.benchX), { kind: 'obj', id: 'bench', x: geo.benchX, y: geo.groundY }, 80);
    consider(Math.abs(player.x - geo.exitX), { kind: 'obj', id: 'exit', x: geo.exitX, y: geo.groundY }, 80);
    consider(Math.abs(player.x - actors.cat.x), { kind: 'obj', id: 'cat', x: actors.cat.x, y: actors.cat.y }, 50);
    if (game.hand?.kind === 'item') consider(0, { kind: 'obj', id: 'self', x: player.x, y: player.y }, 0);
    return best;
  }

  // —— 主循环 ——
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    view.t += dt;
    bubbleT = Math.max(0, bubbleT - dt);
    player.squash = Math.max(0, player.squash - dt * 2);
    updateActors(actors, dt);

    // 横向移动
    const sp = 300 * dt;
    if (keys.has('l')) { player.x -= sp; player.facing = -1; }
    if (keys.has('r')) { player.x += sp; player.facing = 1; }
    player.moving = keys.size > 0 && !player.airborne;

    // 重力与地面
    const overGap = player.x > geo.chasmL + 6 && player.x < geo.chasmR - 6;
    if (player.airborne || overGap) {
      player.vy += 1500 * dt;
      player.y += player.vy * dt;
      player.airborne = true;
      if (player.vy > 0 && player.y >= geo.groundY && !overGap) {       // 落地
        player.y = geo.groundY; player.vy = 0; player.airborne = false;
        view.puffs.push({ x: player.x, y: geo.groundY, r: 6, a: 1 });
        if (player.x > geo.chasmR) run(gameEvent(game, 'CROSS'));
      }
      if (player.y > geo.groundY + 230) run(gameEvent(game, 'FELL'));   // 掉进深渊：软重生
    } else {
      player.y = geo.groundY;
      if (player.x > geo.chasmL && player.x < geo.chasmR) player.x = geo.chasmL - 10;
    }
    player.x = Math.max(40, Math.min(G.W - 40, player.x));

    // 猫跟随（不过坑：玩家过坑后猫在对岸出现）
    if (player.x > geo.chasmR) {
      actors.cat.x += ((geo.chasmR + 90) - actors.cat.x) * Math.min(1, dt * 2);
    } else {
      const tx = Math.max(geo.spawnX - 70, player.x - 80);
      actors.cat.x += (tx - actors.cat.x) * Math.min(1, dt * 2.5);
    }

    for (let i = stones.length - 1; i >= 0; i--) {
      const s = stones[i];
      if (s.state !== 'idle') stepStone(s, dt);
    }
    for (const m of view.mist) m.ph += dt * m.v * 0.1;
    view.stars = view.stars.filter(st => (st.a -= dt * 1.2) > 0);
    view.puffs = view.puffs.filter(p => { p.r += dt * 40; p.a -= dt * 2; return p.a > 0; });

    eTarget = started ? findE() : null;
    if (started) run(gameEvent(game, 'TICK', dt));

    draw();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // —— 绘制（横版）——
  function draw() {
    const x = ctx;
    x.clearRect(0, 0, G.W, G.H);
    drawScene(x);
    drawCat(x, actors.cat, view.t);
    x.save();                                                             // 呼吸起伏（跳起收腿）
    if (player.airborne) { x.translate(player.x, player.y); x.scale(1, 0.92); x.translate(-player.x, -player.y); }
    if (player.squash > 0) { const q = 1 - Math.sin(player.squash * Math.PI) * 0.08; x.translate(player.x, player.y); x.scale(1.06, q); x.translate(-player.x, -player.y); }
    drawPlayer(x, player, view.t);
    x.restore();
    for (const s of stones) drawStone(x, s);
    drawFX(x);
    drawEHint(x);
    vignette(x);
  }

  function drawScene(x) {
    // 背墙（暗砖 + 渐暗）
    for (let ry = 0; ry < 720; ry += 56) {
      for (let bx = ((ry / 56) % 2) * 46 - 46; bx < G.W; bx += 92) {
        x.fillStyle = shade(PAL.wallA, (Math.sin(bx * 12.9 + ry * 7.7) * 0.5) * 0.08 - 0.18);
        x.fillRect(bx + 1, ry + 1, 90, 54);
      }
    }
    // 远处出口微光（吸睛）
    const eg = x.createLinearGradient(geo.exitX - 70, 0, geo.exitX + 70, 0);
    eg.addColorStop(0, 'rgba(255,214,130,0)'); eg.addColorStop(0.5, 'rgba(255,214,130,.10)'); eg.addColorStop(1, 'rgba(255,214,130,0)');
    x.fillStyle = eg; x.fillRect(geo.exitX - 70, 200, 140, 420);
    // 地面（裂缝两侧）
    x.fillStyle = shade(PAL.floorB, -0.05);
    x.fillRect(0, geo.groundY, geo.chasmL, 120);
    x.fillRect(geo.chasmR, geo.groundY, G.W - geo.chasmR, 120);
    x.fillStyle = 'rgba(255,236,200,.07)';
    x.fillRect(0, geo.groundY, geo.chasmL, 3); x.fillRect(geo.chasmR, geo.groundY, G.W - geo.chasmR, 3);
    x.fillStyle = 'rgba(0,0,0,.3)';
    x.fillRect(0, geo.groundY + 40, geo.chasmL, 4); x.fillRect(geo.chasmR, geo.groundY + 40, G.W - geo.chasmR, 4);
    // 深渊
    const gg = x.createLinearGradient(0, geo.groundY, 0, geo.groundY + 220);
    gg.addColorStop(0, '#05060a'); gg.addColorStop(1, '#000');
    x.fillStyle = gg; x.fillRect(geo.chasmL, geo.groundY, geo.chasmR - geo.chasmL, 220);
    x.fillStyle = 'rgba(90,100,120,.14)';
    for (const m of view.mist) {
      x.beginPath(); x.ellipse(geo.chasmL + ((m.x - geo.chasmL + Math.sin(m.ph) * 20) % (geo.chasmR - geo.chasmL)), geo.groundY + 26 + Math.sin(m.ph * 1.3) * 8, 34, 10, 0, 0, 7); x.fill();
    }
    // 裂缝断口碎石
    x.fillStyle = shade(PAL.stoneD, -0.2);
    for (const [cx, cy, r] of [[geo.chasmL, geo.groundY + 8, 12], [geo.chasmR, geo.groundY + 8, 12], [geo.chasmL + 26, geo.groundY + 22, 7], [geo.chasmR - 26, geo.groundY + 20, 7]]) {
      x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
    }
    // 空格提示（未解锁时悬在裂缝上空）
    if (!game.jumpUnlocked && game.attempted === false && view.t % 2 > 0.6) { /* 首次靠近前不提示 */ }
    // 火炬（左墙）
    drawTorchSide(x, 90, 180, view.t);
    drawTorchSide(x, geo.chasmR + 120, 180, view.t);
    // 合成台（沿用样式，横版缩放）
    drawBench(x, geo.benchX, geo.groundY);
    // 出口门
    drawExit(x, geo.exitX, geo.groundY);
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
      if (game.hand?.kind === 'stone') {
        x.fillStyle = 'rgba(84,224,200,.25)';
        x.beginPath(); x.arc(sx, gy - 51, 9, 0, 7); x.fill();
      }
    }
  }

  function drawExit(x, ex, gy) {
    x.fillStyle = PAL.stone;
    x.beginPath();
    x.moveTo(ex - 44, gy); x.lineTo(ex - 44, gy - 96);
    x.arc(ex, gy - 96, 44, Math.PI, 0); x.lineTo(ex + 44, gy); x.closePath();
    x.fill(); x.lineWidth = 6; x.strokeStyle = PAL.stoneD; x.stroke();
    const lit = game.crossed;
    x.fillStyle = lit ? 'rgba(255,214,130,.85)' : 'rgba(20,24,34,.9)';
    x.beginPath();
    x.moveTo(ex - 28, gy); x.lineTo(ex - 28, gy - 88);
    x.arc(ex, gy - 88, 28, Math.PI, 0); x.lineTo(ex + 28, gy); x.closePath();
    x.fill();
    drawRune(x, 'ᚹ', ex, gy - 74, 26, lit ? PAL.glowRune : 'rgba(30,32,44,.8)', 4);
    if (lit) {
      const g = x.createRadialGradient(ex, gy - 60, 10, ex, gy - 60, 90);
      g.addColorStop(0, 'rgba(255,214,130,.25)'); g.addColorStop(1, 'rgba(255,214,130,0)');
      x.fillStyle = g; x.beginPath(); x.arc(ex, gy - 60, 90, 0, 7); x.fill();
    }
  }

  function drawStone(x, s) {
    const bob = s.state === 'idle' ? Math.sin(view.t * 2.2 + s.phase) * 3 : 0;
    x.save();
    x.translate(s.x, s.y + bob);
    x.fillStyle = isVowel(s.ipa) ? PAL.vowel : PAL.cons;
    x.beginPath(); x.arc(0, 0, 15, 0, 7); x.fill();
    x.lineWidth = 3.5; x.strokeStyle = PAL.ink; x.stroke();
    x.strokeStyle = 'rgba(255,255,255,' + (0.35 + Math.abs(Math.sin(view.t * 3 + s.phase)) * 0.4) + ')';
    x.beginPath(); x.arc(0, 0, 18, 0, 7); x.stroke();
    x.fillStyle = PAL.ink; x.font = 'bold 13px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(s.ipa, 0, 1);
    x.restore();
  }

  function drawFX(x) {
    for (const st of view.stars) {
      x.globalAlpha = st.a;
      x.fillStyle = PAL.gold;
      x.beginPath(); x.arc(st.x, st.y - (1 - st.a) * 30, st.r, 0, 7); x.fill();
    }
    for (const p of view.puffs) {
      x.globalAlpha = p.a * 0.5;
      x.fillStyle = '#cfc9ba';
      x.beginPath(); x.arc(p.x, p.y - 6, p.r, 0, 7); x.fill();
    }
    x.globalAlpha = 1;
    // 红叉思考气泡（按空格失败时）
    if (bubbleT > 0) {
      const a = Math.min(1, bubbleT / 0.4);
      const bx = player.x + 8, by = player.y - 108;
      x.save();
      x.globalAlpha = a;
      x.fillStyle = 'rgba(247,244,234,.95)';
      x.beginPath();
      if (x.roundRect) x.roundRect(bx - 44, by - 30, 88, 52, 14); else x.rect(bx - 44, by - 30, 88, 52);
      x.fill();
      x.beginPath(); x.moveTo(bx - 6, by + 22); x.lineTo(bx + 2, by + 36); x.lineTo(bx + 10, by + 22); x.closePath(); x.fill();
      x.lineWidth = 2.5; x.strokeStyle = PAL.ink; x.strokeRect(bx - 44, by - 30, 88, 52);
      // 气泡里：跳跃小人 + 红叉
      const fx = bx - 20, fy = by + 2;
      x.strokeStyle = PAL.ink; x.lineWidth = 2.5;
      x.beginPath(); x.arc(fx, fy - 12, 4, 0, 7); x.stroke();                        // 头
      x.beginPath(); x.moveTo(fx, fy - 8); x.lineTo(fx, fy + 2); x.stroke();          // 身
      x.beginPath(); x.moveTo(fx, fy - 4); x.lineTo(fx - 6, fy - 12); x.stroke();     // 上扬臂
      x.beginPath(); x.moveTo(fx, fy - 4); x.lineTo(fx + 6, fy - 12); x.stroke();
      x.beginPath(); x.moveTo(fx, fy + 2); x.lineTo(fx - 5, fy + 10); x.stroke();     // 蜷腿
      x.beginPath(); x.moveTo(fx, fy + 2); x.lineTo(fx + 5, fy + 10); x.stroke();
      x.strokeStyle = '#e5484d'; x.lineWidth = 5; x.lineCap = 'round';                // 红叉
      x.beginPath(); x.moveTo(bx + 8, by - 14); x.lineTo(bx + 34, by + 12); x.stroke();
      x.beginPath(); x.moveTo(bx + 34, by - 14); x.lineTo(bx + 8, by + 12); x.stroke();
      x.restore();
    }
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

  // —— 开始 ——
  function begin() {
    started = true;
    ui.updateHand(null);
    run(startGame(game));
  }
  addEventListener('game:start', begin);
  window.G = { game, jump(b) { started = true; run(jumpDebug(game, b)); hb.refresh(game.inv); } };
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
