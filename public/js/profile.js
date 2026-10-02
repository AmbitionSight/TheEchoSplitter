// —— 声音书档：跨关携带「已学会的音素 / 已拼出的词 / 已解锁的能力」（localStorage）——
// 纯逻辑层：读写经参数注入，浏览器与 Node 测试皆可用。

const KEY = 'echo-stone-profile';

export function createProfile() {
  return { everPicked: [], words: [], abilities: [], chaptersDone: [] };
}

export function loadProfile(store) {
  // store: 浏览器传 localStorage；Node 测试传 { getItem } 或 null
  try {
    const raw = store?.getItem?.(KEY);
    if (!raw) return createProfile();
    const p = JSON.parse(raw);
    return {
      everPicked: [...new Set(p.everPicked || [])],
      words: [...new Set(p.words || [])],
      abilities: [...new Set(p.abilities || [])],
      chaptersDone: [...new Set(p.chaptersDone || [])]
    };
  } catch { return createProfile(); }
}

export function saveProfile(store, profile) {
  try { store?.setItem?.(KEY, JSON.stringify(profile)); } catch { /* 隐私模式等：静默 */ }
}

// 关卡结算时合并进度（并集，永不丢失）
export function mergeProfile(oldP, { everPicked = [], words = [], abilities = [], chapter = null }) {
  const p = {
    everPicked: [...new Set([...oldP.everPicked, ...everPicked])],
    words: [...new Set([...oldP.words, ...words])],
    abilities: [...new Set([...oldP.abilities, ...abilities])],
    chaptersDone: [...new Set([...oldP.chaptersDone, ...(chapter ? [chapter] : [])])]
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
