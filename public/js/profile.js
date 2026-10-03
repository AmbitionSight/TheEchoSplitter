// —— 声档：跨关携带「已学会的音素 / 已拼出的词 / 已解锁的能力」（localStorage）——
// 纯逻辑层：读写经参数注入，浏览器与 Node 测试皆可用。

const KEY = 'echo-splitter-profile';
const LEGACY_KEY = 'echo-stone-profile';   // 旧名时期的存档键：读到即沿用，下次保存写入新键

export function createProfile() {
  return { everPicked: [], heard: [], words: [], abilities: [], chaptersDone: [], picks: 0 };
}

export function loadProfile(store) {
  // store: 浏览器传 localStorage；Node 测试传 { getItem } 或 null
  try {
    const raw = store?.getItem?.(KEY) ?? store?.getItem?.(LEGACY_KEY);
    if (!raw) return createProfile();
    const p = JSON.parse(raw);
    return {
      everPicked: [...new Set(p.everPicked || [])],
      heard: [...new Set(p.heard || [])],
      words: [...new Set(p.words || [])],
      abilities: [...new Set(p.abilities || [])],
      chaptersDone: [...new Set(p.chaptersDone || [])],
      picks: p.picks || 0                                  // 旧档无 picks 字段 → 0（向后兼容）
    };
  } catch { return createProfile(); }
}

export function saveProfile(store, profile) {
  try { store?.setItem?.(KEY, JSON.stringify(profile)); } catch { /* 隐私模式等：静默 */ }
}

// 关卡结算时合并进度（并集，永不丢失）。heard=回声物件听过的音（声音层），与 everPicked（拼词层）分开，互不污染播种。
// picks=声音石拾取数，跨关累加（缺省 0，旧载荷/旧存档向后兼容）
export function mergeProfile(oldP, { everPicked = [], heard = [], words = [], abilities = [], chapter = null, picks = 0 }) {
  const p = {
    everPicked: [...new Set([...oldP.everPicked, ...everPicked])],
    heard: [...new Set([...oldP.heard, ...heard])],
    words: [...new Set([...oldP.words, ...words])],
    abilities: [...new Set([...oldP.abilities, ...abilities])],
    chaptersDone: [...new Set([...oldP.chaptersDone, ...(chapter ? [chapter] : [])])],
    picks: (oldP.picks || 0) + (picks || 0)                // 累加：2a+2b 两半合计（规格 §12）
  };
  return p;
}

// 开局播种：已学会的音素各凝出一颗「记忆石」进入物品栏（新音素仍须实地捡拾）
export function seedMemory(inv, addStone, profileEverPicked) {
  const seeded = [];
  for (const ipa of profileEverPicked) {
    if ((inv.stones.get(ipa) || 0) === 0) { addStone(inv, ipa); seeded.push(ipa); }
  }
  return seeded;
}

// 只携带本章词真正需要的旧音素（背包不塞无关石头；其余声音仍在书档里）
export function neededSeeds(content, everPicked) {
  const needed = new Set();
  for (const def of Object.values(content.words)) {
    for (const [ipa] of def.phonemes) needed.add(ipa);
  }
  return everPicked.filter(ipa => needed.has(ipa));
}
