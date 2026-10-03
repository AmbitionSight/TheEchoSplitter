// —— 析声者 · 第一间房：hello 教学 + open 开关主线（E 键手持交互）——
import { createInventory } from '../hotbar.js';
import { createDoor, doorEvent } from '../door.js';
import { pickupStone, bankHeld, holdItem, craftWord, cap } from '../chapter.js';

// ================= 纯事件机（Node 可测，行为与重构前一致；公共段见 chapter.js） =================
export function createGame(content) {
  return {
    content, beat: 'hello-listen',
    book: new Set(),
    inv: createInventory(),
    stonesPicked: 0, lit: false,
    hand: null,                        // {kind:'stone',ipa} | {kind:'item',word} | null
    heard: new Set(),                  // 回声物件听过的音（声音层；与拼词层的 everPicked 分开，不污染播种）
    door: createDoor(), usedTargets: new Set(),
    helloDropped: false, helloReminded: false, switchOn: false, doorHeard: false,
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
      if (id === 'cat') {
        const out = [{ t: 'meow' }];              // 喵一声+竖耳（壳的 meow 分支；原 {t:'cat'} 是无人处理的死指令）
        if (c.ambience.cat?.echo) out.push({ t: 'echo', ipas: c.ambience.cat.echo, say: c.ambience.cat.say });   // 回声物件
        return out;
      }
      if (c.ambience[id]) {                     // 回声物件：底部亮音素 + 念整词；不掉石不进库存
        const a = c.ambience[id];
        const out = [{ t: 'sfx', name: a.sfx }];
        if (a.echo) out.push({ t: 'echo', ipas: a.echo, say: a.say });
        return out;
      }
      if (id === 'npc') {
        g.helloReminded = true;
        g.teaseClock = 0;
        if (g.hand?.kind === 'item' && g.hand.word === 'hello') {
          return gameEvent(g, 'USE', { word: 'hello', target: 'npc' });
        }
        if (!g.helloDropped) {
          g.helloDropped = true;
          return [
            { t: 'speak', who: 'uncle', text: c.flows.hello.linesFirst[0], slow: true },   // 慢速、去口语：一句干净的 Hello，声音按节奏剥落成石
            { t: 'drop', word: 'hello' },
            { t: 'hint', key: 'hand' },
            { t: 'beat', beat: 'explore' }
          ];
        }
        return [{ t: 'speak', who: 'uncle', text: c.flows.hello.lines[0] }];
      }
      if (id === 'door') {                              // 关着的门：低语自己的名字（规格 §3 拍节11 题眼·先闻后仿）
        if (g.door.state !== 'closed') return [];
        if (!g.doorHeard) {
          g.doorHeard = true;
          return [{ t: 'speak', who: 'door', text: 'Open… open… open the door!', slow: true }];
        }
        return [{ t: 'speak', who: 'door', text: c.flows.open.listen[0], slow: true }];
      }
      if (id === 'switch') {
        if (!g.switchOn) {
          g.switchOn = true; g.lit = true;
          return [
            { t: 'sfx', name: 'clack' },
            { t: 'speak', who: 'door', text: c.flows.open.listen[0], slow: true },   // 石门低缓念（规格 §3 拍节 12）
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
    case 'PICKUP':                      // E 拾地面石 → 手上（纯手持制，一次一块）；首块亮物品栏+指合成台
      return pickupStone(g, arg, { onFirst: [{ t: 'hotbarShow' }, { t: 'hint', key: 'bench' }, { t: 'beat', beat: 'first-stone' }] });
    case 'HOLD_ITEM':                   // 点物品栏词具 → 拿起 / 再点一次 → 放下
      return holdItem(g, arg, { hint: arg === 'open' ? 'openItem' : 'helloGive' });
    case 'BANK':                        // 合成台：手上的石存入底部物品栏
      return bankHeld(g);
    case 'CRAFT': {
      const extra = arg === 'hello' ? [{ t: 'hint', key: 'helloGive' }]   // 拿着气泡去见大叔
                : arg === 'open' ? [{ t: 'hint', key: 'openItem' }] : [];
      return craftWord(g, arg, extra);
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
    case 'bench': {                                // 调试：台上先摆两块（验收合成台显示）
      let out = gameEvent(g, 'INTERACT', 'npc');
      for (const ipa of ['h', 'ə']) out = out.concat(gameEvent(g, 'PICKUP', ipa), gameEvent(g, 'BANK'));
      return out;
    }
    case 'craft': {                                // 调试：按正确顺序存满四块，最后一块自动合成（验收合成动画）
      let out = gameEvent(g, 'INTERACT', 'npc');
      for (const ipa of ['h', 'ə', 'l', 'əʊ']) out = out.concat(gameEvent(g, 'PICKUP', ipa), gameEvent(g, 'BANK'));
      return out;
    }
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
