# 回响之石（The Echo Stone）第一章 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 `docs/superpowers/specs/2026-10-01-echo-stone-design.md` 从零实现可玩的网页英语解谜游戏第一章：碰物拾音素 → 工具栏合成词具 → 用词点亮黑暗、打开石门。

**Architecture:** 零依赖 Node ESM 服务器（静态托管 + /api/chapter1）+ 原生 JS/Canvas 前端。所有 `public/js/*.js` 为 ES 模块，**顶层禁止任何 DOM/window 访问**（DOM 只出现在函数体内），因此 Node 可直接 import 做单元测试（node:test 内置，零安装）。纯逻辑（事件机/合成/库存/物理/碰撞/门状态）与渲染严格分离：纯函数先 TDD，渲染任务靠浏览器目检。

**Tech Stack:** Node ≥18（http、node:test、fetch）、ES Modules（根 package.json `{"type":"module"}`，非依赖）、Canvas 2D、speechSynthesis + WebAudio、Pointer Events。

**规格对照：** 每个任务标注对应规格 §N；最终验收清单见 Task 13。

**约定（所有任务遵守）：**
- 命令在仓库根目录 bash 执行；测试命令统一 `node --test <file>`，`# pass N` 即通过。
- 每个任务结束必须 commit（信息用任务内给定的）。
- `public/js/*.js` 顶层不碰 `document/window/localStorage`；main.js 底部 `if (typeof document !== 'undefined')` 守卫启动。
- 代码内路径一律用相对/正斜杠。

---

### Task 1: 脚手架 + 零依赖服务器 + 内容 JSON（TDD）

**Files:**
- Create: `package.json`、`.gitignore`、`server.js`、`content/chapter1.json`
- Test: `test/server.test.js`、`test/content.test.js`

- [ ] **Step 1: 环境检查**

Run: `node --version`
Expected: `v18` 或更高（需要 node:test 与内置 fetch）。低于 18 先升级。

- [ ] **Step 2: 写 package.json 与 .gitignore**

`package.json`（`type: module` 只为让 Node 以 ESM 跑测试/服务器，不引入依赖，符合规格「零安装」）：
```json
{
  "name": "echo-stone",
  "private": true,
  "type": "module",
  "scripts": { "start": "node server.js", "test": "node --test" }
}
```
`.gitignore`：
```
node_modules/
*.log
```

- [ ] **Step 3: 写内容 JSON**

`content/chapter1.json`（规格 §10 原样；注意 iː 的卢文是 ᛃ、aɪ 是 ᛁ，两者不可撞字）：
```json
{
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
}
```

- [ ] **Step 4: 写失败测试（服务器）**

`test/server.test.js`：
```js
import { test } from 'node:test';
import assert from 'node:assert';
import { createServer } from '../server.js';

async function listen() {
  const server = createServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { server, base };
}

test('GET /api/chapter1 返回 JSON 且六词齐全', async () => {
  const { server, base } = await listen();
  const res = await fetch(base + '/api/chapter1');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /application\/json/);
  const data = await res.json();
  assert.deepEqual(Object.keys(data.words).sort(),
    ['fire','hat','hello','light','open','water']);
  server.close();
});

test('GET / 返回 index.html（后续任务创建后才会通过）', async () => {
  const { server, base } = await listen();
  const res = await fetch(base + '/');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  const body = await res.text();
  assert.ok(body.includes('回响之石'));
  server.close();
});

test('静态 js 文件返回正确 MIME，越权路径 403/404', async () => {
  const { server, base } = await listen();
  const res = await fetch(base + '/js/main.js'); // Task 2 创建
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/javascript/);
  const bad = await fetch(base + '/../server.js');
  assert.ok([403, 404].includes(bad.status));
  const missing = await fetch(base + '/nope.xyz');
  assert.equal(missing.status, 404);
  server.close();
});
```

- [ ] **Step 5: 写失败测试（内容不变量，规格 §12/§13 的数据面验收）**

`test/content.test.js`：
```js
import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';

const data = JSON.parse(await readFile(new URL('../content/chapter1.json', import.meta.url), 'utf8'));

test('48 音标：groups 展开共 48 项、无重复，runes 全覆盖且字形唯一', () => {
  const items = data.phonemeBook.groups.flatMap(g => g.items);
  assert.equal(items.length, 48);
  assert.equal(new Set(items).size, 48);
  assert.equal(data.phonemeBook.total, 48);
  for (const ipa of items) assert.ok(data.phonemeBook.runes[ipa], `缺卢文: ${ipa}`);
  const glyphs = items.map(i => data.phonemeBook.runes[i]);
  assert.equal(new Set(glyphs).size, 48, '卢文字形必须互不相同');
});

test('每个词的音素都有载词与卢文', () => {
  for (const [w, def] of Object.entries(data.words)) {
    for (const [ipa] of def.phonemes) {
      assert.ok(data.carriers[ipa], `${w}.${ipa} 缺载词`);
      assert.ok(data.phonemeBook.runes[ipa], `${w}.${ipa} 缺卢文`);
    }
  }
});

test('自给自足：每个探索物的掉落词存在于 words（含 npc=hello）', () => {
  for (const [id, ex] of Object.entries(data.explorables)) {
    assert.ok(data.words[ex.word], `${id} 指向不存在的词 ${ex.word}`);
    assert.ok(Array.isArray(ex.drop) && ex.drop.length === 2);
  }
  assert.equal(data.explorables.npc.word, 'hello');
  assert.equal(data.explorables.hatstand.requires, 'lit');
});

test('content 中不含 emoji（铁律）', () => {
  const raw = JSON.stringify(data);
  assert.ok(!/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u.test(raw), '发现 emoji');
});
```

- [ ] **Step 6: 跑测试确认失败**

Run: `node --test test/server.test.js test/content.test.js`
Expected: server 全 FAIL（`Cannot find module '../server.js'`）；content 全 PASS（数据先行，本任务 Step 3 已写全）。

- [ ] **Step 7: 实现 server.js（直接运行才监听，导入可测）**

```js
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const MIME = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml'
};

export function createServer() {
  return http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (url.pathname === '/api/chapter1') {
        const body = await readFile(join(ROOT, 'content', 'chapter1.json'));
        res.writeHead(200, { 'Content-Type': MIME['.json'], 'Cache-Control': 'no-store' });
        return res.end(body);
      }
      let path = decodeURIComponent(url.pathname);
      if (path === '/') path = '/index.html';
      const file = normalize(join(ROOT, 'public', path));
      if (!file.startsWith(normalize(join(ROOT, 'public')))) { res.writeHead(403); return res.end('Forbidden'); }
      const body = await readFile(file);
      res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
      res.end(body);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
    }
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const PORT = Number(process.env.PORT || 3000);
  createServer().listen(PORT, () => console.log(`回响之石 http://localhost:${PORT}`));
}
```

- [ ] **Step 8: 跑测试**

Run: `node --test test/server.test.js test/content.test.js`
Expected: content 4 pass；server 1 pass（/api/chapter1）、2 FAIL（index.html 与 js 尚未创建——Task 2 补齐后转绿）。此处允许这两条失败继续提交。

- [ ] **Step 9: Commit**

```bash
git add package.json .gitignore server.js content test
git commit -m "feat: 零依赖服务器与 chapter1 内容（含内容不变量测试）"
```

---

### Task 2: 页面骨架 + 内容兜底 + 启动壳

**Files:**
- Create: `public/index.html`、`public/css/style.css`、`public/js/content-fallback.js`、`public/js/main.js`
- Test: `test/fallback.test.js`
- 说明：`content-fallback.js` 是规格 §11.2 文件清单之外新增的一个纯数据模块（规格 §12 要求的内联兜底副本独立成文件，避免 main.js 臃肿、测试无依赖链）。

- [ ] **Step 1: 写 index.html**

`public/index.html`：
```html
<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>回响之石 · The Echo Stone</title>
<link rel="stylesheet" href="css/style.css">
</head>
<body>
<div id="stage">
  <canvas id="game" width="1280" height="720"></canvas>

  <div id="title" class="screen center glass hidden">
    <div class="rune-float" aria-hidden="true">ᚫ</div>
    <h1>回响之石</h1>
    <p class="sub">THE ECHO STONE</p>
    <button id="btn-start" class="btn primary">开 始</button>
  </div>

  <div id="prologue" class="screen center glass hidden">
    <p>你的语言被偷走了。</p>
    <p>你走进一间陌生的石室，只有一个声音在等你。</p>
    <p>碰一碰这里的东西——声音会掉出来。</p>
    <p class="tap">点击继续</p>
  </div>

  <div id="hintbar" class="glass hidden"><span id="hint-text"></span></div>

  <div id="bag" class="glass hidden"><span id="bag-icon"></span><b id="bag-count">0</b></div>

  <div id="hotbar" class="glass hidden">
    <div id="craft-row" class="hidden">
      <div class="slot" data-slot="0"></div>
      <div class="slot" data-slot="1"></div>
      <div class="slot" data-slot="2"></div>
      <div class="slot" data-slot="3"></div>
    </div>
    <div id="bar-row">
      <div id="stone-cells"></div>
      <span class="bar-sep"></span>
      <div id="item-cells"></div>
      <button id="craft-toggle" class="rune-btn" title="合成">ᚱ</button>
    </div>
  </div>

  <div id="journal" class="screen hidden">
    <div class="journal-head glass">
      <div class="seg">
        <button class="seg-btn active" data-tab="words">词语</button>
        <button class="seg-btn" data-tab="runes">声音符文 <i id="rune-count">0/48</i></button>
      </div>
      <button id="journal-close" class="btn ghost small">合上（B / Esc）</button>
    </div>
    <div id="journal-words" class="journal-body"></div>
    <div id="journal-runes" class="journal-body hidden"></div>
  </div>

  <div id="reveal" class="screen center glass hidden">
    <div id="reveal-stones"></div>
    <div id="reveal-word">OPEN</div>
    <h2>你用声音打开了门</h2>
    <p class="sub">文字，是冻住的声音</p>
    <button id="reveal-ok" class="btn primary">……</button>
  </div>

  <div id="summary" class="screen center glass hidden">
    <p class="day">第一天</p>
    <h2 id="summary-line"></h2>
    <div id="summary-icons"></div>
    <p class="next">门后传来更多声音……（第二章 · 未完待续）</p>
    <div class="row">
      <button id="btn-walk" class="btn ghost">继续走走</button>
      <button id="btn-notes" class="btn ghost">设计说明</button>
      <button id="btn-again" class="btn primary">再来一次</button>
    </div>
  </div>

  <div id="notes" class="screen center glass hidden">
    <h2>设计说明</h2>
    <div class="notes-body">
      <p>这个游戏不教英语，也不翻译。</p>
      <p>每个英语词只以「声音 + 情境」出现：碰一碰物件，它的音素会结晶成石头掉出来；把石头捡进口袋、在工具栏里拼回成一个词，这个词就变成一件道具——light 真的带来光，water 真的浇活枯苗，open 真的打开石门。词义由世界的反应定义，不由中文解释。</p>
      <p>音素从不被「教」，只被你发现：元音石是黄色的，辅音石是蓝色的，48 个声音各有一枚卢文符文，捡到就点亮。你在无意中读完了整张英语音系表。</p>
      <p>第一章只有六个词。门后还有很多房间。</p>
    </div>
    <button id="notes-close" class="btn primary">回到石室</button>
  </div>

  <div id="toast" class="glass hidden"></div>
</div>
<script type="module" src="js/main.js"></script>
<div id="drag-ghost" class="hidden"></div>
</body>
</html>
```

- [ ] **Step 2: 写内容兜底模块**

`public/js/content-fallback.js`：导出 `INLINE_CONTENT`，值与 Task 1 的 `content/chapter1.json` **完全一致**（整份 JSON 原样复制为对象字面量——meta/words/explorables/carriers/npcTease/door/crafting/phonemeBook/hints 全部字段逐字相同）。写成：
```js
// 规格 §12：fetch 失败时的内联兜底。test/fallback.test.js 保证它与磁盘 JSON 不漂移。
export const INLINE_CONTENT = { /* ← 此处粘贴 content/chapter1.json 的完整对象内容，逐字段一致 → */ };
```
（执行者注意：不是留注释交差——把 Task 1 Step 3 的 JSON 对象一字不差地放进 `{}` 内。）

- [ ] **Step 3: 写失败测试（兜底不漂移）**

`test/fallback.test.js`：
```js
import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { INLINE_CONTENT } from '../public/js/content-fallback.js';

test('内联兜底与磁盘 content/chapter1.json 完全一致', async () => {
  const disk = JSON.parse(await readFile(new URL('../content/chapter1.json', import.meta.url), 'utf8'));
  assert.deepEqual(INLINE_CONTENT, disk);
});
```

- [ ] **Step 4: 跑测试**

Run: `node --test test/fallback.test.js`
Expected: FAIL（模块不存在）→ 完成 Step 2 后重跑 PASS。

- [ ] **Step 5: 写 style.css（苹果玻璃设计系统 + MC 工具栏，规格 §9B）**

`public/css/style.css`：
```css
:root{
  --blue:#0A84FF; --text:#F5F5F7; --dim:#A1A1A6;
  --glass:rgba(28,28,32,.72); --stroke:rgba(255,255,255,.14);
  --teal:#54e0c8; --gold:#ffd166; --vowel:#ffd166; --cons:#6fb7ff;
  --font:-apple-system,"SF Pro Display",system-ui,"Segoe UI Variable","Segoe UI","PingFang SC","Microsoft YaHei UI";
}
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent}
html,body{height:100%;background:#07080b;font-family:var(--font);color:var(--text);overflow:hidden;user-select:none}
#stage{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%)}
#game{width:100%;height:100%;display:block;border-radius:6px}
.hidden{display:none!important}

.glass{background:var(--glass);backdrop-filter:blur(28px) saturate(160%);-webkit-backdrop-filter:blur(28px) saturate(160%);
  border:1px solid var(--stroke);border-radius:28px;box-shadow:0 24px 68px rgba(0,0,0,.55)}
.screen{position:absolute;inset:0;z-index:40;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;background:rgba(10,11,15,.55)}
.screen.glass{margin:6% 12%}
.center{text-align:center}
h1{font-size:56px;font-weight:700;letter-spacing:.12em}
h2{font-size:34px;font-weight:700}
.sub{color:var(--dim);letter-spacing:.42em;font-size:14px}
.rune-float{font-size:96px;color:var(--teal);text-shadow:0 0 34px var(--teal);animation:floatRune 3.4s ease-in-out infinite}
@keyframes floatRune{0%,100%{transform:translateY(-8px) rotate(-3deg)}50%{transform:translateY(10px) rotate(3deg)}}
#prologue p{font-size:22px;line-height:2.1;letter-spacing:.08em}
#prologue .tap{color:var(--dim);font-size:14px;margin-top:26px;animation:breath 2s ease-in-out infinite}
@keyframes breath{0%,100%{opacity:.45}50%{opacity:1}}

.btn{border:none;cursor:pointer;font-family:var(--font);font-size:17px;color:var(--text);padding:14px 34px;border-radius:999px;
  background:rgba(255,255,255,.10);border:1px solid var(--stroke);transition:transform .12s ease,background .2s}
.btn:hover{background:rgba(255,255,255,.16)}
.btn:active{transform:scale(.94)}
.btn.primary{background:var(--blue);border-color:transparent;box-shadow:0 10px 30px rgba(10,132,255,.45)}
.btn.primary:hover{background:#2f96ff}
.btn.small{padding:9px 18px;font-size:14px}
.row{display:flex;gap:14px;flex-wrap:wrap;justify-content:center}
.day{color:var(--dim);letter-spacing:.5em}
#summary-icons{display:flex;gap:16px;margin:10px 0}
#summary-icons img{width:64px;height:64px;border-radius:16px;background:rgba(255,255,255,.08);padding:8px;animation:popIn .5s ease backwards}
#summary-icons img:nth-child(2){animation-delay:.08s}#summary-icons img:nth-child(3){animation-delay:.16s}
#summary-icons img:nth-child(4){animation-delay:.24s}#summary-icons img:nth-child(5){animation-delay:.32s}#summary-icons img:nth-child(6){animation-delay:.4s}
@keyframes popIn{from{transform:scale(.3);opacity:0}to{transform:scale(1);opacity:1}}
.next{color:var(--dim);font-size:15px}
.notes-body{max-width:620px;text-align:left;line-height:2;font-size:16px;color:var(--text)}
.notes-body p{margin-bottom:12px}

#hintbar{position:absolute;left:50%;bottom:96px;transform:translateX(-50%);z-index:30;padding:12px 26px;border-radius:999px;
  font-size:15px;color:var(--text);max-width:70%;text-align:center;animation:slideUp .45s ease}
#toast{position:absolute;left:50%;top:26px;transform:translateX(-50%);z-index:60;padding:12px 24px;border-radius:18px;font-size:15px;animation:slideDown .35s ease}
@keyframes slideUp{from{transform:translate(-50%,24px);opacity:0}to{transform:translate(-50%,0);opacity:1}}
@keyframes slideDown{from{transform:translate(-50%,-30px);opacity:0}to{transform:translate(-50%,0);opacity:1}}

#bag{position:absolute;right:22px;bottom:22px;z-index:30;display:flex;align-items:center;gap:8px;padding:10px 18px;border-radius:999px;font-size:18px}
#bag.pulse{animation:bagPulse .45s ease}
@keyframes bagPulse{40%{transform:scale(1.18)}}

#hotbar{position:absolute;left:50%;bottom:18px;transform:translateX(-50%);z-index:30;display:flex;flex-direction:column;align-items:center;gap:10px;padding:12px;border-radius:24px;animation:slideUp .5s ease}
#bar-row{display:flex;align-items:center;gap:8px}
#stone-cells,#item-cells{display:flex;gap:8px}
.bar-sep{width:1px;height:40px;background:var(--stroke)}
.cell{position:relative;width:54px;height:54px;border-radius:14px;background:rgba(255,255,255,.07);border:1px solid var(--stroke);
  display:flex;align-items:center;justify-content:center;cursor:grab;transition:transform .12s}
.cell:hover{transform:translateY(-3px)}
.cell .glyph{font-size:22px;font-weight:700}
.cell.stone-v .glyph{color:var(--vowel)}.cell.stone-c .glyph{color:var(--cons)}
.cell img{width:40px;height:40px;pointer-events:none}
.cell .count{position:absolute;right:4px;bottom:2px;font-size:12px;color:var(--dim)}
.cell.empty{opacity:.35;cursor:default}
.rune-btn{width:54px;height:54px;border-radius:50%;border:1px solid var(--stroke);background:rgba(255,255,255,.08);color:var(--teal);font-size:24px;cursor:pointer;transition:transform .12s}
.rune-btn:active{transform:scale(.92)}
.rune-btn.armed{box-shadow:0 0 18px var(--teal);border-color:var(--teal)}
#craft-row{display:flex;gap:10px;padding:10px 14px;border-radius:18px;background:rgba(255,255,255,.05);border:1px solid var(--stroke)}
.slot{width:58px;height:58px;border-radius:14px;border:2px dashed rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:var(--text)}
.slot.filled{border-style:solid;border-color:var(--stroke);background:rgba(255,255,255,.08)}
.slot.g1{box-shadow:0 0 10px rgba(84,224,200,.35);border-color:rgba(84,224,200,.55)}
.slot.g2{box-shadow:0 0 18px rgba(84,224,200,.6);border-color:var(--teal)}
.slot.g3{box-shadow:0 0 26px var(--teal);border-color:var(--teal)}
#drag-ghost{position:fixed;z-index:99;pointer-events:none;width:54px;height:54px;display:flex;align-items:center;justify-content:center;
  font-size:22px;font-weight:700;color:var(--text);background:var(--glass);border:1px solid var(--stroke);border-radius:14px;transform:translate(-50%,-50%) scale(1.15)}

#journal{z-index:50;background:rgba(8,9,13,.78)}
.journal-head{position:absolute;top:20px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:18px;padding:10px 16px;border-radius:22px}
.seg{display:flex;background:rgba(255,255,255,.08);border-radius:12px;padding:3px}
.seg-btn{border:none;background:transparent;color:var(--dim);font-family:var(--font);font-size:15px;padding:8px 18px;border-radius:10px;cursor:pointer}
.seg-btn.active{background:var(--blue);color:#fff}
.seg-btn i{font-style:normal;opacity:.75;font-size:13px;margin-left:4px}
.journal-body{position:absolute;top:96px;bottom:26px;left:50%;transform:translateX(-50%);width:min(1080px,92%);
  display:grid;gap:16px;overflow-y:auto;padding:6px 10px;align-content:start}
.journal-body::-webkit-scrollbar{width:0}
.word-card{display:flex;align-items:center;gap:22px;padding:18px 24px;border-radius:24px;background:var(--glass);
  border:1px solid var(--stroke);animation:popIn .4s ease backwards}
.word-card img{width:72px;height:72px}
.word-card .wc-mid{flex:1}
.word-card canvas{width:100%;height:56px;display:block}
.ipa{color:var(--dim);font-size:18px;letter-spacing:.14em;margin-top:6px}
.ipa b{color:var(--gold)}
.rune-grid{display:grid;grid-template-columns:repeat(8,1fr);gap:12px}
.rune-card{display:flex;flex-direction:column;align-items:center;gap:6px;padding:14px 6px;border-radius:18px;
  background:rgba(255,255,255,.05);border:1px solid var(--stroke);cursor:pointer}
.rune-card .rune{font-size:34px;line-height:1;color:rgba(255,255,255,.16)}
.rune-card .ipa{font-size:13px;margin:0}
.rune-card.lit .rune{color:var(--teal);text-shadow:0 0 14px var(--teal);animation:runeBreath 2.6s ease-in-out infinite}
@keyframes runeBreath{0%,100%{text-shadow:0 0 8px rgba(84,224,200,.5)}50%{text-shadow:0 0 22px var(--teal)}}
.rune-card.lit img{width:26px;height:26px}
.rune-card .sleep{font-size:11px;color:rgba(255,255,255,.28)}
.rune-endcard{grid-column:1/-1;text-align:center;color:var(--dim);padding:20px;font-size:15px}

#reveal{z-index:55}
#reveal-stones{display:flex;gap:14px}
#reveal-stones span{width:58px;height:58px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;
  background:rgba(255,255,255,.1);border:1px solid var(--stroke);animation:popIn .5s ease backwards}
#reveal-stones span:nth-child(2){animation-delay:.15s}#reveal-stones span:nth-child(3){animation-delay:.3s}#reveal-stones span:nth-child(4){animation-delay:.45s}
#reveal-word{font-size:88px;font-weight:800;letter-spacing:.28em;color:var(--gold);text-shadow:0 0 40px rgba(255,209,102,.6);animation:wordPop .8s .8s ease backwards}
@keyframes wordPop{0%{transform:scale(2.4);opacity:0}60%{transform:scale(.95);opacity:1}100%{transform:scale(1)}}
```

- [ ] **Step 6: 写 main.js 启动壳（本任务不含游戏循环）**

`public/js/main.js`：
```js
// —— 启动壳：内容加载 + 舞台缩放 + 标题/序章（主循环在后续任务接入）——
import { INLINE_CONTENT } from './content-fallback.js';

export async function loadContent() {
  try {
    const res = await fetch('/api/chapter1');
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch { return INLINE_CONTENT; } // 规格 §12：兜底，保证可玩
}

function fitStage(stage) {
  const s = Math.min(innerWidth / 1280, innerHeight / 720);
  stage.style.width = `${1280 * s}px`;
  stage.style.height = `${720 * s}px`;
}

function boot() {
  const $ = id => document.getElementById(id);
  const stage = $('stage');
  fitStage(stage);
  addEventListener('resize', () => fitStage(stage));

  const params = new URLSearchParams(location.search);
  loadContent().then(content => {
    window.G = { content, beat: 'title' };
    if (params.get('autostart') === '1') {
      $('title').classList.add('hidden');
      dispatchStart(); return;
    }
    $('title').classList.remove('hidden');
    $('btn-start').addEventListener('click', () => {
      $('title').classList.add('hidden');
      dispatchStart();
    }, { once: true });
  });

  function dispatchStart() {
    // 序章 → game:start（Task 13 由主循环接管；现在的临时监听只报开发提示）
    const pro = $('prologue');
    pro.classList.remove('hidden');
    const go = () => { pro.classList.add('hidden'); pro.removeEventListener('click', go); dispatchEvent(new CustomEvent('game:start')); };
    pro.addEventListener('click', go);
    addEventListener('game:start', () => {
      const toast = $('toast');
      if (!window.__gameLoopOn) { toast.textContent = '（主循环未接入：Task 13 接线）'; toast.classList.remove('hidden'); }
    }, { once: true });
  }
}

if (typeof document !== 'undefined') document.addEventListener('DOMContentLoaded', boot);
```

- [ ] **Step 7: 跑测试 + 启动目检**

Run: `node --test`
Expected: 全部 pass（Task 1 的两条 server 测试此时转绿）。

Run: `node server.js` → 打开 `http://localhost:3000`
Expected: 深色舞台居中；毛玻璃标题卡：青色 ᚫ 上下浮动、「回响之石 / THE ECHO STONE」、蓝色开始按钮，点击有按压缩放；点开始 → 序章三句 + 「点击继续」呼吸；点击后顶部出现开发 toast。Ctrl+C 停服务器。

- [ ] **Step 8: Commit**

```bash
git add public test/fallback.test.js
git commit -m "feat: 页面骨架/玻璃设计系统/内容兜底与启动壳"
```

---

### Task 3: art.js 美术库（调色板 / 48 卢文折线 / 手绘图标）（TDD 数据面）

**Files:**
- Create: `public/js/art.js`
- Test: `test/art.test.js`
- 规格：§9（双风格、禁 emoji、矢量图标）、§7.2（卢文表）

- [ ] **Step 1: 写失败测试**

`test/art.test.js`：
```js
import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { PAL, RUNE_STROKES, ICON_TYPES, drawIcon, drawRune } from '../public/js/art.js';

const data = JSON.parse(await readFile(new URL('../content/chapter1.json', import.meta.url), 'utf8'));

function makeCtx() { // 记录型 canvas 桩
  const calls = { moveTo: 0, lineTo: 0, arc: 0, fill: 0, stroke: 0 };
  const grad = { addColorStop() {} };
  return new Proxy({ __calls: calls }, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => grad;
      return () => { if (k in calls) calls[k]++; };
    },
    set(t, k, v) { t[k] = v; return true; }
  });
}

test('48 个卢文字形都有折线数据（0..1 归一，线段合法）', () => {
  const glyphs = Object.values(data.phonemeBook.runes);
  assert.equal(new Set(glyphs).size, 48);
  for (const g of glyphs) {
    const segs = RUNE_STROKES[g];
    assert.ok(Array.isArray(segs) && segs.length >= 1, `${g} 缺折线`);
    for (const [x1, y1, x2, y2] of segs) {
      for (const n of [x1, y1, x2, y2]) assert.ok(Number.isFinite(n) && n >= 0 && n <= 1, `${g} 坐标越界`);
    }
  }
});

test('PAL 与 ICON_TYPES 齐备', () => {
  for (const k of ['ink','vowel','cons','glowRune','gold','uiBlue']) assert.ok(PAL[k]);
  assert.deepEqual([...ICON_TYPES].sort(), ['fire','gem','hat','hello','light','open','water']);
});

test('drawIcon / drawRune 在桩 ctx 上可执行且确实作画', () => {
  const ctx = makeCtx();
  for (const t of ICON_TYPES) drawIcon(ctx, t, 100, 100, 64);
  assert.ok(ctx.__calls.moveTo + ctx.__calls.arc > 10);
  const r = makeCtx();
  drawRune(r, data.phonemeBook.runes['ə'], 50, 50, 40, '#fff');
  assert.ok(r.__calls.moveTo >= 1 && r.__calls.lineTo >= 1);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/art.test.js`
Expected: FAIL（`Cannot find module '../public/js/art.js'`）。

- [ ] **Step 3: 实现 art.js**

`public/js/art.js`：
```js
// —— 调色板（规格 §9A：黄昏暖光 + 厚描边；§9B：iOS UI 色）——
export const PAL = {
  ink: '#20242f',
  floorA: '#8a8078', floorB: '#7c736b', floorLine: '#5d574f', crack: '#4a453f',
  wallA: '#6e6a75', wallB: '#605c66', wallDark: '#4b4852',
  rug: '#a34632', rugDark: '#7e3524', rugGold: '#d9a441',
  wood: '#8a5a33', wood2: '#6e4526', wood3: '#a5713f',
  stone: '#9aa0a8', stoneD: '#6b7078',
  fire1: '#ffb347', fire2: '#ff7733', fireCore: '#ffe9a8',
  water: '#4fa3d1', waterD: '#2f6f96', leaf: '#5e9c4f', leafD: '#43703a', petal: '#f2a5c0',
  hat: '#d9b45a', hatD: '#a8853a',
  lampGlow: '#ffd27a', glowRune: '#54e0c8', gold: '#ffd36b',
  vowel: '#ffd166', cons: '#6fb7ff',
  night: '#232a45', moon: '#f4f0d8',
  uiBlue: '#0A84FF'
};

// —— 48 卢文折线（0..1 归一，y 向下；风格化矢量，卡片同时标注 IPA 以区分相近字形）——
export const RUNE_STROKES = {
  'ᛃ': [[0,0,0,1],[0,.5,.5,.72]],                       'ᛂ': [[0,0,0,1],[0,.25,.45,.5]],
  'ᛖ': [[0,0,0,1],[0,.12,.5,.27],[0,.38,.5,.53],[0,.64,.5,.79]],
  'ᚫ': [[0,0,0,1],[0,.15,.5,.35],[0,.45,.5,.65]],       'ᚨ': [[0,0,0,1],[0,.15,.5,.4],[0,.5,.5,.75]],
  'ᚬ': [[0,0,0,1],[.45,.28,.2,.42],[.2,.42,.45,.56],[.45,.56,.45,.28]],
  'ᚢ': [[0,0,0,1],[0,0,.45,.45],[.45,.45,.3,1]],
  'ᚭ': [[0,.25,0,1],[0,.25,.4,.45],[.4,.45,0,.65]],
  'ᛇ': [[0,0,.35,.2],[.35,.2,.7,.5],[.7,.5,.35,.8],[.35,.8,0,1]],
  'ᛜ': [[.15,.2,.5,.85],[.5,.85,.85,.2]],
  'ᚪ': [[0,0,0,1],[0,.2,.5,.05],[0,.5,.5,.35]],
  'ᛠ': [[0,0,0,1],[0,.2,.4,.35],[.4,.35,.4,.65],[.4,.65,0,.8]],
  'ᛄ': [[0,.15,0,1],[0,.15,.5,.15],[.5,.15,.5,.6],[.5,.6,.2,1]],
  'ᛁ': [[0,0,0,1]],
  'ᛤ': [[0,0,0,1],[.3,.35,.55,.5],[.55,.5,.3,.65],[.3,.65,.3,.35]],
  'ᚩ': [[0,0,0,1],[0,.25,.5,.1]],
  'ᛥ': [[0,0,0,1],[0,.3,.5,.15],[0,.3,.5,.6]],
  'ᛡ': [[0,.15,.5,.4],[.5,.4,0,.65],[0,.65,.5,.9]],
  'ᛧ': [[0,0,0,1],[0,.35,.5,.2],[0,.6,.5,.45]],
  'ᛨ': [[0,0,0,1],[0,.25,.5,.4],[.5,.4,.5,.75],[.5,.75,.25,1]],
  'ᛈ': [[0,0,0,1],[0,.3,.5,.15],[.5,.15,0,.45]],
  'ᛒ': [[0,0,0,1],[0,.3,.5,.15],[.5,.15,.5,.5],[.5,.5,0,.65]],
  'ᛏ': [[.5,0,.5,1],[.5,.25,.1,.05],[.5,.25,.9,.05]],
  'ᛞ': [[0,0,0,1],[0,.3,.5,.45],[.5,.45,.2,.65]],
  'ᚳ': [[0,0,0,1],[0,.35,.55,.2],[0,.35,.55,.55]],
  'ᚷ': [[0,0,0,1],[0,.2,.5,.05],[0,.5,.5,.35],[0,.2,.5,.35]],
  'ᚠ': [[0,0,0,1],[0,.1,.5,.25],[0,.45,.5,.6]],
  'ᚡ': [[0,0,0,1],[0,.2,.5,.45],[0,.5,.5,.75]],
  'ᚦ': [[0,0,0,1],[0,.3,.5,.2],[.5,.2,.3,.45],[.3,.45,0,.55]],
  'ᚧ': [[0,0,0,1],[0,.3,.5,.2],[.5,.2,.5,.5],[.5,.5,0,.65],[.3,.5,.3,1]],
  'ᛌ': [[0,.1,.45,.35],[.45,.35,0,.6],[0,.6,.45,.85]],
  'ᛋ': [[.15,.05,.85,.5],[.85,.5,.15,.95]],
  'ᛢ': [[0,0,0,1],[0,.25,.5,.5],[.5,.5,0,.75]],
  'ᛣ': [[0,0,0,1],[0,.4,.5,.25],[0,.4,.5,.55]],
  'ᚲ': [[.5,0,.5,1],[.5,.3,.15,.15],[.5,.3,.15,.5]],
  'ᚵ': [[.5,0,.5,1],[.5,.3,.15,.15],[.15,.15,.15,.55]],
  'ᚶ': [[0,0,0,1],[0,.5,.5,.35],[0,.5,.5,.65],[.5,.35,.5,.65]],
  'ᚸ': [[0,0,0,1],[0,.5,.5,.35],[0,.5,.5,.65],[.25,.5,.25,1]],
  'ᚺ': [[0,0,0,1],[0,.35,.35,.2],[.35,.2,.35,.6]],
  'ᚼ': [[0,0,0,1],[0,.3,.5,.5],[.5,.5,0,.7],[0,.7,.5,.9]],
  'ᛗ': [[0,0,0,1],[.5,0,.5,1],[0,.25,.5,.5],[.5,.5,0,.75]],
  'ᚾ': [[0,0,0,1],[0,.3,.5,.6]],
  'ᛝ': [[.15,.1,.85,.5],[.85,.5,.15,.9],[.15,.9,.15,.1]],
  'ᚻ': [[0,0,0,1],[0,.2,.5,.3],[0,.4,.5,.5],[0,.6,.5,.7],[0,.8,.5,.9]],
  'ᛚ': [[0,0,0,1],[0,.25,.5,.1],[0,.55,.3,.45],[.3,.45,.3,.75]],
  'ᚱ': [[0,0,0,1],[0,.2,.45,.15],[.45,.15,.45,.4],[.45,.4,0,.45]],
  'ᛅ': [[0,0,0,1],[0,.5,.45,.3]],
  'ᚹ': [[0,0,0,1],[0,.3,.45,.2],[.45,.2,.45,.45],[.45,.45,0,.6]]
};

export function drawRune(ctx, glyph, cx, cy, size, color = PAL.glowRune, lw = null) {
  const segs = RUNE_STROKES[glyph];
  if (!segs) return;
  const w = size, h = size * 1.15;
  ctx.save();
  ctx.translate(cx - w / 2, cy - h / 2);
  ctx.strokeStyle = color;
  ctx.lineWidth = lw ?? Math.max(2.5, size * 0.13);
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  for (const [x1, y1, x2, y2] of segs) { ctx.moveTo(x1 * w, y1 * h); ctx.lineTo(x2 * w, y2 * h); }
  ctx.stroke();
  ctx.restore();
}

// —— 手绘图标库（厚描边 Q 版，规格 §9C，禁 emoji）——
export const ICON_TYPES = ['hello', 'water', 'fire', 'hat', 'light', 'open', 'gem'];

function ink(ctx, s) { ctx.lineWidth = Math.max(3, s * 0.09); ctx.strokeStyle = PAL.ink; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; }

const ICON_DRAW = {
  hello(ctx, cx, cy, s) { // 气泡 + 三点
    ink(ctx, s);
    ctx.fillStyle = '#f7f4ea';
    ctx.beginPath();
    const w = s * 0.95, h = s * 0.7, x = cx - w / 2, y = cy - h / 2 - s * 0.05, r = s * 0.18;
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.12, y + h); ctx.lineTo(cx - s * 0.02, y + h + s * 0.22); ctx.lineTo(cx + s * 0.14, y + h);
    ctx.closePath(); ctx.fillStyle = '#f7f4ea'; ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.ink;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(cx + i * s * 0.2, y + h * 0.5, s * 0.055, 0, 7); ctx.fill(); }
  },
  water(ctx, cx, cy, s) { // 水滴
    ink(ctx, s);
    ctx.fillStyle = PAL.water;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.48);
    ctx.bezierCurveTo(cx + s * 0.42, cy + s * 0.02, cx + s * 0.3, cy + s * 0.44, cx, cy + s * 0.44);
    ctx.bezierCurveTo(cx - s * 0.3, cy + s * 0.44, cx - s * 0.42, cy + s * 0.02, cx, cy - s * 0.48);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.beginPath(); ctx.ellipse(cx - s * 0.12, cy + s * 0.12, s * 0.07, s * 0.12, -0.5, 0, 7); ctx.fill();
  },
  fire(ctx, cx, cy, s) { // 火焰 + 内焰
    ink(ctx, s);
    ctx.fillStyle = PAL.fire2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.5);
    ctx.bezierCurveTo(cx + s * 0.4, cy - s * 0.1, cx + s * 0.34, cy + s * 0.28, cx, cy + s * 0.46);
    ctx.bezierCurveTo(cx - s * 0.34, cy + s * 0.28, cx - s * 0.4, cy - s * 0.1, cx, cy - s * 0.5);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.fireCore;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.05);
    ctx.bezierCurveTo(cx + s * 0.18, cy + s * 0.18, cx + s * 0.14, cy + s * 0.34, cx, cy + s * 0.42);
    ctx.bezierCurveTo(cx - s * 0.14, cy + s * 0.34, cx - s * 0.18, cy + s * 0.18, cx, cy - s * 0.05);
    ctx.closePath(); ctx.fill();
  },
  hat(ctx, cx, cy, s) { // 草帽：帽顶 + 帽檐 + 帽带
    ink(ctx, s);
    ctx.fillStyle = PAL.hat;
    ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.1, s * 0.48, s * 0.16, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.3, cy + s * 0.08);
    ctx.quadraticCurveTo(cx, cy - s * 0.62, cx + s * 0.3, cy + s * 0.08);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.hatD;
    ctx.fillRect(cx - s * 0.3, cy - s * 0.02, s * 0.6, s * 0.1);
  },
  light(ctx, cx, cy, s) { // 提灯：吊环 + 笼身 + 火苗 + 光晕
    ink(ctx, s);
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, s * 0.6);
    g.addColorStop(0, 'rgba(255,210,122,.5)'); g.addColorStop(1, 'rgba(255,210,122,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, s * 0.6, 0, 7); ctx.fill();
    ctx.fillStyle = PAL.wood;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.26, cy - s * 0.3); ctx.lineTo(cx + s * 0.26, cy - s * 0.3);
    ctx.lineTo(cx + s * 0.2, cy + s * 0.34); ctx.lineTo(cx - s * 0.2, cy + s * 0.34);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = PAL.ink; ctx.beginPath(); ctx.arc(cx, cy - s * 0.42, s * 0.1, 0, 7); ctx.stroke();
    ctx.fillStyle = PAL.fireCore;
    ctx.beginPath(); ctx.ellipse(cx, cy + s * 0.02, s * 0.09, s * 0.16, 0, 0, 7); ctx.fill();
  },
  open(ctx, cx, cy, s) { // 拱门：石拱 + 敞开的通道
    ink(ctx, s);
    ctx.fillStyle = PAL.stone;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.4, cy + s * 0.48); ctx.lineTo(cx - s * 0.4, cy - s * 0.05);
    ctx.arc(cx, cy - s * 0.05, s * 0.4, Math.PI, 0);
    ctx.lineTo(cx + s * 0.4, cy + s * 0.48); ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.fillStyle = PAL.night;
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.2, cy + s * 0.48); ctx.lineTo(cx - s * 0.2, cy + s * 0.05);
    ctx.arc(cx, cy + s * 0.05, s * 0.2, Math.PI, 0);
    ctx.lineTo(cx + s * 0.2, cy + s * 0.48); ctx.closePath(); ctx.fill();
  },
  gem(ctx, cx, cy, s) { // 菱形宝石（声音石袋）
    ink(ctx, s);
    ctx.fillStyle = PAL.cons;
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.44); ctx.lineTo(cx + s * 0.4, cy); ctx.lineTo(cx, cy + s * 0.44); ctx.lineTo(cx - s * 0.4, cy);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.6)';
    ctx.beginPath(); ctx.moveTo(cx - s * 0.18, cy - s * 0.16); ctx.lineTo(cx + s * 0.18, cy + s * 0.2); ctx.stroke();
  }
};

export function drawIcon(ctx, type, cx, cy, size) {
  (ICON_DRAW[type] || ICON_DRAW.gem)(ctx, cx, cy, size);
}

// —— dataURL（DOM 用；仅函数内触碰 document）——
const urlCache = new Map();
export function iconURL(type) {
  if (urlCache.has(type)) return urlCache.get(type);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  drawIcon(ctx, type, 64, 64, 108);
  const url = c.toDataURL();
  urlCache.set(type, url);
  return url;
}
```

- [ ] **Step 4: 跑测试**

Run: `node --test test/art.test.js`
Expected: 3 pass。

- [ ] **Step 5: Commit**

```bash
git add public/js/art.js test/art.test.js
git commit -m "feat: art.js 调色板/48卢文折线/厚描边图标库"
```

---

### Task 4: audio.js 语音引擎 + 合成音效（TDD，假对象注入）

**Files:**
- Create: `public/js/audio.js`
- Test: `test/audio.test.js`
- 规格：§11.3（音色探测打分、口型脉冲、估时兜底绝不卡死）、§11.4（音效清单）

- [ ] **Step 1: 写失败测试**

`test/audio.test.js`：
```js
import { test } from 'node:test';
import assert from 'node:assert';
import { scoreVoice, pickVoices, estimateMs, Speech, Sfx } from '../public/js/audio.js';

const VOICES = [
  { name: 'Microsoft David', lang: 'en-US', localService: true },
  { name: 'Microsoft Zira', lang: 'en-US', localService: true },
  { name: 'Google UK English Female', lang: 'en-GB', localService: false },
  { name: 'Microsoft Huihui', lang: 'zh-CN', localService: true }
];

test('音色打分：非英语淘汰；大叔=男声；童声=女声', () => {
  assert.ok(scoreVoice(VOICES[3], 'uncle') < 0);
  assert.ok(scoreVoice(VOICES[0], 'uncle') > scoreVoice(VOICES[1], 'uncle'));
  assert.ok(scoreVoice(VOICES[1], 'child') > scoreVoice(VOICES[0], 'child'));
  const picked = pickVoices(VOICES);
  assert.equal(picked.uncle.name, 'Microsoft David');
  assert.equal(['Microsoft Zira', 'Google UK English Female'].includes(picked.child.name), true);
  assert.ok(picked.door);
});

test('estimateMs：词数×380/rate，下限 650', () => {
  assert.equal(estimateMs('Hello!', 1), 650);       // 1 词 380 → 下限 650
  assert.equal(estimateMs('Open… open… open the door!', 1), 5 * 380);
  assert.equal(estimateMs('Open the door', 0.5), 3 * 380 / 0.5);
});

test('无 speechSynthesis：立即 resolves，流程不卡死', async () => {
  const s = new Speech(null, null);
  let started = false;
  const t0 = Date.now();
  await s.speak('Hello! Yes, you!', { onStart: () => { started = true; } });
  assert.ok(started);
  assert.ok(Date.now() - t0 < 500);
});

test('有 synth 且触发 onend：按 onend 收束', async () => {
  const synth = { speak(u) { setTimeout(() => u.onend && u.onend(), 30); } };
  const s = new Speech(synth, t => ({ text: t }));
  await s.speak('Light.', {});
  assert.ok(true);
});

test('有 synth 但永不 onend：估时兜底收束', async () => {
  const synth = { speak() {} };
  const s = new Speech(synth, t => ({ text: t }));
  const t0 = Date.now();
  await s.speak('Open.', { rate: 1 });   // 1 词 → 650 + 400 缓冲
  const dt = Date.now() - t0;
  assert.ok(dt >= 500 && dt < 2000, `耗时异常: ${dt}`);
});

test('Sfx：假 AudioContext 上创建振荡器并排包络', () => {
  const made = [];
  const node = () => {
    const n = { connects: 0, started: 0, stopped: 0 };
    return new Proxy(n, {
      get(t, k) {
        if (k === 'connect') return () => { t.connects++; };
        if (k === 'start') return () => { t.started++; };
        if (k === 'stop') return () => { t.stopped++; };
        if (k === 'frequency' || k === 'gain') return { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} };
        if (k === 'type' || k === 'buffer' || k === 'value' || k === 'currentTime' || k === 'destination' || k === 'sampleRate') return t[k];
        return t[k];
      },
      set(t, k, v) { t[k] = v; return true; }
    });
  };
  const ctx = new Proxy({ currentTime: 0, sampleRate: 8000, destination: {} }, {
    get(t, k) {
      if (k === 'createOscillator' || k === 'createGain' || k === 'createBufferSource') return () => { const n = node(); made.push(n); return n; };
      if (k === 'createBuffer') return () => ({ getChannelData: () => new Float32Array(64) });
      if (k === 'createBiquadFilter') return () => node();
      return t[k];
    },
    set(t, k, v) { t[k] = v; return true; }
  });
  const sfx = new Sfx(ctx);
  sfx.chime();      // 3 音琶音
  const osc = made.filter(n => n.type !== undefined);
  assert.ok(made.length >= 3);
  assert.ok(osc.every(o => o.started === 1));
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/audio.test.js`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 audio.js**

`public/js/audio.js`：
```js
// —— TTS：音色打分挑选 + 口型脉冲 + 估时兜底（规格 §11.3）——
const MALE = /male|david|george|ryan|daniel|guy|james|arthur|fred|mark|alex/i;
const FEMALE = /female|zira|hazel|susan|aria|jenny|sonia|libby|samantha|victoria|karen|moira|tessa|serena/i;

export function scoreVoice(v, role) {
  const lang = (v.lang || '').toLowerCase();
  if (!lang.startsWith('en')) return -1;
  const name = `${v.name} ${v.voiceURI || ''}`;
  let s = 10;
  if (/gb|uk/.test(lang)) s += 2; else if (/us/.test(lang)) s += 1;
  if (v.localService) s += 2;
  const male = MALE.test(name), female = FEMALE.test(name);
  if (role === 'uncle' || role === 'door') { if (male) s += 4; if (female) s -= 3; }
  if (role === 'child') { if (female) s += 4; if (male) s -= 3; }
  return s;
}

export function pickVoices(list) {
  const best = role => list
    .map(v => ({ v, s: scoreVoice(v, role) }))
    .filter(x => x.s > 0)
    .sort((a, b) => b.s - a.s)[0]?.v || null;
  const uncle = best('uncle');
  return { uncle, child: best('child'), door: uncle };
}

export function estimateMs(text, rate = 1) {
  const words = text.trim().split(/\s+/).filter(Boolean).length || 1;
  return Math.max(650, (words * 380) / rate);
}

export class Speech {
  constructor(synth = null, makeUtterance = null) {
    this.synth = synth ?? (typeof speechSynthesis !== 'undefined' ? speechSynthesis : null);
    this.makeUtterance = makeUtterance
      ?? (t => (typeof SpeechSynthesisUtterance !== 'undefined' ? new SpeechSynthesisUtterance(t) : null));
  }
  get ready() { return !!this.synth; }
  speak(text, { voice = null, pitch = 1, rate = 1, onStart = null, onPulse = null } = {}) {
    return new Promise(resolve => {
      const est = estimateMs(text, rate);
      let done = false;
      const finish = () => { if (done) return; done = true; clearTimeout(timer); clearInterval(pulseIv); resolve(); };
      const timer = setTimeout(finish, est + 400); // 兜底：永不低于估算+400ms
      let pulseIv = 0;
      const startPulse = () => {
        if (!onPulse || pulseIv) return;
        pulseIv = setInterval(() => onPulse(), 120);
      };
      let u = null;
      try { u = this.synth ? this.makeUtterance(text) : null; } catch { u = null; }
      if (!u) { if (onStart) onStart(); setTimeout(finish, 50); return; } // 无 TTS：立刻走，绝不卡死
      u.pitch = pitch; u.rate = rate; if (voice) u.voice = voice;
      u.onstart = () => { if (onStart) onStart(); startPulse(); };
      u.onend = finish;
      u.onerror = finish;
      if (onPulse) u.onboundary = () => onPulse();
      try { this.synth.speak(u); if (onStart) onStart(); startPulse(); }
      catch { finish(); }
    });
  }
}

// —— WebAudio 合成音效（规格 §11.4；构造注入 AudioContext 便于测试）——
export class Sfx {
  constructor(ctx = null) {
    this.ctx = ctx ?? (typeof AudioContext !== 'undefined' ? new AudioContext() : null);
  }
  get ok() { return !!this.ctx; }
  tone({ f = 440, f2 = null, type = 'sine', t = 0, dur = 0.2, vol = 0.15, attack = 0.01 } = {}) {
    if (!this.ok) return;
    const c = this.ctx, now = c.currentTime + t;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, now);
    if (f2) o.frequency.exponentialRampToValueAtTime(Math.max(30, f2), now + dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(vol, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g); g.connect(c.destination);
    o.start(now); o.stop(now + dur + 0.05);
  }
  noise({ t = 0, dur = 0.3, vol = 0.12, freq = 1000 } = {}) {
    if (!this.ok) return;
    const c = this.ctx, now = c.currentTime + t;
    const len = Math.max(64, Math.floor(c.sampleRate * dur));
    const buf = c.createBuffer(1, len, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = c.createBufferSource(); src.buffer = buf;
    const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq;
    const g = c.createGain();
    g.gain.setValueAtTime(vol, now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(bp); bp.connect(g); g.connect(c.destination);
    src.start(now); src.stop(now + dur);
  }
  click()   { this.tone({ f: 1800, f2: 900, type: 'triangle', dur: 0.06, vol: 0.1 }); }
  chime()   { [880, 1320, 1760].forEach((f, i) => this.tone({ f, t: i * 0.05, dur: 0.5, vol: 0.09 })); }
  resonate(){ [523, 659, 784, 1046].forEach((f, i) => this.tone({ f, t: i * 0.09, dur: 0.7, vol: 0.13 })); }
  glowTick(){ this.tone({ f: 660, dur: 0.12, vol: 0.06 }); }
  itemIn()  { this.tone({ f: 500, f2: 1000, dur: 0.25, vol: 0.12 }); }
  sweepUp() { this.tone({ f: 200, f2: 1600, dur: 1.1, vol: 0.15, type: 'sawtooth' }); this.noise({ dur: 1.2, vol: 0.05, freq: 2400 }); }
  ignite()  { this.noise({ dur: 0.5, vol: 0.16, freq: 800 }); this.tone({ f: 300, f2: 90, dur: 0.5, vol: 0.09, type: 'triangle' }); }
  water()   { this.noise({ dur: 0.6, vol: 0.11, freq: 1200 }); }
  bloom()   { [1046, 1318, 1568].forEach((f, i) => this.tone({ f, t: 0.3 + i * 0.07, dur: 0.4, vol: 0.08 })); }
  hatPuff() { this.tone({ f: 300, f2: 150, dur: 0.18, vol: 0.13, type: 'triangle' }); }
  laugh()   { [500, 430, 500, 430].forEach((f, i) => this.tone({ f, dur: 0.09, t: i * 0.1, vol: 0.09, type: 'square' })); }
  clack()   { this.tone({ f: 120, dur: 0.05, vol: 0.16, type: 'square' }); setTimeout(() => this.tone({ f: 100, dur: 0.05, vol: 0.13, type: 'square' }), 90); }
  mutter()  { this.tone({ f: 90, f2: 60, dur: 0.5, vol: 0.11, type: 'sawtooth' }); }
  creak()   { this.tone({ f: 140, f2: 60, dur: 1.4, vol: 0.11, type: 'sawtooth' }); }
  choir()   { [261, 329, 392, 523].forEach((f, i) => this.tone({ f, t: i * 0.12, dur: 2.2, vol: 0.07 })); }
  meow()    { this.tone({ f: 700, f2: 1100, dur: 0.18, vol: 0.11 }); this.tone({ f: 1100, f2: 600, t: 0.18, dur: 0.3, vol: 0.09 }); }
  crackle() { for (let i = 0; i < 3; i++) this.noise({ t: Math.random() * 0.4, dur: 0.05, vol: 0.04, freq: 2500 }); }
}
```

- [ ] **Step 4: 跑测试**

Run: `node --test test/audio.test.js`
Expected: 6 pass。

- [ ] **Step 5: Commit**

```bash
git add public/js/audio.js test/audio.test.js
git commit -m "feat: TTS 音色打分/口型脉冲/估时兜底 + WebAudio 合成音效"
```

---

### Task 5: scene.js 纯逻辑层——布局/坐标/碰撞/掉落物理/磁吸（TDD）

**Files:**
- Create: `public/js/scene.js`（本任务只写纯导出；静态/动态渲染在 Task 8 追加）
- Test: `test/scene.test.js`
- 规格：§6.1（布局坐标）、§11.5（物理/移动/磁吸）、§11.6（坐标换算）

- [ ] **Step 1: 写失败测试**

`test/scene.test.js`：
```js
import { test } from 'node:test';
import assert from 'node:assert';
import { LAYOUT, rng, resolveCollisions, screenToLogical, moveToward, stepStone, magnetStep } from '../public/js/scene.js';

test('rng 同种子序列确定', () => {
  const a = rng(7), b = rng(7);
  assert.equal(a(), b()); assert.equal(a(), b());
});

test('碰撞：被推离障碍圆并夹在房间边界内', () => {
  const p = { x: 210, y: 470 };                       // 井心
  resolveCollisions(p);
  const well = LAYOUT.obstacles.find(o => o.id === 'well');
  assert.ok(Math.hypot(p.x - well.x, p.y - well.y) >= well.r + 16 - 0.01);
  const q = { x: 0, y: 100 };
  resolveCollisions(q);
  assert.equal(q.x, 40); assert.equal(q.y, 340);
});

test('screenToLogical：整档与缩放档都换算正确，出界标记', () => {
  let r = screenToLogical(640, 360, { left: 0, top: 0, width: 1280, height: 720 }, 1280, 720);
  assert.deepEqual([r.x, r.y], [640, 360]); assert.ok(r.inside);
  r = screenToLogical(320, 180, { left: 0, top: 0, width: 640, height: 360 }, 1280, 720);
  assert.deepEqual([Math.round(r.x), Math.round(r.y)], [640, 360]);
  r = screenToLogical(5, 5, { left: 0, top: 0, width: 640, height: 360 }, 1280, 720);
  assert.equal(r.inside, false);
});

test('moveToward：按速度推进并在到达时返回 true', () => {
  const p = { x: 0, y: 0 };
  assert.equal(moveToward(p, { x: 30, y: 0 }, 100, 0.1), false);
  assert.equal(p.x, 10);
  assert.equal(moveToward(p, { x: 30, y: 0 }, 100, 0.5), true);
  assert.equal(p.x, 30);
});

test('石物理：上抛→重力→弹跳衰减×0.45→落定 idle', () => {
  const s = { ipa: 'l', x: 100, y: 100, vx: 0, vy: 0, state: 'fly', t: 0 };
  for (let i = 0; i < 400 && s.state !== 'idle'; i++) stepStone(s, 0.016, 500);
  assert.equal(s.state, 'idle');
  assert.ok(Math.abs(s.y - 500) < 1);
});

test('石物理：单次弹跳能量精确衰减', () => {
  const s = { ipa: 'l', x: 100, y: 500, vx: 0, vy: 200, state: 'fly', t: 0 };
  stepStone(s, 0.016, 500);
  assert.ok(s.vy > -110 && s.vy < -90, `vy=${s.vy}`);
  assert.equal(s.y, 500);
});

test('磁吸：46px 内进入磁吸态并最终判定拾取', () => {
  const s = { ipa: 'l', x: 30, y: 0, vx: 0, vy: 0, state: 'idle', t: 0 };
  const player = { x: 0, y: 0 };
  let picked = false;
  for (let i = 0; i < 60 && !picked; i++) picked = magnetStep(s, player, 0.016);
  assert.ok(picked);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/scene.test.js`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 scene.js 纯逻辑层（渲染函数 Task 8 追加到同一文件）**

`public/js/scene.js` 文件头：
```js
// —— 布局（规格 §6.1）——
export const LAYOUT = {
  W: 1280, H: 720, WALL_BOTTOM: 300,
  playerStart: { x: 560, y: 600 },
  obstacles: [
    { id: 'well', x: 210, y: 470, r: 46 },
    { id: 'brazier', x: 480, y: 480, r: 40 },
    { id: 'lamp', x: 620, y: 340, r: 34 },
    { id: 'hatstand', x: 980, y: 520, r: 34 },
    { id: 'npc', x: 400, y: 430, r: 38 },
    { id: 'sprout', x: 330, y: 570, r: 28 },
    { id: 'cat', x: 560, y: 560, r: 24 }
  ],
  targets: {
    npc: { x: 400, y: 430, r: 60 }, well: { x: 210, y: 470, r: 56 },
    brazier: { x: 480, y: 480, r: 52 }, lamp: { x: 620, y: 340, r: 56 },
    hatstand: { x: 980, y: 520, r: 52 }, sprout: { x: 330, y: 570, r: 46 },
    torches: { x: 980, y: 260, r: 130 }, door: { x: 1145, y: 430, r: 95 }
  },
  INTERACT_R: 170, MAGNET_R: 46
};

// —— 确定性随机（裂缝/星星布局用，测试可复现）——
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}

export function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

// —— 碰撞：房间边界 + 圆形障碍（规格 §11.5）——
export function resolveCollisions(p, pr = 16) {
  p.x = clamp(p.x, 40, LAYOUT.W - 40);
  p.y = clamp(p.y, 340, LAYOUT.H - 20);
  for (const o of LAYOUT.obstacles) {
    const dx = p.x - o.x, dy = p.y - o.y, d = Math.hypot(dx, dy), min = o.r + pr;
    if (d < min && d > 0.001) { p.x = o.x + (dx / d) * min; p.y = o.y + (dy / d) * min; }
  }
  return p;
}

// —— 屏幕→逻辑坐标（DPR/等比缩放，规格 §12）——
export function screenToLogical(px, py, rect) {
  const scale = Math.min(rect.width / LAYOUT.W, rect.height / LAYOUT.H);
  const ox = rect.left + (rect.width - LAYOUT.W * scale) / 2;
  const oy = rect.top + (rect.height - LAYOUT.H * scale) / 2;
  const x = (px - ox) / scale, y = (py - oy) / scale;
  return { x, y, inside: x >= 0 && x <= LAYOUT.W && y >= 0 && y <= LAYOUT.H };
}

// —— 行走 ——
export function moveToward(p, target, speed, dt) {
  const dx = target.x - p.x, dy = target.y - p.y, d = Math.hypot(dx, dy);
  if (d <= speed * dt) { p.x = target.x; p.y = target.y; return true; }
  p.x += (dx / d) * speed * dt;
  p.y += (dy / d) * speed * dt;
  return false;
}

// —— 音素石物理：上抛→重力→弹跳(×0.45)→静止浮动（规格 §11.5）——
export function makeStone(ipa, x, y, delay = 0, rand = Math.random) {
  return {
    ipa, x, y,
    vx: (rand() * 2 - 1) * 60,
    vy: -260 - rand() * 60,
    state: 'wait', t: -delay, settleT: 0, restY: 0, magnet: false, phase: rand() * 6.28
  };
}

export function stepStone(s, dt, floorY) {
  if (s.state === 'wait') { s.t += dt; if (s.t >= 0) s.state = 'fly'; else return s; }
  if (s.state === 'fly') {
    s.vy += 1400 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (s.y >= floorY && s.vy > 0) {
      s.y = floorY;
      s.vy = -s.vy * 0.45;
      if (Math.abs(s.vy) < 70) { s.state = 'settle'; s.settleT = 0; s.restY = floorY; }
    }
    s.x = clamp(s.x, 30, LAYOUT.W - 30);
  } else if (s.state === 'settle') {
    s.settleT += dt;
    if (s.settleT > 0.5) s.state = 'idle';
  }
  return s;
}

// —— 磁吸：46px 内加速飞向玩家，<14px 判定拾取 ——
export function magnetStep(s, player, dt) {
  if (s.state !== 'settle' && s.state !== 'idle') return false;
  const dx = player.x - s.x, dy = player.y - s.y, d = Math.hypot(dx, dy);
  if (!s.magnet && d > LAYOUT.MAGNET_R) return false;
  s.magnet = true;
  const sp = 900 * dt;
  s.x += (dx / (d || 1)) * sp;
  s.y += (dy / (d || 1)) * sp;
  return d < 14;
}
```
注意：`screenToLogical(px, py, rect)` 只需 3 参（rect 含 css 尺寸）——测试按此签名调用。

- [ ] **Step 4: 跑测试**

Run: `node --test test/scene.test.js`
Expected: 7 pass。

- [ ] **Step 5: Commit**

```bash
git add public/js/scene.js test/scene.test.js
git commit -m "feat: 布局/坐标换算/碰撞/掉落物理/磁吸纯逻辑层"
```

---

### Task 6: hotbar.js 纯逻辑（库存/合成判定）+ door.js 门状态机（TDD）

**Files:**
- Create: `public/js/hotbar.js`（本任务只写纯导出；DOM/拖拽在 Task 10 追加）
- Create: `public/js/door.js`（本任务只写纯导出；仪式渲染钩子在 Task 12 追加）
- Test: `test/hotbar.test.js`、`test/door.test.js`
- 规格：§5（消耗制、共鸣只对真词、渐进共鸣）、§3.1 节拍 11-12 与 §4（门：脉动→低语掉石→咏亮→开）

- [ ] **Step 1: 写失败测试（库存/合成）**

`test/hotbar.test.js`：
```js
import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { createInventory, addStone, stoneCount, canConsume, consume, craftMatch } from '../public/js/hotbar.js';

const data = JSON.parse(await readFile(new URL('../content/chapter1.json', import.meta.url), 'utf8'));
const WORDS = data.words;

function invWith(pairs) {
  const inv = createInventory();
  for (const [ipa, n] of pairs) for (let i = 0; i < n; i++) addStone(inv, ipa);
  return inv;
}

test('库存：add/has/consume 计数精确，不出现负数', () => {
  const inv = createInventory();
  addStone(inv, 'h'); addStone(inv, 'h'); addStone(inv, 'æ');
  assert.equal(stoneCount(inv, 'h'), 2);
  assert.ok(canConsume(inv, ['h', 'æ']));
  assert.ok(consume(inv, ['h', 'æ']));
  assert.equal(stoneCount(inv, 'h'), 1);
  assert.equal(consume(inv, ['h', 'h', 'h']), false); // 不足则整体失败且不扣
  assert.equal(stoneCount(inv, 'h'), 1);
});

test('合成：正确序列命中词；乱序/缺石永不命中', () => {
  const inv = invWith([['l', 1], ['aɪ', 1], ['t', 1], ['h', 1], ['æ', 1]]);
  assert.equal(craftMatch(['l', 'aɪ', 't', null], WORDS, inv).word, 'light');
  assert.equal(craftMatch(['t', 'aɪ', 'l', null], WORDS, inv).word, null);   // 乱序
  assert.equal(craftMatch(['h', 'æ', 't', null], WORDS, inv).word, 'hat');
  assert.equal(craftMatch(['h', 'æ', null, null], WORDS, inv).word, null);   // 缺石
  assert.equal(craftMatch([null, null, null, null], WORDS, inv).word, null);
  assert.equal(craftMatch(['əʊ', 'p', 'ə', 'n'], WORDS, inv).word, null);    // 没有 p 石
});

test('合成：拖对词缀有渐进共鸣，越长越亮', () => {
  const inv = invWith([['l', 1], ['aɪ', 1], ['t', 1]]);
  assert.equal(craftMatch(['l', null, null, null], WORDS, inv).glowDepth, 1);
  assert.equal(craftMatch(['l', 'aɪ', null, null], WORDS, inv).glowDepth, 2);
  assert.equal(craftMatch(['l', 'aɪ', 't', null], WORDS, inv).glowDepth, 3);
  assert.equal(craftMatch(['l', 't', null, null], WORDS, inv).glowDepth, 1); // 只对第一颗
});

test('聪明路径：用别处捡的石也能拼 light（规格 §3.2）', () => {
  const inv = invWith([['l', 1], ['aɪ', 1], ['t', 1]]); // 来自 hello+fire+water
  const m = craftMatch(['l', 'aɪ', 't', null], WORDS, inv);
  assert.equal(m.word, 'light');
  assert.ok(consume(inv, ['l', 'aɪ', 't']));
});

test('聪明路径反例：没碰过帽架就拼不出 hat（æ 无其它来源）', () => {
  const inv = invWith([['h', 1], ['t', 1]]);
  assert.equal(craftMatch(['h', 'æ', 't', null], WORDS, inv).word, null);
});
```

- [ ] **Step 2: 写失败测试（门状态机）**

`test/door.test.js`：
```js
import { test } from 'node:test';
import assert from 'node:assert';
import { createDoor, doorEvent } from '../public/js/door.js';

test('门：5 词集齐才从沉睡进入脉动', () => {
  const d = createDoor();
  assert.equal(doorEvent(d, 'CLICK'), null);                       // 沉睡中点门无反应
  assert.equal(doorEvent(d, 'WORDS_COMPLETE', 4), null);
  const r = doorEvent(d, 'WORDS_COMPLETE', 5);
  assert.equal(d.state, 'pulsing'); assert.ok(r.entered);
});

test('门：脉动时点击 → 低语 + 只掉一次 open 石', () => {
  const d = createDoor();
  doorEvent(d, 'WORDS_COMPLETE', 5);
  const r1 = doorEvent(d, 'CLICK');
  assert.equal(d.state, 'whispered');
  assert.ok(r1.whisper && r1.dropOpenStones);
  const r2 = doorEvent(d, 'CLICK');
  assert.ok(r2.whisper); assert.equal(r2.dropOpenStones, undefined); // 可反复听，不再掉
});

test('门：拖错词具 → 咕哝不解锁；拖 open → 仪式 → 开启', () => {
  const d = createDoor();
  doorEvent(d, 'WORDS_COMPLETE', 5);
  doorEvent(d, 'CLICK');
  assert.deepEqual(doorEvent(d, 'OFFER', 'water'), { mutter: true });
  assert.equal(d.state, 'whispered');
  const r = doorEvent(d, 'OFFER', 'open');
  assert.equal(d.state, 'ritual'); assert.ok(r.ritual);
  doorEvent(d, 'RITUAL_DONE');
  assert.equal(d.state, 'opening');
  doorEvent(d, 'OPEN_DONE');
  assert.equal(d.state, 'opened');
  assert.deepEqual(doorEvent(d, 'OFFER', 'open'), { mutter: true }); // 开过不再响应
});
```

- [ ] **Step 3: 跑测试确认失败**

Run: `node --test test/hotbar.test.js test/door.test.js`
Expected: FAIL（模块不存在）。

- [ ] **Step 4: 实现 hotbar.js 纯逻辑层（DOM 在 Task 10 追加到同一文件）**

`public/js/hotbar.js` 文件头：
```js
// —— 库存（消耗制，规格 §5）——
export function createInventory() {
  return { stones: new Map(), items: new Map(), everPicked: new Set(), order: [] };
}
export function addStone(inv, ipa) {
  inv.stones.set(ipa, (inv.stones.get(ipa) || 0) + 1);
  if (!inv.order.includes(ipa)) inv.order.push(ipa);
}
export function stoneCount(inv, ipa) { return inv.stones.get(ipa) || 0; }
export function totalStones(inv) {
  let n = 0; for (const c of inv.stones.values()) n += c; return n;
}
export function canConsume(inv, seq) {
  const need = new Map();
  for (const p of seq) need.set(p, (need.get(p) || 0) + 1);
  for (const [p, n] of need) if (stoneCount(inv, p) < n) return false;
  return true;
}
export function consume(inv, seq) {
  if (!canConsume(inv, seq)) return false;
  for (const p of seq) inv.stones.set(p, stoneCount(inv, p) - 1);
  return true;
}

// —— 合成判定：从首槽起连续命中才共鸣；渐进共鸣=最长正确前缀（规格 §5）——
export function craftMatch(slots, words, inv) {
  let best = 0, matched = null;
  for (const [w, def] of Object.entries(words)) {
    const seq = def.phonemes.map(p => p[0]);
    if (seq.length > slots.length) continue;
    let lead = 0, ok = true;
    for (let i = 0; i < seq.length; i++) {
      if (slots[i] === seq[i]) { lead++; } else { ok = false; break; }
    }
    if (ok) {
      if (!slots.slice(seq.length).every(s => s == null)) ok = false;       // 尾槽必须空
      if (ok && !canConsume(inv, seq)) ok = false;                           // 库存必须够
      if (ok) matched = w;
    }
    best = Math.max(best, lead);
  }
  return { word: matched, glowDepth: best };
}
```

- [ ] **Step 5: 实现 door.js 纯状态机（渲染在 Task 12 追加到同一文件）**

`public/js/door.js` 文件头：
```js
// 门状态机：asleep → pulsing → whispered → ritual → opening → opened（规格 §3.1/§4）
export function createDoor() {
  return { state: 'asleep', dropped: false };
}

export function doorEvent(door, ev, arg) {
  switch (ev) {
    case 'WORDS_COMPLETE':
      if (door.state === 'asleep' && arg >= 5) { door.state = 'pulsing'; return { entered: true }; }
      return null;
    case 'CLICK':
      if (door.state === 'pulsing') {
        door.state = 'whispered';
        const drop = !door.dropped;
        door.dropped = true;
        return { whisper: true, ...(drop ? { dropOpenStones: true } : {}) };
      }
      if (door.state === 'whispered' || door.state === 'ritual') return { whisper: true };
      return null;
    case 'OFFER':
      if (door.state === 'whispered' && arg === 'open') { door.state = 'ritual'; return { ritual: true }; }
      return { mutter: true };
    case 'RITUAL_DONE':
      if (door.state === 'ritual') { door.state = 'opening'; return { opening: true }; }
      return null;
    case 'OPEN_DONE':
      if (door.state === 'opening') { door.state = 'opened'; return { opened: true }; }
      return null;
    default:
      return null;
  }
}
```

- [ ] **Step 6: 跑测试**

Run: `node --test test/hotbar.test.js test/door.test.js`
Expected: hotbar 5 pass、door 3 pass。

- [ ] **Step 7: Commit**

```bash
git add public/js/hotbar.js public/js/door.js test/hotbar.test.js test/door.test.js
git commit -m "feat: 消耗制库存/合成共鸣判定/门状态机纯逻辑"
```

---

### Task 7: main.js 纯逻辑——游戏事件机（碰/拾/拼/用 + 节拍 + 提示 + 调试跳拍）（TDD）

**Files:**
- Modify: `public/js/main.js`（在文件顶部 import 区与 `boot` 之间插入纯逻辑导出；`boot` 保持文件底部）
- Test: `test/game.test.js`
- 规格：§3（节拍/门控/引导）、§4（词具使用/重复使用/拖错）、§3.2（词入书时机）

**指令词汇表（事件机 → 渲染层的全部指令，Task 13 逐条接线）：**

| 指令 | 含义 |
|---|---|
| `{t:'speak', who, text, slow?}` | who ∈ uncle/child/door；slow=放慢（提示语气） |
| `{t:'drop', word}` | 在该词来源处掉落全部音素石 |
| `{t:'hint', key}` | 更新底部提示条（content.hints[key]） |
| `{t:'beat', beat}` | 节拍变更（G.beat 调试用） |
| `{t:'hotbarShow'}` | 工具栏滑入 + 声音石袋 HUD 显示 |
| `{t:'bagPulse'}` | 袋计数 +1 脉冲 |
| `{t:'resonate', word}` | 合成共鸣四槽青光波 |
| `{t:'itemIn', word}` | 词具飞入工具栏 |
| `{t:'doorAwake'}` | 门符文开始青色脉动 |
| `{t:'mutter'}` | 目标低沉咕哝（无红叉） |
| `{t:'effect', name, full}` | name ∈ greet/bloom/ignite/wear/illuminate/unlock；full=首次完整/重复轻反应 |
| `{t:'ritualStart'}` | 门上四石绕拱咏亮仪式开始 |
| `{t:'openAnim'}` | 门板收窄 + 金光（揭示卡确认后） |
| `{t:'summary'}` | 结算卡 |
| `{t:'cat'}` | 猫：喵 + 竖耳 |
| `{t:'blocked', id}` | 黑暗区目标不可交互（角色原地歪头） |
| `{t:'pointHotbar'}` | 大叔指工具栏手势 |

- [ ] **Step 1: 写失败测试**

`test/game.test.js`：
```js
import { test } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { createGame, startGame, gameEvent, chooseTease, jump } from '../public/js/main.js';

const content = JSON.parse(await readFile(new URL('../content/chapter1.json', import.meta.url), 'utf8'));
const seq = w => content.words[w].phonemes.map(p => p[0]);

function collect(g, word) { // 模拟：碰来源→捡全部石→合成
  const [id] = Object.entries(content.explorables).find(([, ex]) => ex.word === word);
  let out = gameEvent(g, 'INTERACT', id);
  for (const [ipa] of content.words[word].phonemes) out = out.concat(gameEvent(g, 'PICKUP', ipa));
  return out.concat(gameEvent(g, 'CRAFT', word));
}

test('开局：大叔只出声招手，提示「走过去点他」', () => {
  const g = createGame(content);
  const out = startGame(g);
  assert.ok(out.some(i => i.t === 'speak' && i.who === 'uncle' && i.text === 'Hello! Hello!'));
  assert.ok(out.some(i => i.t === 'hint' && i.key === 'hello'));
});

test('首点大叔：hello 入书 + 掉四石 + 进入自由探索', () => {
  const g = createGame(content);
  const out = gameEvent(g, 'INTERACT', 'npc');
  assert.ok(g.book.has('hello'));
  assert.ok(out.some(i => i.t === 'drop' && i.word === 'hello'));
  assert.equal(g.beat, 'explore-left');
});

test('黑暗中帽架不可交互；点亮后可碰', () => {
  const g = createGame(content);
  assert.ok(gameEvent(g, 'INTERACT', 'hatstand').some(i => i.t === 'blocked'));
  g.lit = true;
  assert.ok(gameEvent(g, 'INTERACT', 'hatstand').some(i => i.t === 'drop' && i.word === 'hat'));
});

test('首石：工具栏滑入恰好一次；合成 light 聪明路径可行', () => {
  const g = createGame(content);
  let all = [];
  for (const w of ['hello', 'fire', 'water']) all = all.concat(collect(g, w)); // l/hello aɪ/fire t/water
  assert.equal(all.filter(i => i.t === 'hotbarShow').length, 1);  // 首颗石时滑入一次
  for (const [ipa] of ['l', 'aɪ', 't']) all = all.concat(gameEvent(g, 'PICKUP', ipa));
  const out = gameEvent(g, 'CRAFT', 'light');
  assert.ok(g.inv.items.has('light') && g.book.has('light'));
  assert.ok(out.some(i => i.t === 'resonate' && i.word === 'light'));
  assert.ok(out.some(i => i.t === 'speak' && i.who === 'child'));
});

test('USE：词具匹配目标才生效；首次 full、重复轻反应；拖错咕哝', () => {
  const g = createGame(content);
  collect(g, 'hello'); collect(g, 'fire'); collect(g, 'water');
  for (const [ipa] of ['l', 'aɪ', 't']) gameEvent(g, 'PICKUP', ipa);
  gameEvent(g, 'CRAFT', 'light');
  let out = gameEvent(g, 'USE', { word: 'light', target: 'well' });
  assert.ok(out.some(i => i.t === 'mutter'));
  out = gameEvent(g, 'USE', { word: 'light', target: 'lamp' });
  assert.equal(g.lit, true);
  assert.ok(out.some(i => i.t === 'effect' && i.name === 'illuminate' && i.full === true));
  out = gameEvent(g, 'USE', { word: 'light', target: 'lamp' });
  assert.ok(out.some(i => i.t === 'effect' && i.full === false));
});

test('门醒需 5 词；点击低语并只掉一次 open 石；全链路到结算', () => {
  const g = createGame(content);
  for (const w of ['hello', 'water', 'fire', 'light']) collect(g, w);
  assert.equal(g.door.state, 'asleep');
  collect(g, 'hat');                                             // 第 5 词入书
  assert.equal(g.door.state, 'pulsing');
  let out = gameEvent(g, 'DOOR_CLICK');
  assert.ok(out.some(i => i.t === 'drop' && i.word === 'open'));
  assert.ok(out.some(i => i.t === 'speak' && i.who === 'door'));
  out = gameEvent(g, 'DOOR_CLICK');
  assert.ok(!out.some(i => i.t === 'drop'));                     // 反复听，不再掉
  collect(g, 'open');
  out = gameEvent(g, 'USE', { word: 'open', target: 'door' });
  assert.ok(out.some(i => i.t === 'ritualStart'));
  gameEvent(g, 'RITUAL_DONE');
  assert.equal(g.door.state, 'opening');
  out = gameEvent(g, 'OPEN_DONE');
  assert.ok(out.some(i => i.t === 'summary'));
  assert.equal(g.book.size, 6);
});

test('乱序合成无死局：收齐全部石后按倒序拼，六词全成（规格 §3.2）', () => {
  const g = createGame(content);
  const sources = ['hello', 'water', 'fire', 'light', 'hat'];
  for (const w of sources) {
    const [id] = Object.entries(content.explorables).find(([, ex]) => ex.word === w);
    if (id === 'hatstand') g.lit = true;
    gameEvent(g, 'INTERACT', id);
    for (const [ipa] of seq(w)) gameEvent(g, 'PICKUP', ipa);
  }
  gameEvent(g, 'DOOR_CLICK');
  for (const [ipa] of seq('open')) gameEvent(g, 'PICKUP', ipa);
  for (const w of ['open', 'hat', 'light', 'fire', 'water', 'hello']) {
    gameEvent(g, 'CRAFT', w);
    assert.ok(g.inv.items.has(w), `倒序合成失败: ${w}`);
  }
});

test('卡关提示：先报未收集词，再报「该拼词了」，门醒后报门', () => {
  const g = createGame(content);
  gameEvent(g, 'INTERACT', 'npc');
  assert.equal(chooseTease(g).kind, 'word');
  for (const w of ['hello', 'water', 'fire', 'light', 'hat']) collect(g, w === 'hat' ? 'hat' : w);
  gameEvent(g, 'DOOR_CLICK');
  for (const [ipa] of seq('open')) gameEvent(g, 'PICKUP', ipa);
  // 全部来源已碰、门石已捡：只剩拼词
  assert.equal(chooseTease(g).kind, 'craft');
  const g2 = createGame(content);
  for (const w of ['hello', 'water', 'fire', 'light', 'hat']) collect(g2, w);
  assert.equal(chooseTease(g2).kind, 'door');
});

test('jump 调试拍：lit-right / door-awake / door-open / summary 状态正确', () => {
  const g = createGame(content);
  jump(g, 'lit-right');
  assert.equal(g.lit, true);
  assert.equal(g.book.size, 4);
  jump(g, 'door-awake');
  assert.equal(g.book.size, 5);
  assert.ok(['pulsing', 'whispered'].includes(g.door.state));
  jump(g, 'door-open');
  assert.equal(g.inv.items.has('open'), true);
  assert.ok(['opening', 'opened'].includes(g.door.state));
  jump(g, 'summary');
  assert.equal(g.door.state, 'opened');
});
```
说明：`collect()` 会按「碰→捡全部→合成」整词走完，hello 的 l 石在流程内已被捡起，故「首石」断言统计整个指令流的 `hotbarShow` 恰好一次。

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/game.test.js`
Expected: FAIL（`createGame` 未导出）。

- [ ] **Step 3: 在 main.js 顶部实现事件机（boot 之前）**

在 `public/js/main.js` 的 import 区加入，并插入以下代码（置于 `loadContent` 之后、`boot` 之前）：
```js
import { createInventory, addStone, stoneCount, canConsume, consume, craftMatch } from './hotbar.js';
import { createDoor, doorEvent } from './door.js';

const cap = w => w[0].toUpperCase() + w.slice(1) + '.';

// —— 游戏状态机（纯逻辑，规格 §3/§4；指令表见计划）——
export function createGame(content) {
  return {
    content, beat: 'hello-listen',
    book: new Set(), touched: new Set(),
    inv: createInventory(),
    stonesPicked: 0, lit: false,
    door: createDoor(), usedTargets: new Set(),
    hatOn: false, torchesLit: false, bloomed: false, greeted: false,
    teaseClock: 0
  };
}

export function startGame(g) {
  g.beat = 'hello-listen';
  return [
    { t: 'speak', who: 'uncle', text: g.content.explorables.npc.lines[0] },
    { t: 'hint', key: 'hello' }
  ];
}

export function chooseTease(g) {
  const c = g.content;
  for (const [id, ex] of Object.entries(c.explorables)) {
    if (id === 'npc' || g.touched.has(id)) continue;
    if (ex.requires === 'lit' && !g.lit) continue;
    return { kind: 'word', word: ex.word };
  }
  for (const w of Object.keys(c.words)) {
    if (g.inv.items.has(w)) continue;
    if (canConsume(g.inv, c.words[w].phonemes.map(p => p[0]))) return { kind: 'craft', word: w };
  }
  if ((g.door.state === 'pulsing' || g.door.state === 'whispered') && !g.inv.items.has('open')) return { kind: 'door' };
  return null;
}

function teaseOut(g) {
  const c = g.content;
  const tease = chooseTease(g);
  if (!tease) return [{ t: 'speak', who: 'uncle', text: c.explorables.npc.lines[0] }];
  if (tease.kind === 'word') return [{ t: 'speak', who: 'uncle', text: c.npcTease[tease.word], slow: true }];
  if (tease.kind === 'door') return [{ t: 'speak', who: 'uncle', text: c.door.listen[0], slow: true }];
  return [{ t: 'speak', who: 'uncle', text: cap(tease.word), slow: true }, { t: 'pointHotbar' }];
}

export function gameEvent(g, ev, arg = null) {
  const c = g.content;
  switch (ev) {
    case 'INTERACT': {
      const id = arg;
      if (id === 'cat') return [{ t: 'cat' }];
      if (id === 'npc') {
        if (!g.touched.has('npc')) {
          g.touched.add('npc');
          g.book.add('hello');                                  // 词入书时机①：hello=首点大叔
          g.beat = 'explore-left';
          return [
            { t: 'speak', who: 'uncle', text: c.explorables.npc.linesFirst[0] },
            { t: 'drop', word: 'hello' },
            { t: 'hint', key: 'explore' },
            { t: 'beat', beat: 'explore-left' }
          ];
        }
        return teaseOut(g);
      }
      const ex = c.explorables[id];
      if (!ex) return [];
      if (ex.requires === 'lit' && !g.lit) return [{ t: 'blocked', id }];
      if (!g.touched.has(id)) {
        g.touched.add(id);
        return [
          { t: 'speak', who: 'uncle', text: ex.lines[0] },
          { t: 'drop', word: ex.word }
        ];
      }
      return [{ t: 'speak', who: 'uncle', text: ex.lines[0] }];
    }
    case 'PICKUP': {
      addStone(g.inv, arg);
      g.inv.everPicked.add(arg);
      g.stonesPicked++;
      const out = [{ t: 'bagPulse' }];
      if (g.stonesPicked === 1) {
        g.beat = 'first-stone';
        out.push({ t: 'hotbarShow' }, { t: 'hint', key: 'firstStone' }, { t: 'beat', beat: 'first-stone' });
      }
      return out;
    }
    case 'CRAFT': {
      const word = arg;
      if (g.inv.items.has(word)) return [];
      const phon = c.words[word].phonemes.map(p => p[0]);
      if (!canConsume(g.inv, phon)) return [];
      consume(g.inv, phon);
      g.inv.items.set(word, true);
      g.book.add(word);                                         // 词入书时机②：其余词=合成成功
      const out = [
        { t: 'resonate', word },
        { t: 'speak', who: 'child', text: cap(word) },
        { t: 'itemIn', word }
      ];
      if (!g.door.dropped && g.book.size >= 5 && g.door.state === 'asleep') {
        doorEvent(g.door, 'WORDS_COMPLETE', g.book.size);
        out.push({ t: 'doorAwake' }, { t: 'hint', key: 'doorAwake' }, { t: 'beat', beat: 'door-awake' });
      }
      if (word === 'open') out.push({ t: 'hint', key: 'door' });
      return out;
    }
    case 'USE': {
      const { word, target } = arg;
      const def = c.words[word]?.use;
      if (!def || target !== def.target) return [{ t: 'mutter' }];
      const full = !g.usedTargets.has(target);
      const out = [{ t: 'speak', who: 'child', text: cap(word) }];
      if (full) {
        g.usedTargets.add(target);
        if (def.effect === 'illuminate') { g.lit = true; g.beat = 'lit-right'; }
        if (def.effect === 'wear') g.hatOn = true;
        if (def.effect === 'bloom') g.bloomed = true;
        if (def.effect === 'ignite') g.torchesLit = true;
        if (def.effect === 'greet') g.greeted = true;
        if (def.effect === 'unlock') {
          const r = doorEvent(g.door, 'OFFER', 'open');
          if (r?.ritual) return out.concat([{ t: 'ritualStart' }]);
          return [{ t: 'mutter' }];
        }
        out.push({ t: 'effect', name: def.effect, full: true });
        if (def.effect === 'illuminate') out.push({ t: 'hint', key: 'litUp' }, { t: 'beat', beat: 'lit-right' });
      } else {
        out.push({ t: 'effect', name: def.effect, full: false });
      }
      return out;
    }
    case 'DOOR_CLICK': {
      const r = doorEvent(g.door, 'CLICK');
      if (!r) return [];
      const out = [{ t: 'speak', who: 'door', text: c.door.listen[0] }];
      if (r.dropOpenStones) out.push({ t: 'drop', word: 'open' }, { t: 'hint', key: 'door' });
      return out;
    }
    case 'RITUAL_DONE': {
      doorEvent(g.door, 'RITUAL_DONE');
      return [{ t: 'openAnim' }];
    }
    case 'OPEN_DONE': {
      doorEvent(g.door, 'OPEN_DONE');
      g.beat = 'summary';
      return [{ t: 'summary' }];
    }
    case 'TICK': {
      g.teaseClock += arg;
      if (g.teaseClock < 45) return [];
      g.teaseClock = 0;
      return teaseOut(g);
    }
    default:
      return [];
  }
}

// —— 调试跳拍（?autostart + G.jump，规格 §11.7）——
export function jump(g, beat) {
  const c = g.content;
  const doWord = word => {
    const [id] = Object.entries(c.explorables).find(([, ex]) => ex.word === word);
    let out = gameEvent(g, 'INTERACT', id);
    for (const [ipa] of c.words[word].phonemes) out = out.concat(gameEvent(g, 'PICKUP', ipa));
    return out.concat(gameEvent(g, 'CRAFT', word));
  };
  switch (beat) {
    case 'hello-meet': return doWord('hello');
    case 'explore-left': return [];
    case 'lit-right': {
      let out = [];
      for (const w of ['hello', 'water', 'fire', 'light']) out = out.concat(doWord(w));
      return out.concat(gameEvent(g, 'USE', { word: 'light', target: 'lamp' }));
    }
    case 'door-awake':
      return jump(g, 'lit-right').concat(doWord('hat'), gameEvent(g, 'DOOR_CLICK'));
    case 'door-open':
      return jump(g, 'door-awake').concat(doWord('open'), gameEvent(g, 'USE', { word: 'open', target: 'door' }), gameEvent(g, 'RITUAL_DONE'));
    case 'summary':
      return jump(g, 'door-open').concat(gameEvent(g, 'OPEN_DONE'));
    default:
      return [];
  }
}
```

- [ ] **Step 4: 跑测试**

Run: `node --test test/game.test.js`
Expected: 10 pass。若「首石」断言因测试说明中的捡石顺序不成立，按该测试尾部说明调整断言位置（hotbarShow 全程恰好一次）。

- [ ] **Step 5: 全量回归**

Run: `node --test`
Expected: 此前所有测试仍 pass。

- [ ] **Step 6: Commit**

```bash
git add public/js/main.js test/game.test.js
git commit -m "feat: 游戏事件机（碰/拾/拼/用/门/提示/跳拍）纯逻辑与全套测试"
```

---

### Task 8: scene.js 渲染层——静态预渲染/黑暗遮罩/动态层（目检）

**Files:**
- Modify: `public/js/scene.js`（在 Task 5 纯逻辑之后追加渲染；文件继续不触碰顶层 DOM）
- 规格：§6（布局/光照/黑暗剪影/1.2s 光潮）、§9A（元气骑士厚描边）、§11.6（60fps：静态层一次性预渲染）

- [ ] **Step 1: 在 scene.js 末尾追加渲染代码**

```js
// ================= 渲染层（DOM 只在函数内） =================
import { PAL, drawRune } from './art.js';

const LIGHT_CENTER = { x: 740, y: 350 };   // 灯柱悬臂灯头

function thick(ctx, w = 5, color = PAL.ink) {
  ctx.lineWidth = w; ctx.strokeStyle = color; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
}

export function prerenderStatic() {
  const c = document.createElement('canvas');
  c.width = LAYOUT.W; c.height = LAYOUT.H;
  const x = c.getContext('2d');
  // —— 地板：64px 棋盘 + 石缝 + 裂缝 ——
  for (let gy = 0; gy * 64 < LAYOUT.H; gy++) {
    for (let gx = 0; gx * 64 < LAYOUT.W; gx++) {
      x.fillStyle = (gx + gy) % 2 ? PAL.floorA : PAL.floorB;
      x.fillRect(gx * 64, Math.max(300, gy * 64), 64, 64);
    }
  }
  x.strokeStyle = PAL.floorLine; x.lineWidth = 2;
  const r = rng(42);
  for (let i = 0; i < 26; i++) {
    const px = r() * LAYOUT.W, py = 300 + r() * (LAYOUT.H - 320), a = r() * 6.28, len = 14 + r() * 26;
    x.strokeStyle = PAL.crack; x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(px, py);
    x.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len * 0.4); x.stroke();
  }
  // —— 墙：上半 300px 砖墙 ——
  x.fillStyle = PAL.wallA; x.fillRect(0, 0, LAYOUT.W, 300);
  x.strokeStyle = PAL.wallB; x.lineWidth = 2;
  for (let ry = 0; ry < 300; ry += 50) {
    x.beginPath(); x.moveTo(0, ry); x.lineTo(LAYOUT.W, ry); x.stroke();
    for (let bx = ((ry / 50) % 2) * 55; bx < LAYOUT.W; bx += 110) {
      x.beginPath(); x.moveTo(bx, ry); x.lineTo(bx, ry + 50); x.stroke();
    }
  }
  x.fillStyle = PAL.wallDark; x.fillRect(0, 272, LAYOUT.W, 28);      // 墙脚阴影
  // —— 月窗（拱形 + 夜空 + 月亮星星）——
  x.save();
  x.beginPath();
  x.moveTo(270, 210); x.arc(330, 165, 60, Math.PI, 0); x.lineTo(390, 210); x.closePath();
  x.fillStyle = PAL.night; x.fill();
  thick(x, 8, PAL.stoneD); x.stroke();
  x.beginPath(); x.arc(352, 150, 22, 0, 7); x.fillStyle = PAL.moon; x.fill();
  x.fillStyle = 'rgba(0,0,0,.12)';
  x.beginPath(); x.arc(345, 145, 5, 0, 7); x.fill();
  x.beginPath(); x.arc(358, 156, 3.5, 0, 7); x.fill();
  const rs = rng(7);
  x.fillStyle = 'rgba(244,240,216,.9)';
  for (let i = 0; i < 7; i++) { x.fillRect(284 + rs() * 88, 128 + rs() * 66, 2.5, 2.5); }
  x.restore();
  // —— 墙上符文刻痕 ——
  const glyphs = Object.values({ a: 'ᚱ', b: 'ᚹ', c: 'ᚦ', d: 'ᛟ', e: 'ᚷ', f: 'ᛞ', g: 'ᛚ', h: 'ᛝ' });
  glyphs.forEach((g, i) => drawRune(x, g, 520 + i * 52, 80, 26, 'rgba(30,32,44,.55)', 3));
  // —— 中央红地毯（金边双环）——
  x.beginPath(); x.ellipse(640, 545, 175, 82, 0, 0, 7); x.fillStyle = PAL.rug; x.fill();
  thick(x, 5, PAL.rugGold); x.stroke();
  x.beginPath(); x.ellipse(640, 545, 158, 70, 0, 0, 7); x.strokeStyle = PAL.rugGold; x.lineWidth = 3; x.stroke();
  x.beginPath(); x.ellipse(640, 545, 146, 62, 0, 0, 7); x.fillStyle = PAL.rugDark; x.fill();
  // —— 井（石圈+木架+绳桶+水光）——
  x.beginPath(); x.ellipse(210, 480, 52, 30, 0, 0, 7); x.fillStyle = PAL.stone; x.fill(); thick(x, 5); x.stroke();
  x.beginPath(); x.ellipse(210, 480, 36, 20, 0, 0, 7); x.fillStyle = PAL.night; x.fill();
  x.beginPath(); x.ellipse(210, 481, 24, 12, 0, 0, 7); x.fillStyle = PAL.waterD; x.fill();
  thick(x, 6, PAL.wood2);
  x.beginPath(); x.moveTo(170, 470); x.lineTo(178, 380); x.lineTo(242, 380); x.lineTo(250, 470); x.stroke();
  x.beginPath(); x.moveTo(172, 396); x.lineTo(248, 396); x.stroke();
  x.strokeStyle = '#c9b18a'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(210, 382); x.lineTo(210, 428); x.stroke();
  x.strokeRect(200, 428, 20, 16);
  // —— 火盆（三足铁盆，火苗动态画）——
  x.beginPath(); x.ellipse(480, 486, 44, 26, 0, 0, 7); x.fillStyle = PAL.stoneD; x.fill(); thick(x, 5); x.stroke();
  x.beginPath(); x.ellipse(480, 478, 30, 16, 0, 0, 7); x.fillStyle = '#3a3028'; x.fill();
  thick(x, 5, PAL.wood2);
  for (const dx of [-30, 0, 30]) {
    x.beginPath(); x.moveTo(480 + dx, 500); x.lineTo(480 + dx * 1.3, 522); x.stroke();
  }
  // —— 灯柱（柱+悬臂+吊灯笼架，火苗动态画）——
  thick(x, 7, PAL.wood2);
  x.beginPath(); x.moveTo(620, 480); x.lineTo(620, 320); x.stroke();          // 立柱
  x.beginPath(); x.moveTo(620, 322); x.lineTo(744, 330); x.stroke();          // 悬臂
  x.strokeStyle = '#c9b18a'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(620, 324); x.lineTo(742, 300); x.stroke();          // 拉索
  x.beginPath(); x.moveTo(740, 332); x.lineTo(740, 350); x.stroke();          // 吊杆
  // 灯头笼
  x.fillStyle = PAL.wood;
  x.beginPath();
  x.moveTo(722, 352); x.lineTo(758, 352); x.lineTo(752, 386); x.lineTo(728, 386); x.closePath();
  x.fill(); thick(x, 4); x.stroke();
  // 拉闸开关（柱身）
  x.strokeStyle = PAL.ink; x.lineWidth = 4;
  x.beginPath(); x.moveTo(600, 400); x.lineTo(588, 412); x.stroke();
  x.beginPath(); x.arc(588, 412, 4, 0, 7); x.fillStyle = PAL.ink; x.fill();
  // —— 枯苗陶盆（花动态画）——
  x.fillStyle = '#b06a3f';
  x.beginPath();
  x.moveTo(312, 566); x.lineTo(348, 566); x.lineTo(342, 590); x.lineTo(318, 590); x.closePath();
  x.fill(); thick(x, 4); x.stroke();
  // —— 右墙拱门石框（木门动态画：开门动画）——
  x.fillStyle = PAL.stone;
  x.beginPath();
  x.moveTo(1090, 500); x.lineTo(1090, 430); x.arc(1145, 430, 55, Math.PI, 0); x.lineTo(1200, 500); x.closePath();
  x.fill(); thick(x, 6, PAL.stoneD); x.stroke();
  return c;
}

export function makeDarkness() {
  const c = document.createElement('canvas');
  c.width = LAYOUT.W; c.height = LAYOUT.H;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(LIGHT_CENTER.x, LIGHT_CENTER.y, 60, LIGHT_CENTER.x, LIGHT_CENTER.y, 620);
  g.addColorStop(0, 'rgba(6,7,11,0)');
  g.addColorStop(0.55, 'rgba(6,7,11,.35)');
  g.addColorStop(1, 'rgba(6,7,11,.96)');
  x.fillStyle = g;
  x.fillRect(0, 0, LAYOUT.W, LAYOUT.H);
  const fade = x.createLinearGradient(430, 0, 560, 0);               // 左半不受暗角
  fade.addColorStop(0, 'rgba(6,7,11,1)'); fade.addColorStop(1, 'rgba(6,7,11,0)');
  x.globalCompositeOperation = 'destination-out';
  x.fillStyle = fade;
  x.fillRect(0, 0, 560, LAYOUT.H);
  x.globalCompositeOperation = 'source-over';
  return c;
}

// —— 场景对象（游戏持有）——
export function createScene() {
  const dust = [];
  const r = rng(99);
  for (let i = 0; i < 34; i++) dust.push({ x: r() * LAYOUT.W, y: 200 + r() * 480, v: 6 + r() * 14, ph: r() * 6.28 });
  return { static: null, darkness: null, dust, lit: 0, doorOpen: 0 };
}

export function initScene(sc) {           // boot 时调用（需要 document）
  sc.static = prerenderStatic();
  sc.darkness = makeDarkness();
}

export function updateScene(sc, dt, litTarget) {
  sc.lit += clamp(litTarget - sc.lit, -dt / 1.2, dt / 1.2);          // 1.2s 光潮（规格 §6.2）
  for (const d of sc.dust) {
    d.y -= d.v * dt; d.x += Math.sin(d.ph + d.y / 40) * 0.2;
    if (d.y < 180) { d.y = 690; d.x = Math.random() * LAYOUT.W; }
  }
}

function flame(x, cx, cy, size, t, seed) {
  const f = Math.sin(t * 13 + seed) * 0.12 + 1;
  x.beginPath();
  x.moveTo(cx, cy - size * f);
  x.bezierCurveTo(cx + size * 0.55, cy - size * 0.25, cx + size * 0.42, cy + size * 0.3, cx, cy + size * 0.34);
  x.bezierCurveTo(cx - size * 0.42, cy + size * 0.3, cx - size * 0.55, cy - size * 0.25, cx, cy - size * f);
  x.closePath();
  x.fillStyle = PAL.fire2; x.fill();
  x.beginPath();
  x.moveTo(cx, cy - size * 0.3 * f);
  x.bezierCurveTo(cx + size * 0.24, cy, cx + size * 0.2, cy + size * 0.26, cx, cy + size * 0.3);
  x.bezierCurveTo(cx - size * 0.2, cy + size * 0.26, cx - size * 0.24, cy, cx, cy - size * 0.3 * f);
  x.closePath();
  x.fillStyle = PAL.fireCore; x.fill();
}

function glow(x, cx, cy, r, color, alpha) {
  const g = x.createRadialGradient(cx, cy, 2, cx, cy, r);
  g.addColorStop(0, color.replace('ALPHA', String(alpha)));
  g.addColorStop(1, color.replace('ALPHA', '0'));
  x.fillStyle = g;
  x.beginPath(); x.arc(cx, cy, r, 0, 7); x.fill();
}

function drawTorch(x, tx, ty, lit, t, seed) {
  thick(x, 5, PAL.wood2);
  x.beginPath(); x.moveTo(tx, ty + 34); x.lineTo(tx, ty + 6); x.stroke();     // 柄
  x.fillStyle = lit ? PAL.fire1 : PAL.stoneD;
  x.beginPath(); x.ellipse(tx, ty, 9, 12, 0, 0, 7); x.fill(); thick(x, 4); x.stroke();
  if (lit) { flame(x, tx, ty - 4, 22, t, seed); glow(x, tx, ty - 6, 90, 'rgba(255,179,71,ALPHA)', 0.28); }
}

// view：{ t, lit, doorState, doorPulse(0..1), doorOpen(0..1), torchesLit, bloomed, hatOn }
export function drawScene(x, sc, view) {
  const { t } = view;
  x.drawImage(sc.static, 0, 0);
  const dim = 0.08 + view.lit * 0.92;                                       // 剪影 8% → 全亮
  // —— 暗区物件（帽架/右墙火把/木门）：按 lit 淡入 ——
  x.save();
  x.globalAlpha = dim;
  // 帽架
  thick(x, 6, PAL.wood2);
  x.beginPath(); x.moveTo(980, 570); x.lineTo(980, 470); x.stroke();
  x.beginPath(); x.moveTo(980, 478); x.lineTo(950, 466); x.stroke();
  if (!view.hatOn) {                                                        // 草帽还在架上
    x.fillStyle = PAL.hat;
    x.beginPath(); x.ellipse(980, 462, 34, 10, 0, 0, 7); x.fill(); thick(x, 4); x.stroke();
    x.beginPath(); x.moveTo(958, 462); x.quadraticCurveTo(980, 424, 1002, 462); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = PAL.hatD; x.fillRect(960, 458, 40, 6);
  }
  drawTorch(x, 900, 190, view.torchesLit, t, 3);
  drawTorch(x, 1060, 190, view.torchesLit, t, 4);
  // 木门（绕左轴收窄，规格 §6.3）
  x.save();
  x.translate(1096, 0);
  x.scale(Math.max(0.06, 1 - view.doorOpen * 0.94), 1);
  x.translate(-1096, 0);
  x.fillStyle = PAL.wood;
  x.fillRect(1096, 442, 96, 58);
  x.strokeStyle = PAL.wood2; x.lineWidth = 3;
  for (const bx of [1096, 1120, 1144, 1168]) { x.beginPath(); x.moveTo(bx, 442); x.lineTo(bx, 500); x.stroke(); }
  x.fillStyle = PAL.wood3;
  x.beginPath(); x.moveTo(1096, 442); x.arc(1144, 442, 48, Math.PI, 0); x.lineTo(1192, 442); x.closePath(); x.fill(); x.stroke();
  x.fillStyle = '#565b63';
  x.fillRect(1096, 452, 96, 8); x.fillRect(1096, 480, 96, 8);               // 铁箍
  drawRune(x, 'ᛟ', 1144, 462, 40, view.doorState === 'asleep' ? 'rgba(30,32,44,.8)' : PAL.glowRune, view.doorState === 'asleep' ? 5 : 6);
  x.restore();
  x.restore();
  // —— 门后金光（开门时）——
  if (view.doorOpen > 0.05) {
    x.save();
    x.globalAlpha = view.doorOpen;
    const g = x.createLinearGradient(1090, 300, 1090, 520);
    g.addColorStop(0, 'rgba(255,211,107,0)'); g.addColorStop(0.5, 'rgba(255,225,150,.85)'); g.addColorStop(1, 'rgba(255,211,107,0)');
    x.fillStyle = g;
    x.fillRect(1096, 405, 96, 100);
    for (let i = 0; i < 12; i++) {
      const py = 500 - ((t * 40 + i * 37) % 110);
      x.globalAlpha = view.doorOpen * 0.8;
      x.fillStyle = PAL.gold;
      x.fillRect(1102 + (i * 37) % 84, py, 3, 3);
    }
    x.restore();
  }
  // —— 门符文脉动 ——
  if (view.doorState === 'pulsing' || view.doorState === 'whispered') {
    glow(x, 1144, 462, 60 + view.doorPulse * 26, 'rgba(84,224,200,ALPHA)', 0.22 + view.doorPulse * 0.2);
  }
  // —— 火光们 ——
  flame(x, 480, 470, 30, t, 1); glow(x, 480, 472, 130, 'rgba(255,140,60,ALPHA)', 0.3);   // 火盆
  drawTorch(x, 140, 190, true, t, 5); drawTorch(x, 300, 190, true, t, 6);                // 左墙火把恒亮
  if (view.lit > 0.02) {                                                                  // 灯柱灯头
    x.save(); x.globalAlpha = view.lit;
    flame(x, 740, 362, 20, t, 2);
    glow(x, 740, 364, 200, 'rgba(255,210,122,ALPHA)', 0.34);
    x.restore();
  }
  // —— 枯苗/花 ——
  if (view.bloomed) {
    for (const [fx, fy, s] of [[320, 556, 1], [336, 548, 0.8], [350, 558, 0.9]]) {
      x.strokeStyle = PAL.leaf; x.lineWidth = 3;
      x.beginPath(); x.moveTo(fx, 566); x.quadraticCurveTo(fx - 4 * s, 560, fx, 550 * s + 560 * (1 - s)); x.stroke();
      x.fillStyle = PAL.petal;
      for (let i = 0; i < 5; i++) {
        const a = i / 5 * 6.28 + Math.sin(t + fx) * 0.06;
        x.beginPath(); x.ellipse(fx + Math.cos(a) * 6 * s, (550 * s + 560 * (1 - s)) + Math.sin(a) * 6 * s, 5 * s, 5 * s, 0, 0, 7); x.fill();
      }
      x.fillStyle = PAL.gold;
      x.beginPath(); x.arc(fx, 550 * s + 560 * (1 - s), 4 * s, 0, 7); x.fill();
    }
  } else {
    x.strokeStyle = PAL.leafD; x.lineWidth = 3;
    x.beginPath(); x.moveTo(324, 566); x.quadraticCurveTo(318, 548, 306, 544); x.stroke();
    x.beginPath(); x.moveTo(336, 566); x.quadraticCurveTo(342, 552, 352, 548); x.stroke();
  }
}

// —— 覆盖层：黑暗遮罩/浮尘/暗角（必须画在角色与掉落物之后，暗区才会正确变暗）——
export function drawOverlay(x, sc, view) {
  const { t } = view;
  const dark = (1 - sc.lit) * 0.92;                                    // 两档透明度缓动（规格 §6.2）
  if (dark > 0.01) {
    x.save();
    x.globalAlpha = dark;
    x.drawImage(sc.darkness, 0, 0);
    x.restore();
  }
  x.fillStyle = 'rgba(255,233,168,.5)';
  for (const d of sc.dust) {
    const localLight = d.x < 480 ? 1 : sc.lit;
    x.globalAlpha = 0.18 + Math.abs(Math.sin(d.ph + t)) * 0.3 * localLight;
    x.fillRect(d.x, d.y, 2.4, 2.4);
  }
  x.globalAlpha = 1;
  const v = x.createRadialGradient(640, 360, 380, 640, 360, 780);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.42)');
  x.fillStyle = v;
  x.fillRect(0, 0, LAYOUT.W, LAYOUT.H);
}
```

- [ ] **Step 2: Node 冒烟（渲染函数不破坏 ESM 导入）**

Run: `node --test`
Expected: 全部旧测试仍 pass（渲染代码只在函数体内用 document，导入安全）。

- [ ] **Step 3: 浏览器目检**

Run: `node server.js` → `http://localhost:3000`
在控制台执行（临时，Task 13 前没有主循环）：
```js
import('./js/scene.js').then(m => {
  const cv = document.getElementById('game'), x = cv.getContext('2d');
  const sc = m.createScene(); m.initScene(sc);
  m.updateScene(sc, 0.016, 1);
  const view = { t: 1, lit: sc.lit, doorState: 'asleep', doorPulse: 0, doorOpen: 0, torchesLit: false, bloomed: false, hatOn: false };
  m.drawScene(x, sc, view);
  m.drawOverlay(x, sc, view);
});
```
Expected: 棋盘地板+砖墙+月窗+红毯+井+火盆（有火苗）+灯柱+左墙两支燃着火把；右半（门/帽架/右火把）只见约 8% 剪影；再把 `updateScene(sc,10,1)` 后重画 → 右半亮起。Ctrl+C 停服。

- [ ] **Step 4: Commit**

```bash
git add public/js/scene.js
git commit -m "feat: 石室场景渲染（静态预渲染/黑暗遮罩/火焰光晕/门与金光）"
```

---

### Task 9: actors.js 大叔/小孩/橘猫（厚描边 + 程序动画）（目检）

**Files:**
- Create: `public/js/actors.js`
- 规格：§6.3（角色/口型/手势/行走动画/戴帽态）

- [ ] **Step 1: 实现 actors.js**

```js
import { PAL } from './art.js';

function thick(x, w = 4.5) { x.lineWidth = w; x.strokeStyle = PAL.ink; x.lineJoin = 'round'; x.lineCap = 'round'; }
function shadow(x, cx, cy, rx) {
  x.fillStyle = 'rgba(0,0,0,.28)';
  x.beginPath(); x.ellipse(cx, cy, rx, rx * 0.34, 0, 0, 7); x.fill();
}

export function createActors() {
  return {
    player: { x: 560, y: 600, facing: 1, walkT: 0, moving: false, hatOn: false },
    npc: { x: 400, y: 430, facing: 1, mouth: 0, gesture: 'idle', gestureT: 0, gestureDur: 0 },
    cat: { x: 560, y: 560, earT: 0, meowT: 0 }
  };
}

export function setGesture(npc, name, dur = 1.6) {
  npc.gesture = name; npc.gestureT = 0; npc.gestureDur = dur;
}

export function updateActors(a, dt) {
  a.npc.gestureT += dt;
  if (a.npc.gestureT > a.npc.gestureDur) a.npc.gesture = 'idle';
  a.npc.mouth = Math.max(0, a.npc.mouth - dt * 3.2);
  a.cat.earT = Math.max(0, a.cat.earT - dt);
  a.cat.meowT = Math.max(0, a.cat.meowT - dt);
}

// —— 小孩：蓝兜帽，Q 版大头，腿部交替 ——
export function drawPlayer(x, p, t) {
  const bob = p.moving ? Math.abs(Math.sin(p.walkT * 9)) * 3 : Math.sin(t * 2) * 1.2;
  shadow(x, p.x, p.y + 2, 20);
  x.save();
  x.translate(p.x, p.y - bob);
  x.scale(p.facing, 1);
  // 腿
  thick(x, 5, PAL.ink);
  x.strokeStyle = PAL.ink; x.fillStyle = '#3a4a6b';
  const step = p.moving ? Math.sin(p.walkT * 9) * 7 : 0;
  x.fillRect(-9 + step * 0.4, -10, 7, 12);
  x.fillRect(2 - step * 0.4, -10, 7, 12);
  // 身体
  x.fillStyle = '#4a7bd4';
  x.beginPath();
  x.moveTo(-13, -8); x.quadraticCurveTo(-15, -34, 0, -36); x.quadraticCurveTo(15, -34, 13, -8); x.closePath();
  x.fill(); thick(x); x.stroke();
  // 头 + 兜帽
  x.fillStyle = '#f2c99b';
  x.beginPath(); x.arc(0, -48, 15, 0, 7); x.fill(); x.stroke();
  x.fillStyle = '#4a7bd4';
  x.beginPath();
  x.arc(0, -50, 17, Math.PI * 0.85, Math.PI * 2.15);
  x.quadraticCurveTo(-18, -38, -10, -34); x.quadraticCurveTo(0, -28, 10, -34); x.quadraticCurveTo(18, -38, 17, -50);
  x.closePath(); x.fill(); x.stroke();
  // 脸
  x.fillStyle = PAL.ink;
  x.beginPath(); x.arc(4, -48, 1.9, 0, 7); x.fill();
  x.beginPath(); x.arc(11, -48, 1.9, 0, 7); x.fill();
  x.beginPath(); x.arc(6, -43, 3.2, 0.15, Math.PI - 0.15); x.stroke();
  // 草帽（hatOn 时戴上，规格 §4）
  if (p.hatOn) {
    x.fillStyle = PAL.hat;
    x.beginPath(); x.ellipse(5, -62, 22, 7, 0, 0, 7); x.fill(); x.stroke();
    x.beginPath(); x.moveTo(-7, -61); x.quadraticCurveTo(5, -82, 17, -61); x.closePath(); x.fill(); x.stroke();
    x.fillStyle = PAL.hatD; x.fillRect(-5, -67, 24, 4);
  }
  x.restore();
}

// —— 大叔：棕袍大胡子，手势系统 ——
export function drawNpc(x, n, t) {
  const g = n.gesture, gt = n.gestureT;
  const bounce = g === 'laugh' ? Math.abs(Math.sin(gt * 10)) * 4 : Math.sin(t * 1.6) * 1.2;
  const tilt = g === 'tilt' ? Math.sin(gt * 2) * 0.12 : g === 'nod' ? Math.max(0, Math.sin(gt * 6)) * 0.2 : 0;
  shadow(x, n.x, n.y + 2, 26);
  x.save();
  x.translate(n.x, n.y - bounce);
  x.scale(n.facing, 1);
  x.rotate(tilt);
  // 腿脚
  x.fillStyle = '#4a3a2c';
  x.fillRect(-12, -8, 9, 10); x.fillRect(3, -8, 9, 10);
  // 袍身
  x.fillStyle = '#8a6a4a';
  x.beginPath();
  x.moveTo(-18, 0); x.quadraticCurveTo(-22, -40, 0, -44); x.quadraticCurveTo(22, -40, 18, 0); x.closePath();
  x.fill(); thick(x, 5); x.stroke();
  // 手臂（手势驱动）
  thick(x, 5);
  x.strokeStyle = PAL.ink; x.fillStyle = '#8a6a4a';
  const arm = (side, ang) => {
    x.save();
    x.translate(side * 15, -34);
    x.rotate(ang);
    x.beginPath(); x.roundRect ? x.roundRect(-4, 0, 8, 22, 4) : x.rect(-4, 0, 8, 22);
    x.fill(); x.stroke();
    x.fillStyle = '#f2c99b';
    x.beginPath(); x.arc(0, 24, 5, 0, 7); x.fill(); x.stroke();
    x.restore();
  };
  let la = 0.5, ra = -0.5;                                    // 下垂
  if (g === 'wave') ra = -2.2 + Math.sin(gt * 8) * 0.5;
  if (g === 'point') { ra = -1.35; la = 0.7; }
  if (g === 'laugh') { ra = -2.4 + Math.sin(gt * 10) * 0.25; la = 2.4 - Math.sin(gt * 10) * 0.25; }
  arm(-1, la); arm(1, ra);
  // 头（秃顶+侧发）
  x.fillStyle = '#e8bd8f';
  x.beginPath(); x.arc(0, -58, 16, 0, 7); x.fill(); thick(x, 5); x.stroke();
  x.fillStyle = '#b8b2a8';
  x.beginPath(); x.arc(-14, -56, 5, 0, 7); x.fill();
  x.beginPath(); x.arc(14, -56, 5, 0, 7); x.fill();
  // 大胡子 + 口型（mouth 0..1）
  x.fillStyle = '#cfc8bb';
  x.beginPath();
  x.moveTo(-13, -52); x.quadraticCurveTo(0, -30, 13, -52); x.quadraticCurveTo(0, -44, -13, -52);
  x.closePath(); x.fill(); x.stroke();
  x.fillStyle = PAL.ink;
  x.beginPath(); x.ellipse(4, -50, 2.6 + n.mouth * 2, 1.6 + n.mouth * 4, 0, 0, 7); x.fill();
  x.beginPath(); x.arc(-2, -60, 2, 0, 7); x.fill();
  x.beginPath(); x.arc(9, -60, 2, 0, 7); x.fill();
  x.restore();
}

// —— 橘猫：坐姿，竖耳+尾巴+喵 ——
export function drawCat(x, c, t) {
  shadow(x, c.x, c.y + 2, 18);
  x.save();
  x.translate(c.x, c.y);
  const ear = c.earT > 0 ? 1.25 : 1;
  // 尾巴
  thick(x, 5);
  x.strokeStyle = PAL.ink; x.fillStyle = '#e8913f';
  x.beginPath();
  x.moveTo(-14, -6);
  x.quadraticCurveTo(-30, -14 + Math.sin(t * 2.2) * 4, -26, -30 + Math.sin(t * 2.2) * 3);
  x.stroke();
  // 坐姿身体
  x.beginPath();
  x.ellipse(0, -12, 15, 13, 0, 0, 7); x.fill(); thick(x); x.stroke();
  // 头 + 耳
  x.beginPath(); x.arc(0, -30, 11, 0, 7); x.fill(); x.stroke();
  x.beginPath(); x.moveTo(-9, -37); x.lineTo(-4, -37 - 9 * ear); x.lineTo(-1, -37); x.closePath(); x.fill(); x.stroke();
  x.beginPath(); x.moveTo(1, -37); x.lineTo(4, -37 - 9 * ear); x.lineTo(9, -37); x.closePath(); x.fill(); x.stroke();
  // 脸
  x.fillStyle = PAL.ink;
  x.beginPath(); x.arc(-4, -31, 1.6, 0, 7); x.fill();
  x.beginPath(); x.arc(4, -31, 1.6, 0, 7); x.fill();
  if (c.meowT > 0) { x.beginPath(); x.ellipse(0, -26, 2.4, 3, 0, 0, 7); x.fill(); }
  else { x.beginPath(); x.moveTo(-2, -26); x.lineTo(2, -26); x.stroke(); }
  // 条纹
  x.strokeStyle = '#c4762c'; x.lineWidth = 2;
  x.beginPath(); x.moveTo(-6, -20); x.lineTo(-6, -14); x.moveTo(0, -21); x.lineTo(0, -14); x.moveTo(6, -20); x.lineTo(6, -14); x.stroke();
  x.restore();
}
```

- [ ] **Step 2: Node 冒烟**

Run: `node --test`
Expected: 全 pass（actors.js 顶层无 DOM，不影响导入链——main.js 暂未 import 它，Task 13 接线）。

- [ ] **Step 3: 浏览器目检**

Run: `node server.js` → 控制台：
```js
import('./js/actors.js').then(m => {
  const x = document.getElementById('game').getContext('2d');
  const a = m.createActors();
  m.drawPlayer(x, a.player, 1);
  m.drawNpc(x, { ...a.npc, gesture: 'wave' }, 1);
  m.drawCat(x, { ...a.cat, earT: 1 }, 1);
});
```
Expected: 蓝兜帽大头小孩、棕袍大胡子大叔（挥手臂）、坐姿橘猫各就各位；描边厚、Q 版比例；`roundRect` 分支只是兼容兜底，现代浏览器走圆角。Ctrl+C 停服。

- [ ] **Step 4: Commit**

```bash
git add public/js/actors.js
git commit -m "feat: 大叔(手势/口型)/小孩(行走bob/戴帽)/橘猫 程序动画绘制"
```

---

### Task 10: hotbar.js DOM——MC 工具栏/合成槽行/跨层拖拽（目检）

**Files:**
- Modify: `public/js/hotbar.js`（Task 6 纯逻辑之后追加 DOM 层）
- 规格：§5（工具栏/点读载词/渐进共鸣/消耗/拖拽幽灵/Pointer Events）

**模型约定（拖拽的库存语义）：** 石头拖入槽位**不动库存计数**（槽内是「引用」），但受守卫约束：同一音素在槽内的数量不得超过库存数量（`canPlace`）。合成成功的瞬间由事件机 `CRAFT` 一次性消耗（Task 7 语义不变，杜绝双重扣石）；拖回/取消=只清槽位，库存从未变化，永不丢石。

- [ ] **Step 1: 在 hotbar.js 末尾追加 DOM 层**

```js
// ================= DOM 工具栏 =================
import { iconURL } from './art.js';

const VOWELS = new Set(['iː','ɪ','e','æ','ɑː','ɒ','ɔː','ʊ','uː','ʌ','ə','ɜː','eɪ','aɪ','ɔɪ','əʊ','aʊ','ɪə','eə','ʊə']);
export const isVowel = ipa => VOWELS.has(ipa);

// 放置守卫：同一音素在槽内的数量不得超过库存数量（纯函数）
export function canPlace(slots, inv, ipa) {
  const inSlots = slots.filter(s => s === ipa).length;
  return inSlots < stoneCount(inv, ipa);
}

export function createHotbar({ words, onSpeakCarrier, onSpeakWord, onCraft, onDropItem }) {
  const el = id => document.getElementById(id);
  const root = el('hotbar'), craftRow = el('craft-row');
  const stoneBox = el('stone-cells'), itemBox = el('item-cells');
  const toggle = el('craft-toggle'), ghost = el('drag-ghost');
  const slotEls = [...craftRow.querySelectorAll('.slot')];
  const slots = [null, null, null, null];
  let inv = null;

  function refreshSlots() {
    slotEls.forEach((s, i) => {
      s.textContent = slots[i] || '';
      s.className = 'slot' + (slots[i] ? ' filled' : '');
      if (words.crafting?.progressiveGlow !== false) {
        const m = inv ? craftMatch(slots, words, inv) : { word: null, glowDepth: 0 };
        const d = m.word ? 3 : m.glowDepth;
        s.classList.remove('g1', 'g2', 'g3');
        if (slots.filter(Boolean).length && d > 0 && i < d) s.classList.add(`g${Math.min(3, d)}`);
        if (m.word) runCraft(m.word);
      }
    });
  }

  async function runCraft(word) {
    slots.fill(null);
    refreshSlots();
    await onCraft(word);               // main：gameEvent('CRAFT')（事件机统一消耗库存）+ 共鸣音效
    if (inv) refresh(inv);
  }

  function placeStone(ipa, idx) {
    if (!canPlace(slots, inv, ipa)) return;      // 库存不够不再放
    if (slots[idx]) slots[idx] = null;           // 换石：旧的直接回「可放置池」
    slots[idx] = ipa;
    refreshSlots();
  }
  function returnStone(idx) {
    if (!slots[idx]) return;
    slots[idx] = null;
    refreshSlots();
  }

  function refresh(inv_) {
    inv = inv_;
    stoneBox.innerHTML = '';
    for (const ipa of inv.order) {
      const n = stoneCount(inv, ipa);
      if (n <= 0) continue;
      const cell = document.createElement('div');
      cell.className = `cell stone-${isVowel(ipa) ? 'v' : 'c'}`;
      cell.innerHTML = `<span class="glyph">${ipa}</span>` + (n > 0 ? `<span class="count">×${n}</span>` : '');
      cell.addEventListener('pointerdown', e => startDrag(e, cell, { kind: 'stone', ipa }));
      stoneBox.appendChild(cell);
    }
    itemBox.innerHTML = '';
    for (const word of inv.items.keys()) {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.innerHTML = `<img src="${iconURL(words[word].icon)}" alt="">`;
      cell.addEventListener('pointerdown', e => startDrag(e, cell, { kind: 'item', word }));
      itemBox.appendChild(cell);
    }
  }

  // —— 统一拖拽：轻点=点读；拖动=幽灵；DOM 内投槽 / 跨层投画布 ——
  function startDrag(e, cell, payload) {
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    const move = ev => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) {
        moved = true;
        ghost.classList.remove('hidden');
        ghost.innerHTML = payload.kind === 'item'
          ? `<img src="${iconURL(words[payload.word].icon)}" style="width:40px;height:40px">`
          : `<span class="glyph">${payload.ipa}</span>`;
        if (payload.kind === 'item') cell.style.opacity = '.35';
      }
      if (moved) { ghost.style.left = `${ev.clientX}px`; ghost.style.top = `${ev.clientY}px`; }
    };
    const up = ev => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      ghost.classList.add('hidden');
      cell.style.opacity = '';
      if (!moved) {                                        // 轻点 = 点读
        if (payload.kind === 'stone') onSpeakCarrier(payload.ipa);
        else onSpeakWord(payload.word);
        return;
      }
      if (payload.kind === 'stone') {                     // 只能投槽位；投空=原地无事（库存从未动过）
        const hit = document.elementFromPoint(ev.clientX, ev.clientY)?.closest('.slot');
        if (hit) placeStone(payload.ipa, Number(hit.dataset.slot));
      } else {                                             // 词具 → 画布（main 做命中）
        onDropItem(payload.word, ev.clientX, ev.clientY);
      }
    };
    const cancel = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      ghost.classList.add('hidden'); cell.style.opacity = '';
      // pointercancel：库存从未变化，幽灵消失即回位
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  }

  slotEls.forEach((s, i) => s.addEventListener('click', () => returnStone(i)));
  toggle.addEventListener('click', () => {
    craftRow.classList.toggle('hidden');
    toggle.classList.toggle('armed');
  });

  return {
    refresh,
    show() { root.classList.remove('hidden'); document.getElementById('bag').classList.remove('hidden'); },
    openCraft() { craftRow.classList.remove('hidden'); toggle.classList.add('armed'); },
    pulseBag(total) {
      const bag = document.getElementById('bag');
      document.getElementById('bag-count').textContent = String(total);
      document.getElementById('bag-icon').innerHTML =
        `<img src="${iconURL('gem')}" style="width:26px;height:26px" alt="">`;
      bag.classList.remove('pulse'); void bag.offsetWidth; bag.classList.add('pulse');
    }
  };
}
```

- [ ] **Step 2: Node 冒烟**

Run: `node --test`
Expected: 全 pass（`iconURL`/DOM 都在函数体内，`virtualInventory` 为纯函数）。

补一条纯函数测试到 `test/hotbar.test.js`：先把文件顶部 import 列表加入 `canPlace`，再追加：
```js
test('canPlace：槽内同音素数不得超过库存', () => {
  const inv = invWith([['t', 2]]);
  assert.equal(canPlace([null, null, null, null], inv, 't'), true);
  assert.equal(canPlace(['t', null, null, null], inv, 't'), true);   // 已放 1，还有 1
  assert.equal(canPlace(['t', 't', null, null], inv, 't'), false);   // 已放 2，放不下第 3 颗
});
```

- [ ] **Step 3: 浏览器目检**

Run: `node server.js` → 控制台：
```js
Promise.all([import('./js/hotbar.js'), import('./js/audio.js')]).then(([H, A]) => {
  const words = G.content.words;
  const speech = new A.Speech();
  const hb = H.createHotbar({
    words,
    onSpeakCarrier: ipa => speech.speak(G.content.carriers[ipa], { pitch: 1.25 }),
    onSpeakWord: w => speech.speak(w, { pitch: 1.25 }),
    onCraft: w => console.log('CRAFT', w),
    onDropItem: (w, x, y) => console.log('DROP', w, x, y)
  });
  const inv = H.createInventory();
  for (const p of ['l', 'aɪ', 't', 'h']) H.addStone(inv, p);
  hb.refresh(inv); hb.show(); hb.pulseBag(4);
  window.__hb = hb; window.__inv = inv;
});
```
Expected: 底部毛玻璃工具栏滑入（右侧袋 ×4）；石头格黄/蓝按元辅音；轻点石头发声（首次需先点过开始按钮解锁音频）；点 ᚱ 展开槽行；拖 l→aɪ→t 入前三槽：槽缘逐级发青光，第三颗落下瞬间 `console` 打出 `CRAFT light` 且三石消失；把石头拖到槽外松手=回栏；`pointercancel`（拖出窗口）也回栏。Ctrl+C 停服。

- [ ] **Step 4: Commit**

```bash
git add public/js/hotbar.js test/hotbar.test.js
git commit -m "feat: MC 式工具栏 DOM（合成槽/渐进共鸣/点读/跨层拖拽幽灵）"
```

---

### Task 11: journal.js 词语之书（词语卡 + 48 符文图鉴）（TDD 波形纯函数 + 目检）

**Files:**
- Create: `public/js/journal.js`
- Test: `test/journal.test.js`
- 规格：§8（两页签/波形高亮/IPA 行/听见/48 分组图鉴/沉睡槽/结尾卡、点亮不因消耗熄灭）

- [ ] **Step 1: 写失败测试**

`test/journal.test.js`：
```js
import { test } from 'node:test';
import assert from 'node:assert';
import { waveSegments } from '../public/js/journal.js';

test('waveSegments：按时长比例铺满宽度，段间 4px', () => {
  const segs = waveSegments([['h', 70], ['ə', 90], ['l', 80], ['əʊ', 200]], 404);
  assert.equal(segs.length, 4);
  assert.closeTo(segs.reduce((s, x) => s + x.w, 0), 404 - 12, 0.001);
  assert.ok(segs[3].w > segs[2].w && segs[3].w > segs[0].w);       // əʊ 最长
  assert.equal(segs[1].x, segs[0].x + segs[0].w + 4);
});
```

- [ ] **Step 2: 跑测试确认失败**

Run: `node --test test/journal.test.js`
Expected: FAIL（模块不存在）。

- [ ] **Step 3: 实现 journal.js**

```js
import { iconURL, drawRune } from './art.js';
import { isVowel } from './hotbar.js';

// 波形分段：按音素时长比例铺满 width（规格 §8 词语卡）
export function waveSegments(phonemes, width) {
  const total = phonemes.reduce((s, [, ms]) => s + ms, 0);
  const avail = width - (phonemes.length - 1) * 4;
  let x = 0;
  return phonemes.map(([ipa, ms]) => {
    const w = (ms / total) * avail;
    const seg = { ipa, ms, x, w };
    x += w + 4;
    return seg;
  });
}

export function createJournal({ content, speakWord, speakCarrier }) {
  const el = id => document.getElementById(id);
  const root = el('journal'), wordsBox = el('journal-words'), runesBox = el('journal-runes');
  const pb = content.phonemeBook;

  function renderWords(g) {
    wordsBox.innerHTML = '';
    for (const word of g.book) {
      const def = content.words[word];
      const card = document.createElement('div');
      card.className = 'word-card';
      const ipaHtml = def.phonemes.map(([p]) =>
        `<span style="${g.inv.everPicked.has(p) ? '' : 'opacity:.35'}">${p}</span>`).join('<b> · </b>');
      card.innerHTML = `
        <img src="${iconURL(def.icon)}" alt="">
        <div class="wc-mid">
          <canvas width="360" height="56"></canvas>
          <div class="ipa">${ipaHtml}</div>
        </div>
        <button class="btn primary small">听见</button>`;
      card.querySelector('button').addEventListener('click', () => speakWord(word));
      wordsBox.appendChild(card);
      const cv = card.querySelector('canvas'), x = cv.getContext('2d');
      for (const s of waveSegments(def.phonemes, 360)) {
        const h = isVowel(s.ipa) ? 40 : 24;
        x.fillStyle = g.inv.everPicked.has(s.ipa) ? '#0A84FF' : 'rgba(255,255,255,.14)';
        x.beginPath();
        x.roundRect ? x.roundRect(s.x, (56 - h) / 2, s.w, h, 8) : x.rect(s.x, (56 - h) / 2, s.w, h);
        x.fill();
      }
    }
    if (!g.book.size) wordsBox.innerHTML = `<div class="rune-endcard">（还没有拼出任何词——去碰碰这间屋子）</div>`;
  }

  function renderRunes(g) {
    runesBox.innerHTML = '';
    let picked = 0;
    for (const group of pb.groups) {
      const grid = document.createElement('div');
      grid.className = 'rune-grid';
      grid.style.gridTemplateColumns = group.items.length > 10 ? 'repeat(8,1fr)' : 'repeat(8,1fr)';
      for (const ipa of group.items) {
        const lit = g.inv.everPicked.has(ipa);
        if (lit) picked++;
        const cell = document.createElement('div');
        cell.className = 'rune-card' + (lit ? ' lit' : '');
        const cv = document.createElement('canvas');
        cv.width = 44; cv.height = 50;
        drawRune(cv.getContext('2d'), pb.runes[ipa], 22, 25, 30,
          lit ? '#54e0c8' : 'rgba(255,255,255,.14)', lit ? 5 : 4);
        cell.appendChild(cv);
        const src = Object.entries(content.words).find(([, d]) => d.phonemes.some(([p]) => p === ipa))?.[0];
        cell.insertAdjacentHTML('beforeend',
          `<div class="ipa">${ipa}</div>` +
          (lit && src ? `<img src="${iconURL(content.words[src].icon)}" alt="">`
                      : `<div class="sleep">沉睡的声音</div>`));
        cell.addEventListener('click', () => {
          if (!lit) return;
          speakCarrier(ipa);
          if (src) setTimeout(() => speakWord(src), 900);
        });
        grid.appendChild(cell);
      }
      runesBox.appendChild(grid);
    }
    const sleep = pb.total - picked;
    runesBox.insertAdjacentHTML('beforeend',
      `<div class="rune-endcard">还有 ${sleep} 个声音沉睡在更深的房间里……</div>`);
    el('rune-count').textContent = `${picked}/${pb.total}`;
  }

  root.querySelectorAll('.seg-btn').forEach(btn => btn.addEventListener('click', () => {
    root.querySelectorAll('.seg-btn').forEach(b => b.classList.toggle('active', b === btn));
    wordsBox.classList.toggle('hidden', btn.dataset.tab !== 'words');
    runesBox.classList.toggle('hidden', btn.dataset.tab !== 'runes');
  }));
  el('journal-close').addEventListener('click', close);

  function open(g) { renderWords(g); renderRunes(g); root.classList.remove('hidden'); }
  function close() { root.classList.add('hidden'); }
  return { open, close, toggle(g) { root.classList.contains('hidden') ? open(g) : close(); } };
}
```

- [ ] **Step 4: 跑测试**

Run: `node --test test/journal.test.js`
Expected: 1 pass。

- [ ] **Step 5: 浏览器目检**

Run: `node server.js` → 控制台（借 Task 10 的 `__inv/__hb` 环境，或自建）：
```js
Promise.all([import('./js/journal.js'), import('./js/audio.js')]).then(([J, A]) => {
  const speech = new A.Speech();
  const j = J.createJournal({ content: G.content, speakWord: w => speech.speak(w, { pitch: 1.25 }), speakCarrier: ipa => speech.speak(G.content.carriers[ipa], { pitch: 1.25 }) });
  j.open({ book: new Set(['hello', 'light']), inv: __inv });
  window.__j = j;
});
```
Expected: 全屏书页打开；词语页两张卡：图标 + 蓝色分段波形（hello 四段、əʊ 段最宽）+ IPA 行 + 听见按钮发声；切到声音符文页：三组共 48 格，捡过的（l/aɪ/t…）青色呼吸发光、点击读载词再读来源词，未捡的是暗符文+「沉睡的声音」；结尾卡「还有 N 个声音沉睡……」；角标 n/48。Ctrl+C 停服。

- [ ] **Step 6: Commit**

```bash
git add public/js/journal.js test/journal.test.js
git commit -m "feat: 词语之书（波形词语卡/48 分组符文图鉴/沉睡槽结尾卡）"
```

---

### Task 12: ui.js 提示条/toast/揭示卡/结算 + door.js 仪式数据（目检）

**Files:**
- Create: `public/js/ui.js`
- Modify: `public/js/door.js`（追加仪式常量与座位）
- 规格：§3.1 节拍 12（揭示卡）、§14（结算卡）、§11.2（ui.js 职责）

- [ ] **Step 1: 在 door.js 末尾追加仪式数据**

```js
// —— 咏亮仪式（规格 §3.1 节拍 12）：四石绕拱依次落座 ——
export const RITUAL_STEP = 0.55;   // 每颗石头的落座间隔（秒）
export function ritualSeats(n = 4) {
  // 拱门四周座位：左柱下 → 左拱肩 → 右拱肩 → 右柱下
  return [[1098, 502], [1116, 396], [1172, 396], [1190, 502]].slice(0, n);
}
```

- [ ] **Step 2: 实现 ui.js**

```js
import { iconURL } from './art.js';

export function createUI({ content }) {
  const el = id => document.getElementById(id);
  const hint = el('hintbar'), hintText = el('hint-text'), toastEl = el('toast');
  let toastTimer = 0;

  function setHint(key) {
    const text = content.hints[key] ?? key;             // 允许直接传文案
    if (hintText.textContent === text) return;
    hintText.textContent = text;
    hint.classList.add('hidden'); void hint.offsetWidth;
    hint.classList.remove('hidden');
  }
  function toast(text, dur = 2600) {
    toastEl.textContent = text;
    toastEl.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add('hidden'), dur);
  }
  function reveal(word) {
    const def = content.words[word];
    el('reveal-stones').innerHTML = def.phonemes.map(([p]) => `<span>${p}</span>`).join('');
    el('reveal-word').textContent = word.toUpperCase();
    el('reveal-ok').textContent = '把这个词，还给门';
    el('reveal').classList.remove('hidden');
    return new Promise(res => el('reveal-ok').addEventListener('click', () => {
      el('reveal').classList.add('hidden');
      res();
    }, { once: true }));
  }
  function summary(g) {
    el('summary-line').textContent = `你捡起了 ${g.book.size} 个词 · ${g.stonesPicked} 块声音石`;
    el('summary-icons').innerHTML = [...g.book]
      .map(w => `<img src="${iconURL(content.words[w].icon)}" alt="">`).join('');
    el('summary').classList.remove('hidden');
  }
  el('btn-again').addEventListener('click', () => location.reload());
  el('btn-notes').addEventListener('click', () => el('notes').classList.remove('hidden'));
  el('notes-close').addEventListener('click', () => el('notes').classList.add('hidden'));
  el('btn-walk').addEventListener('click', () => el('summary').classList.add('hidden'));
  return { setHint, toast, reveal, summary };
}
```

- [ ] **Step 3: Node 冒烟 + 浏览器目检**

Run: `node --test` → 全 pass。

Run: `node server.js` → 控制台：
```js
import('./js/ui.js').then(m => {
  const ui = m.createUI({ content: G.content });
  ui.setHint('hello');
  ui.toast('（测试）石门纹丝不动……');       // 实机不会用 toast 报错——此处仅验证组件
  window.__ui = ui;
});
```
Expected: 底部提示条淡入「他在跟你打招呼。走过去，点一点他。」；顶部 toast 2.6s 后消失；`__ui.reveal('open')` 弹出揭示卡（四颗音素石依次弹入 → OPEN 金色放大 → 按钮），点击关闭。Ctrl+C 停服。

- [ ] **Step 4: Commit**

```bash
git add public/js/ui.js public/js/door.js
git commit -m "feat: 提示条/toast/OPEN 揭示卡/结算卡 + 门仪式座位数据"
```

---

### Task 13: main.js boot 全接线——主循环/输入/交互/指令解释器/验收（集成）

**Files:**
- Modify: `public/js/main.js`（`boot()` 整体替换为下述实现；删除 Task 2 的临时 `game:start` 监听）
- 规格：§3 全节拍、§4 效果、§5 拖拽命中、§6、§11.5-11.7、§12、§13 验收

- [ ] **Step 1: 替换 boot() 并补充 import**

main.js 顶部 import 区补：
```js
import { PAL, iconURL } from './art.js';
import { Speech, Sfx, pickVoices } from './audio.js';
import { LAYOUT, createScene, initScene, updateScene, drawScene, drawOverlay,
         screenToLogical, moveToward, resolveCollisions, makeStone, stepStone, magnetStep } from './scene.js';
import { createActors, updateActors, drawPlayer, drawNpc, drawCat, setGesture } from './actors.js';
import { createHotbar, isVowel, addStone } from './hotbar.js';
import { createJournal } from './journal.js';
import { createUI } from './ui.js';
import { RITUAL_STEP, ritualSeats } from './door.js';
```

`boot()` 替换为：
```js
function boot() {
  const el = id => document.getElementById(id);
  const cv = el('game'), ctx = cv.getContext('2d');
  const dpr = Math.min(2, devicePixelRatio || 1);
  cv.width = LAYOUT.W * dpr; cv.height = LAYOUT.H * dpr;
  ctx.scale(dpr, dpr);
  const fitStage = () => {
    const s = Math.min(innerWidth / LAYOUT.W, innerHeight / LAYOUT.H);
    el('stage').style.width = `${LAYOUT.W * s}px`;
    el('stage').style.height = `${LAYOUT.H * s}px`;
  };
  fitStage();
  addEventListener('resize', fitStage);

  window.__errors = [];
  addEventListener('error', e => __errors.push(String(e.message)));
  addEventListener('unhandledrejection', e => __errors.push(String(e.reason)));

  loadContent().then(content => start(content));
}

function start(content) {
  const el = id => document.getElementById(id);
  const cv = el('game'), ctx = cv.getContext('2d');

  // —— 音频（首手势解锁）——
  const speech = new Speech(), sfx = new Sfx();
  let voices = { uncle: null, child: null, door: null };
  const scanVoices = () => {
    if (speech.ready) voices = pickVoices(speechSynthesis.getVoices());
  };
  scanVoices();
  if (speech.ready) speechSynthesis.addEventListener('voiceschanged', scanVoices);
  el('btn-start').addEventListener('click', () => sfx.ctx?.resume(), { once: true });

  let speechChain = Promise.resolve();                       // 语音串行
  function speak(text, who = 'uncle', slow = false) {
    const conf = {
      uncle: { voice: voices.uncle, pitch: 0.9, rate: slow ? 0.7 : 0.95 },
      child: { voice: voices.child, pitch: 1.25, rate: slow ? 0.8 : 1 },
      door:  { voice: voices.door, pitch: 0.7, rate: slow ? 0.6 : 0.8 }
    }[who];
    const npcMouth = who === 'uncle' ? () => { actors.npc.mouth = 1; } : null;
    speechChain = speechChain.then(() => speech.speak(text, { ...conf, onPulse: npcMouth }))
      .catch(() => {});
    if (who === 'uncle') {
      if (slow) setGesture(actors.npc, 'point');
      else if (/hello/i.test(text)) setGesture(actors.npc, 'wave');
    }
    return speechChain;
  }

  // —— 世界对象 ——
  const game = createGame(content);
  const actors = createActors();
  const sc = createScene(); initScene(sc);
  const stones = [];                                          // 场上音素石
  const view = { t: 0, lit: 0, doorState: 'asleep', doorPulse: 0, doorOpen: 0,
                 torchesLit: false, bloomed: false, hatOn: false };
  const ritual = { active: false, t: 0, seated: 0 };
  let walkTarget = null, pendingInteract = null, started = false;

  const ui = createUI({ content });
  const journal = createJournal({
    content,
    speakWord: w => speak(w[0].toUpperCase() + w.slice(1) + '.', 'child'),
    speakCarrier: ipa => speak(content.carriers[ipa], 'child')
  });
  const hb = createHotbar({
    words: content.words,
    onSpeakCarrier: ipa => { sfx.click(); speak(content.carriers[ipa], 'child'); },
    onSpeakWord: w => { sfx.click(); speak(w[0].toUpperCase() + w.slice(1) + '.', 'child'); },
    onCraft: word => run(gameEvent(game, 'CRAFT', word)),
    onDropItem: (word, cx, cy) => {
      const p = screenToLogical(cx, cy, cv.getBoundingClientRect());
      if (!p.inside) return;
      const target = hitUseTarget(p, word);
      run(gameEvent(game, 'USE', { word, target }));
    }
  });

  // —— 词具落点：目标命中（含「自己」）——
  function hitUseTarget(p, word) {
    const want = content.words[word].use.target;
    if (want === 'player') return Math.hypot(p.x - actors.player.x, p.y - actors.player.y) < 90 ? 'player' : null;
    if (want === 'npc') return Math.hypot(p.x - LAYOUT.targets.npc.x, p.y - LAYOUT.targets.npc.y) < 90 ? 'npc' : null;
    const t = LAYOUT.targets[want];
    if (t && Math.hypot(p.x - t.x, p.y - t.y) < t.r) return want;
    return null;
  }

  // —— 掉石 ——
  function spawnDrop(word) {
    const src = Object.values(content.explorables).find(e => e.word === word);
    const phon = content.words[word].phonemes;
    phon.forEach(([ipa], i) => stones.push(makeStone(ipa, src.drop[0], src.drop[1], i * 0.13)));
    stones.slice(-phon.length).forEach((s, i) => { s.floorY = src.drop[1] + 26 + (i % 3) * 16; });
  }

  // —— 指令解释器（Task 7 词汇表）——
  function run(instructions) {
    for (const ins of instructions) {
      switch (ins.t) {
        case 'speak': speak(ins.text, ins.who, ins.slow); break;
        case 'drop': spawnDrop(ins.word); break;
        case 'hint': ui.setHint(ins.key); break;
        case 'beat': G.beat = ins.beat; game.beat = ins.beat; break;
        case 'hotbarShow': hb.show(); sfx.chime(); break;
        case 'bagPulse': hb.pulseBag(game.stonesPicked); break;
        case 'resonate': sfx.resonate(); hb.refresh(game.inv); break;
        case 'itemIn': sfx.itemIn(); hb.refresh(game.inv); break;
        case 'doorAwake': sfx.glowTick(); break;
        case 'mutter': sfx.mutter(); break;
        case 'cat': sfx.meow(); actors.cat.earT = 1; actors.cat.meowT = 0.6; break;
        case 'blocked': setGesture(actors.npc, 'tilt', 1.2); break;
        case 'pointHotbar': setGesture(actors.npc, 'point', 2); break;
        case 'effect': applyEffect(ins.name, ins.full); break;
        case 'ritualStart': startRitual(); break;
        case 'openAnim': openDoor(); break;
        case 'summary': ui.summary(game); break;
      }
    }
  }

  function applyEffect(name, full) {
    if (name === 'illuminate') {
      if (full) { sfx.sweepUp(); view.lit = 1; setGesture(actors.npc, 'laugh', 2); actors.cat.earT = 1; }
      else sfx.glowTick();
    } else if (name === 'bloom') {
      if (full) { sfx.water(); setTimeout(() => sfx.bloom(), 300); view.bloomed = true; actors.cat.earT = 1; }
      else sfx.water();
    } else if (name === 'ignite') {
      if (full) { sfx.ignite(); view.torchesLit = true; }
      else sfx.crackle();
    } else if (name === 'wear') {
      sfx.hatPuff(); actors.player.hatOn = true; view.hatOn = true; actors.cat.earT = 1;
    } else if (name === 'greet') {
      if (full) { sfx.laugh(); setGesture(actors.npc, 'laugh', 1.8); }
      else setGesture(actors.npc, 'wave', 1.2);
    }
  }

  // —— 门仪式：四石绕拱依次咏亮 → Open. → Open! → 揭示卡 → 开门（规格 §3.1 节拍 12）——
  function startRitual() {
    ritual.active = true; ritual.t = 0; ritual.seated = 0;
    sfx.glowTick();
    const seats = ritualSeats(content.door.ipa.length);
    const ritualStones = content.door.ipa.map((ipa, i) => makeStone(ipa, 1145, 460, 0));
    ritualStones.forEach((s, i) => {
      s.state = 'idle'; s.from = { x: 1145, y: 460 }; s.to = { x: seats[i][0], y: seats[i][1] }; s.at = i * RITUAL_STEP;
      stones.push(s);
    });
    setTimeout(() => speak('Open.', 'door', true), RITUAL_STEP * 4 * 1000 * 0.5);
    setTimeout(() => speak('Open!', 'child'), RITUAL_STEP * 4 * 1000 * 0.85);
    setTimeout(async () => {
      await ui.reveal('open');
      run(gameEvent(game, 'RITUAL_DONE'));
    }, RITUAL_STEP * 4 * 1000 + 900);
  }

  function openDoor() {
    sfx.creak();
    const t0 = performance.now();
    const anim = () => {
      const k = Math.min(1, (performance.now() - t0) / 1400);
      view.doorOpen = k;
      if (k >= 1) {
        for (let i = stones.length - 1; i >= 0; i--) if (stones[i].to) stones.splice(i, 1);  // 仪式石谢幕，不再参与磁吸
        sfx.choir();
        run(gameEvent(game, 'OPEN_DONE'));
        return;
      }
      requestAnimationFrame(anim);
    };
    setTimeout(anim, 400);
  }

  // —— 输入 ——
  const keys = new Set();
  const KEYMAP = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' };
  addEventListener('keydown', e => {
    if (e.code === 'KeyB') { journal.toggle(game); return; }
    if (e.code === 'Escape') { journal.close(); return; }
    if (KEYMAP[e.code]) { keys.add(KEYMAP[e.code]); walkTarget = null; pendingInteract = null; }
  });
  addEventListener('keyup', e => { if (KEYMAP[e.code]) keys.delete(KEYMAP[e.code]); });

  cv.addEventListener('pointerdown', e => {
    if (!started) return;
    if (e.target.closest('#hotbar') || e.target.closest('.screen')) return;
    const p = screenToLogical(e.clientX, e.clientY, cv.getBoundingClientRect());
    if (!p.inside) return;
    const hit = hitSceneTarget(p);
    if (!hit) { walkTarget = { x: p.x, y: clampY(p.y) }; pendingInteract = null; return; }
    if (near(hit)) { interact(hit.id); return; }
    walkTarget = approach(hit); pendingInteract = hit.id;
  });

  function clampY(y) { return Math.max(340, Math.min(700, y)); }
  function near(t) { return Math.hypot(actors.player.x - t.x, actors.player.y - t.y) < LAYOUT.INTERACT_R; }
  function approach(t) {
    const dx = actors.player.x - t.x, dy = actors.player.y - t.y, d = Math.hypot(dx, dy) || 1;
    return { x: t.x + (dx / d) * 120, y: t.y + (dy / d) * 120 };
  }
  function hitSceneTarget(p) {
    const ids = ['door', 'hatstand', 'lamp', 'brazier', 'well', 'sprout', 'cat', 'npc'];
    for (const id of ids) {
      const t = LAYOUT.targets[id];
      if (!t) continue;
      if (p.x > 800 && !game.lit && id !== 'lamp') continue;          // 暗区不可交互（规格 §6.2）
      if (Math.hypot(p.x - t.x, p.y - t.y) < t.r) return { id, x: t.x, y: t.y };
    }
    return null;
  }
  function interact(id) {
    sfx.click();
    if (id === 'door') run(gameEvent(game, 'DOOR_CLICK'));
    else run(gameEvent(game, 'INTERACT', id));
  }

  // —— 主循环 ——
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    view.t += dt;
    view.doorState = game.door.state;
    view.doorPulse = (Math.sin(view.t * 2.4) + 1) / 2;
    view.lit = sc.lit;
    updateScene(sc, dt, game.lit ? 1 : 0);
    updateActors(actors, dt);

    // 移动
    const p = actors.player;
    let moved = false;
    if (keys.size) {
      const sp = 220 * dt;
      if (keys.has('l')) { p.x -= sp; p.facing = -1; moved = true; }
      if (keys.has('r')) { p.x += sp; p.facing = 1; moved = true; }
      if (keys.has('u')) { p.y -= sp; moved = true; }
      if (keys.has('d')) { p.y += sp; moved = true; }
      resolveCollisions(p);
    } else if (walkTarget) {
      if (moveToward(p, walkTarget, 220, dt)) {
        resolveCollisions(p);
        const done = pendingInteract;
        walkTarget = null;
        if (done) {
          const t = LAYOUT.targets[done] || LAYOUT.targets.npc;
          if (Math.hypot(p.x - t.x, p.y - t.y) < LAYOUT.INTERACT_R) interact(done);
        }
      } else resolveCollisions(p);
      moved = true;
    }
    p.moving = moved;
    if (moved) p.walkT += dt;

    // 音素石：物理 + 磁吸拾取
    for (let i = stones.length - 1; i >= 0; i--) {
      const s = stones[i];
      if (ritual.active && s.to) {                     // 仪式石：由 ritual 段渲染
        continue;
      }
      stepStone(s, dt, s.floorY ?? 660);
      if (magnetStep(s, p, dt)) {
        stones.splice(i, 1);
        sfx.chime();
        run(gameEvent(game, 'PICKUP', s.ipa));
      }
    }
    if (ritual.active) {
      ritual.t += dt;
      const should = Math.min(ritualSeats().length, Math.floor(ritual.t / RITUAL_STEP) + 1);
      while (ritual.seated < should && ritual.seated < content.door.ipa.length) {
        ritual.seated++;
        sfx.glowTick();
      }
      if (ritual.t > RITUAL_STEP * 4 + 1) ritual.active = false;
    }

    if (started) run(gameEvent(game, 'TICK', dt));

    // —— 绘制 ——
    ctx.clearRect(0, 0, LAYOUT.W, LAYOUT.H);
    drawScene(ctx, sc, view);
    const byY = [['npc', actors.npc.y], ['cat', actors.cat.y], ['player', actors.player.y]].sort((a, b) => a[1] - b[1]);
    for (const [who] of byY) {
      if (who === 'npc') drawNpc(ctx, actors.npc, view.t);
      if (who === 'cat') drawCat(ctx, actors.cat, view.t);
      if (who === 'player') drawPlayer(ctx, actors.player, view.t);
    }
    for (const s of stones) drawStone(ctx, s, view.t);
    drawOverlay(ctx, sc, view);
    if (ritual.active || view.doorOpen > 0) drawRitualStones(ctx);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function drawStone(x, s, t) {
    const bob = s.state === 'idle' ? Math.sin(t * 2.2 + s.phase) * 3 : 0;
    const y = s.y + bob;
    x.save();
    x.translate(s.x, y);
    x.fillStyle = isVowel(s.ipa) ? PAL.vowel : PAL.cons;
    x.beginPath(); x.arc(0, 0, 15, 0, 7); x.fill();
    x.lineWidth = 3.5; x.strokeStyle = PAL.ink; x.stroke();
    x.strokeStyle = 'rgba(255,255,255,' + (0.35 + Math.abs(Math.sin(t * 3 + s.phase)) * 0.4) + ')';
    x.beginPath(); x.arc(0, 0, 18, 0, 7); x.stroke();       // 静止后描边闪烁（规格 §3.1 节拍 6）
    x.fillStyle = PAL.ink;
    x.font = 'bold 13px system-ui'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.fillText(s.ipa, 0, 1);
    x.restore();
  }

  function drawRitualStones(x) {
    const seats = ritualSeats();
    stones.filter(s => s.to).forEach((s, i) => {
      const k = ritual.active ? Math.min(1, Math.max(0, (ritual.t - s.at) / 0.5)) : 1;
      const sx = s.from.x + (s.to.x - s.from.x) * k + Math.sin(view.t * 6 + i) * (1 - k) * 30;
      const sy = s.from.y + (s.to.y - s.from.y) * k + Math.cos(view.t * 6 + i) * (1 - k) * 30;
      x.save();
      x.translate(sx, sy);
      x.shadowColor = PAL.glowRune; x.shadowBlur = 18;
      x.fillStyle = isVowel(s.ipa) ? PAL.vowel : PAL.cons;
      x.beginPath(); x.arc(0, 0, 14, 0, 7); x.fill();
      x.shadowBlur = 0;
      x.lineWidth = 3; x.strokeStyle = PAL.ink; x.stroke();
      x.fillStyle = PAL.ink; x.font = 'bold 12px system-ui';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(s.ipa, 0, 1);
      x.restore();
      seats.forEach(([qx, qy], j) => {                      // 已落座座位发青光
        if (j < ritual.seated) {
          x.fillStyle = 'rgba(84,224,200,.25)';
          x.beginPath(); x.arc(qx, qy, 20, 0, 7); x.fill();
        }
      });
    });
  }

  // —— 开始/调试 ——
  function begin() {
    started = true;
    window.__gameLoopOn = true;
    hb.refresh(game.inv);
    run(startGame(game));
  }
  addEventListener('game:start', begin);
  window.G = {
    content,
    get beat() { return game.beat; },
    jump(b) {
      started = true; window.__gameLoopOn = true;
      run(jump(game, b));
      hb.refresh(game.inv); hb.show();
      if (game.stonesPicked) hb.pulseBag(game.stonesPicked);
    },
    game
  };
  if (new URLSearchParams(location.search).get('autostart') === '1') {
    el('title').classList.add('hidden');
    dispatchEvent(new CustomEvent('game:start'));
    G.jump('hello-meet');
  } else {
    el('btn-start').addEventListener('click', () => {
      el('title').classList.add('hidden');
      el('prologue').classList.remove('hidden');
      el('prologue').addEventListener('click', () => {
        el('prologue').classList.add('hidden');
        dispatchEvent(new CustomEvent('game:start'));
      }, { once: true });
    }, { once: true });
  }
}
```

说明：Task 2 版 `boot()` 里的标题/序章逻辑上移进 `start()`；删除旧的 `game:start` 临时 toast 监听；`loadContent`/`fitStage` 旧实现删除（新 boot 自带）。`jump`（事件机）与 `G.jump`（含 UI 刷新）同名分层：模块内 `jump` 为 Task 7 导出，`G.jump` 调它。

- [ ] **Step 2: 全量回归**

Run: `node --test`
Expected: 全部 pass（boot 不在 Node 执行）。

- [ ] **Step 3: 浏览器全链路验收（对照规格 §13）**

Run: `node server.js` → `http://localhost:3000`，逐条核对：

**铁律类**
- [ ] 全程无中文解释词义、无英语字幕、无 emoji、无红叉、无评分
- [ ] 英文拼写只出现在 OPEN 揭示卡

**全链路（正常玩一遍）**
- [ ] 大叔招手出声（无文字）→ 走近点他 → "Hello! Yes, you!" + 四石弹出弹跳 → 走近磁吸拾取 → 工具栏滑入、袋 ×4、提示「试着拼在一起」
- [ ] 碰井/火盆/灯柱 → 大叔喊词 + 各自掉石（元音黄/辅音蓝、IPA 字）
- [ ] 点工具栏 ᚱ → 拖 l·aɪ·t 入槽（渐进共鸣逐级亮）→ 共鸣 + 童声 "Light." + 提灯词具入栏
- [ ] 拖提灯到灯柱 → 上扬音效 + 1.2s 光潮 → 右半亮、门/帽架/右火把淡入
- [ ] 帽架掉 h·æ·t → 拼 hat → 拖到自己头上 → 戴上（架上帽子消失）
- [ ] 支线：water 词具拖枯苗 → 浇水开花粒子音效；fire 词具拖右墙火把 → 点燃；hello 词具拖大叔 → 大笑回礼；重复使用=轻反应
- [ ] 5 词后门符文青色脉动 → 点门 → 低语 + 四石从符文掉落 → 拼 open → 拖拱门词具到门 → 四石绕拱依次落座 → "Open."（低沉）→ "Open!"（童声）→ 揭示卡 → 门收窄金光 → 结算卡（6 词·21 石·六图标）
- [ ] 拖错词具上门 → 纹丝不动 + 咕哝（无任何错误 UI）

**系统**
- [ ] WASD/方向键行走（腿部交替、影子、按键盘取消自动走位）；点击远处目标自动走位再交互
- [ ] 猫点击喵+竖耳；45s 卡关大叔低声提示（可用 `G.game.teaseClock=44` 加速验证）
- [ ] B 开词语之书：词语卡波形/IPA/听见；符文页 48 槽三组、已拾取发光可点读、锁定「沉睡的声音」、结尾卡与 n/48 角标
- [ ] `?autostart=1` 直接进入探索；控制台 `G.jump('door-open')` 等可用；`window.__errors` 为空数组
- [ ] 任务管理器观察：60fps 无明显掉帧（静态层只画一次）
- [ ] DevTools 模拟触摸（或触屏设备）：拖拽工具栏正常

**无 TTS 兜底**
- [ ] DevTools → Rendering→ 禁用或无音色环境（`G.game` 照走）：说话处流程不卡（估时推进），可临时 `speechSynthesis.speak = () => {}` 验证

- [ ] **Step 4: Commit**

```bash
git add public/js/main.js
git commit -m "feat: 主循环全接线（输入/交互/指令解释器/门仪式/调试钩子）——全链路可玩"
```

---

## 计划自检记录（writing-plans Self-Review）

1. **规格覆盖**：§0-§2 教学铁律→Task 13 验收项+内容测试；§3 节拍/门控/引导→Task 7；§4 词具→Task 7 USE+Task 13 applyEffect；§5 工具栏/合成/拖拽→Task 6/10；§6 场景光照→Task 5/8/9；§7 音标→Task 1 内容+Task 3 卢文；§8 词语之书→Task 11；§9 美术→Task 3/8/9/2(CSS)；§10 数据→Task 1/2；§11 技术架构→Task 1/4/5/8/13；§12 错误处理→Task 1(兜底)/4(TTS)/10(pointercancel)/13(验收)；§13 验收→Task 13 Step 3。无缺口。
2. **占位符扫描**：唯一「粘贴注释」出现在 Task 2 Step 2 的 `content-fallback.js`（数据复制任务，已注明必须逐字复制且有防漂移测试）——其余步骤全部含完整代码。
3. **类型/命名一致性**：`craftMatch(slots, words, inv)` 三参一致；`screenToLogical(px, py, rect)` 三参（Task 5 测试多余的尾部实参在 JS 中被忽略，无害）；`doorEvent` 事件名与 main 调用一致（WORDS_COMPLETE/CLICK/OFFER/RITUAL_DONE/OPEN_DONE）；指令字段与 Task 7 词汇表逐条对齐；`makeStone` 返回对象字段（state/floorY/phase/magnet）在 Task 13 使用处补设 floorY。
4. 已知偏差（均已在计划内注明）：新增 `content-fallback.js`（规格 §12 兜底要求）；Task 8 渲染拆出 `drawOverlay` 保证暗区角色正确变暗。

## 执行方式（Execution Handoff）

计划已保存到 `docs/superpowers/plans/2026-10-01-echo-stone.md`。两种执行方式：

1. **子代理驱动（推荐）**——每个任务派一个全新子代理实现，任务间由我审查，迭代快
2. **本会话内联执行**——用 executing-plans 批量执行，检查点处停下审查

选哪种？
