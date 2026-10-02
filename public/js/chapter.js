// —— 章节共用件：事件机核心段（拾取/存石/持具/合成）+ kit 公共行为（E 交互/手持同步/掉落/记忆石/石头步进）——
// 四个关卡这些段完全一致（只有「首块提示 / 合成后提示」不同）：改这一份，全关卡生效。
// 章节专属规则（USE/TICK/各关专属事件与演出）仍留在各章自己的文件里。
import { addStone, canConsume, consume, isVowel } from './hotbar.js';
import { neededSeeds, seedMemory } from './profile.js';
import { spawnSideStone, stepSideStone, planDropStones } from './sideview.js';

export const cap = w => w[0].toUpperCase() + w.slice(1) + '.';

// —— 事件机核心段（纯函数，Node 可测；各章 gameEvent 里 case 直接委托）——

// 拾取：旧石放回 → 上手 → 点读；onFirst = 第一块时的额外指令（ch1 教学拍 / ch2-4 提示）
export function pickupStone(g, ipa, { onFirst = null } = {}) {
  const out = [];
  if (g.hand?.kind === 'stone') out.push({ t: 'dropBack', ipa: g.hand.ipa });
  g.hand = { kind: 'stone', ipa };
  g.inv.everPicked.add(ipa);
  const first = ++g.stonesPicked === 1;
  out.push({ t: 'carrier', ipa }, { t: 'hand' });
  if (first && onFirst) out.push(...onFirst);
  return out;
}

// 合成台存石：手上的石进底部物品栏（世界侧的进槽显示由 workbench.bankStone 处理）
export function bankHeld(g) {
  if (g.hand?.kind !== 'stone') return [];
  const ipa = g.hand.ipa;
  g.hand = null;
  addStone(g.inv, ipa);
  return [{ t: 'bank', ipa }, { t: 'hand' }];
}

// 点物品栏词具：拿起；再点一次 = 放下（toggle）
export function holdItem(g, word, { hint = 'give' } = {}) {
  if (!g.inv.items.has(word)) return [];
  if (g.hand?.kind === 'item' && g.hand.word === word) {
    g.hand = null;
    return [{ t: 'hand' }];
  }
  g.hand = { kind: 'item', word };
  return [{ t: 'hand' }, ...(hint ? [{ t: 'hint', key: hint }] : [])];
}

// 合成：判定 → 消耗 → 入册；extra = 合成后的章节专属提示
export function craftWord(g, word, extra = []) {
  const c = g.content;
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
    ...extra
  ];
}

// —— kit 公共行为 ——

// E 交互公共段：石头=拾取，合成台=存石；其余目标交给章节自己的 rest 处理
export function chapterOnE(gameEvent, rest = null) {
  return (w, t) => {
    if (t.kind === 'stone') {
      const i = w.stones.indexOf(t.stone);
      if (i >= 0) w.stones.splice(i, 1);
      w.run(gameEvent(w.game, 'PICKUP', t.ipa));
      return;
    }
    if (t.id === 'bench') { w.run(gameEvent(w.game, 'BANK')); return; }
    rest?.(w, t);
  };
}

// 手持显示同步：玩家举石（按元/辅染色）或举词具图标
// 玩家引用两代世界的形状都兼容：横版 w.player / 第一间房 w.actors.player
export function syncHeld(w) {
  const p = w.player ?? w.actors?.player, h = w.game.hand;
  if (!h) { p.held = null; p.heldVowel = false; p.heldIcon = null; return; }
  if (h.kind === 'stone') { p.held = h.ipa; p.heldVowel = isVowel(h.ipa); p.heldIcon = null; }
  else { p.held = null; p.heldVowel = false; p.heldIcon = w.content.words[h.word].icon; }
}

// 开局记忆石：只带本章需要的旧音素（900ms 后到账响铃提醒）
export function seedBegin(w) {
  const seeds = neededSeeds(w.content, w.profile.everPicked);
  const seeded = seedMemory(w.game.inv, addStone, seeds);
  if (seeded.length) setTimeout(() => { w.sfx.chime(); w.hb.refresh(w.game.inv); }, 900);
  w.hb.refresh(w.game.inv);
}

// 掉落指令工厂：edgeXOf = 禁落区左缘（石头自边界内侧向左散开）；dropH/spread/up = 抛物线参数
export function dropExtra(edgeXOf, { dropH = 180, spread = 40, up = -120 } = {}) {
  return function drop(w, ins) {
    const f = w.content.flows[ins.word];
    for (const s of planDropStones(w.content.words[ins.word], w.game.inv, f.drop, edgeXOf(w))) {
      spawnSideStone(w.stones, s.ipa, s.x, f.drop[1] - dropH, (Math.random() - 0.5) * spread, up);
    }
  };
}

// 放回手上旧石：身后轻抛落回地面（vx 可按章微调）
export function dropBackExtra(groundYOf = w => w.geo.groundY, vx = -60) {
  return function dropBack(w, ins) {
    spawnSideStone(w.stones, ins.ipa, w.player.x - 20, groundYOf(w) - 120, vx, -100);
  };
}

// 石头步进 + 保险：keepOut(x) 返回新 x 时把石头推出禁区（裂隙/墙体内绝不留石）
export function stepWorldStones(w, dt, groundYOf, keepOut = null) {
  for (const s of w.stones) {
    if (s.state === 'idle') continue;
    stepSideStone(s, dt, groundYOf(w));
    if (s.state === 'idle' && keepOut) {
      const nx = keepOut(s.x);
      if (nx != null) s.x = nx;
    }
  }
}
