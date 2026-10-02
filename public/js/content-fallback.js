// 规格 §12：fetch 失败时的内联兜底。test/fallback.test.js 保证它与磁盘 JSON 不漂移。
export const INLINE_CONTENT = {
  meta: {
    title: "回响之石", titleEn: "THE ECHO STONE",
    intro: ["你的语言被偷走了。", "你走进一间陌生的石室，只有一个声音在等你。", "碰一碰这里的东西——声音会掉出来。"]
  },
  words: {
    hello: { icon: "hello", phonemes: [["h",70],["ə",90],["l",80],["əʊ",200]],
              use: { target: "npc", effect: "greet", once: true } },
    open:  { icon: "switch", phonemes: [["əʊ",160],["p",80],["ə",100],["n",80]],
              use: { target: "door", effect: "unlock", once: true } }
  },
  flows: {
    hello: { lines: ["Hello! Hello!"], linesFirst: ["Hello! Yes, you!"], drop: [400, 500] },
    open:  { listen: ["Open."], drop: [700, 430] }
  },
  ambience: {
    well:     { sfx: "water" },
    brazier:  { sfx: "crackle" },
    hatstand: { sfx: "hatPuff" },
    sprout:   { sfx: "glowTick" },
    cat:      { sfx: "meow" }
  },
  switch: { pos: [660, 282], litDrop: [720, 440] },
  bench:  { pos: [640, 616] },
  carriers: {
    h: "Huh.", ə: "Uh.", l: "All.", "əʊ": "Oh.", p: "P.", n: "N."
  },
  door: {
    ipa: ["əʊ","p","ə","n"],
    hint: "把开的声音捡起来，拼好，还给门",
    revealTitle: "你用声音打开了门",
    revealSub: "文字，是冻住的声音"
  },
  crafting: { slots: 4, progressiveGlow: true },
  phonemeBook: {
    total: 48,
    groups: [
      { name: "单元音", items: ["iː","ɪ","e","æ","ɑː","ɒ","ɔː","ʊ","uː","ʌ","ə","ɜː"] },
      { name: "双元音", items: ["eɪ","aɪ","ɔɪ","əʊ","aʊ","ɪə","eə","ʊə"] },
      { name: "辅音",   items: ["p","b","t","d","k","g","f","v","θ","ð","s","z","ʃ","ʒ","tʃ","dʒ","ts","dz","tr","dr","m","n","ŋ","h","l","r","j","w"] }
    ],
    runes: { "iː":"ᛃ","ɪ":"ᛂ","e":"ᛖ","æ":"ᚫ","ɑː":"ᚨ","ɒ":"ᚬ","ɔː":"ᚢ","ʊ":"ᚭ","uː":"ᛇ","ʌ":"ᛜ","ə":"ᚪ","ɜː":"ᛠ",
              "eɪ":"ᛄ","aɪ":"ᛁ","ɔɪ":"ᛤ","əʊ":"ᚩ","aʊ":"ᛥ","ɪə":"ᛡ","eə":"ᛧ","ʊə":"ᛨ",
              "p":"ᛈ","b":"ᛒ","t":"ᛏ","d":"ᛞ","k":"ᚳ","g":"ᚷ","f":"ᚠ","v":"ᚡ","θ":"ᚦ","ð":"ᚧ","s":"ᛌ","z":"ᛋ","ʃ":"ᛢ","ʒ":"ᛣ","tʃ":"ᚲ","dʒ":"ᚵ","ts":"ᚶ","dz":"ᚸ","tr":"ᚺ","dr":"ᚼ","m":"ᛗ","n":"ᚾ","ŋ":"ᛝ","h":"ᚻ","l":"ᛚ","r":"ᚱ","j":"ᛅ","w":"ᚹ" }
  },
  hints: {
    hello: "他在跟你打招呼。走过去，按 E 碰一碰他。",
    hand: "按 E 捡起一块声音石——它会开口说话。一次拿一块。",
    bench: "拿着石头走到木桌前，按 E 放下。",
    craft: "把物品栏里的声音石拖进右下角的槽——拼出一个词。",
    helloGive: "点一下物品栏里的气泡，拿在手上，去见大叔。",
    helloDone: "大叔收到你的问候了。墙上有个东西在发光……",
    switch: "那个发光的开关在等你。走过去，按 E。",
    litUp: "灯亮了，声音石掉下来了——再搬一轮。",
    openItem: "点一下物品栏里的开关图案，拿在手上，走到门前按 E。"
  }
};
