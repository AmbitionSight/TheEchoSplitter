// 规格 §12：fetch 失败时的内联兜底。test/fallback.test.js 保证它与磁盘 JSON 不漂移。
export const INLINE_CONTENT = {
  "meta": {
    "title": "回响之石", "titleEn": "THE ECHO STONE",
    "intro": ["你的语言被偷走了。", "你走进一间陌生的石室，只有一个声音在等你。", "碰一碰这里的东西——声音会掉出来。"]
  },
  "words": {
    "hello": { "icon": "hello", "phonemes": [["h",70],["ə",90],["l",80],["əʊ",200]],
                "use": { "target": "npc", "effect": "greet", "once": true } },
    "water": { "icon": "water", "phonemes": [["w",70],["ɔː",160],["t",70],["ə",90]],
                "use": { "target": "sprout", "effect": "bloom", "once": true } },
    "fire":  { "icon": "fire",  "phonemes": [["f",90],["aɪ",140],["ə",90]],
                "use": { "target": "torches", "effect": "ignite", "once": true } },
    "hat":   { "icon": "hat",   "phonemes": [["h",70],["æ",160],["t",80]],
                "use": { "target": "player", "effect": "wear", "once": true } },
    "light": { "icon": "light", "phonemes": [["l",70],["aɪ",140],["t",80]],
                "use": { "target": "lamp", "effect": "illuminate", "once": true } },
    "open":  { "icon": "open",  "phonemes": [["əʊ",160],["p",80],["ə",100],["n",80]],
                "use": { "target": "door", "effect": "unlock", "once": true } }
  },
  "explorables": {
    "npc":      { "word": "hello", "lines": ["Hello! Hello!"], "linesFirst": ["Hello! Yes, you!"], "drop": [400, 500] },
    "well":     { "word": "water", "lines": ["Water! Water is cold!"], "drop": [250, 470] },
    "brazier":  { "word": "fire",  "lines": ["Fire! Fire is hot!"],    "drop": [530, 470] },
    "lamp":     { "word": "light", "lines": ["Light!"],                "drop": [620, 430] },
    "hatstand": { "word": "hat",   "lines": ["My hat! Yes — my hat!"], "drop": [980, 560], "requires": "lit" }
  },
  "carriers": {
    "h": "Huh.", "ə": "Uh.", "l": "All.", "əʊ": "Oh.", "w": "Wow.",
    "ɔː": "Aw.", "t": "T.", "f": "Ff.", "aɪ": "I.", "æ": "At.", "p": "P.", "n": "N."
  },
  "npcTease": { "water": "Water… water.", "fire": "Fire… fire!", "hat": "My hat! My hat!", "light": "Light… light!" },
  "door": {
    "word": "open", "ipa": ["əʊ","p","ə","n"],
    "listen": ["Open… open… open the door!"],
    "hint": "石门在低语——把它的声音捡起来，拼好，还给它们",
    "wrongMutter": "……嗯？", "done": "石门听懂了"
  },
  "crafting": { "slots": 4, "progressiveGlow": true },
  "phonemeBook": {
    "total": 48,
    "groups": [
      { "name": "单元音", "items": ["iː","ɪ","e","æ","ɑː","ɒ","ɔː","ʊ","uː","ʌ","ə","ɜː"] },
      { "name": "双元音", "items": ["eɪ","aɪ","ɔɪ","əʊ","aʊ","ɪə","eə","ʊə"] },
      { "name": "辅音",   "items": ["p","b","t","d","k","g","f","v","θ","ð","s","z","ʃ","ʒ","tʃ","dʒ","ts","dz","tr","dr","m","n","ŋ","h","l","r","j","w"] }
    ],
    "runes": { "iː":"ᛃ","ɪ":"ᛂ","e":"ᛖ","æ":"ᚫ","ɑː":"ᚨ","ɒ":"ᚬ","ɔː":"ᚢ","ʊ":"ᚭ","uː":"ᛇ","ʌ":"ᛜ","ə":"ᚪ","ɜː":"ᛠ",
                "eɪ":"ᛄ","aɪ":"ᛁ","ɔɪ":"ᛤ","əʊ":"ᚩ","aʊ":"ᛥ","ɪə":"ᛡ","eə":"ᛧ","ʊə":"ᛨ",
                "p":"ᛈ","b":"ᛒ","t":"ᛏ","d":"ᛞ","k":"ᚳ","g":"ᚷ","f":"ᚠ","v":"ᚡ","θ":"ᚦ","ð":"ᚧ","s":"ᛌ","z":"ᛋ","ʃ":"ᛢ","ʒ":"ᛣ","tʃ":"ᚲ","dʒ":"ᚵ","ts":"ᚶ","dz":"ᚸ","tr":"ᚺ","dr":"ᚼ","m":"ᛗ","n":"ᚾ","ŋ":"ᛝ","h":"ᚻ","l":"ᛚ","r":"ᚱ","j":"ᛅ","w":"ᚹ" }
  },
  "hints": {
    "hello": "他在跟你打招呼。走过去，点一点他。",
    "explore": "走走逛逛，把每样东西都碰一遍——声音会掉出来，走过去捡起它。",
    "firstStone": "声音石进了口袋——点右下角的符文，试着把它们拼在一起。",
    "dark": "右边黑漆漆的……灯柱上有个拉闸，咔哒咔哒响，好像缺了什么。",
    "craftHint": "三颗石头，能拼出一个会发光的词。",
    "litUp": "右边亮了！那边好像还藏着东西。",
    "doorAwake": "石门在发光……去听听它想说什么。",
    "door": "把石门掉出的声音捡起来，拼好，再拖回石门上。"
  }
};
