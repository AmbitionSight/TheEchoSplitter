# Git 提交规范与旧历史清理 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 落地已批准的 git 规范设计：CONTRIBUTING.md 成文、旧历史 reword + 拆分、force push、建 develop、删 chapter1。

**Architecture:** 纯 git 手术，零代码改动。核心安全网是**树哈希不变量**：改写前后 `main^{tree}` 必须完全一致（reword 与拆分都不改内容，只改历史结构），以此证明零内容风险。非交互 rebase 通过 `GIT_SEQUENCE_EDITOR`/`GIT_EDITOR` 指向脚本实现（本环境不支持交互式 `-i`，但编辑器脚本化后 git 全程不碰 TTY）。reword 消息按**原主题行**精确匹配替换（改写中哈希会变，主题不变）。

**Tech Stack:** git（rebase/sed/awk）、Node test runner（终验）。

**设计稿:** `docs/superpowers/specs/2026-10-03-git-conventions-design.md`

---

## 文件结构

- Create: `docs/CONTRIBUTING.md` — 规范全文，长期保留
- Modify: `CLAUDE.md` — 增「Git 约定」小节指向 CONTRIBUTING
- Create（临时，任务 9 删除）: `.git-rewrite-tools/todo-editor.sh`、`.git-rewrite-tools/reword-editor.sh`、`.git-rewrite-msgs/catalog.txt`
- Create（临时回滚保险）: 分支 `backup-main-pre-rewrite`

## 总账

- **reword 25 条**（原哈希见任务 3 的 sed 列表与消息目录）
- **拆分 4 条**：`8583c27`→2、`e8e3091`→3、`26d7c3f`→2、`5d48439`→4
- 改写前提交数 61（含任务 1 新增），改写后 **68**
- 注意：拆分产生的中间提交不保证单独可测，正确性由最终树哈希相等 + `npm test` 兜底

**拆分取舍说明**（设计稿的降级条款）：设计稿列出的 5 个拆分候选中，`e8e3091`（第二三间房）与 `5d48439`（无前缀那条）文件边界干净，按章/按层拆开；`f0f52ac`（仪式石四修复）、`65e8804`（语音延迟两根因）、`e1b9a39`（shell/sideview 抽取）、`6b9e7a4`（ch1 接公共壳五主题）的多个主题纠缠在同一文件的相邻代码块里，拆分需要逐 hunk 手工切补丁、风险大于收益，**降级为 reword**（多主题在 body 中分条列出）。另按同一原则追加了两个文件边界干净的拆分：`8583c27`（幽灵修复 vs EOL）、`26d7c3f`（workbench 模块化 vs 语音队列）。

---

### Task 1: CONTRIBUTING.md 成文 + CLAUDE.md 引用

**Files:**
- Create: `docs/CONTRIBUTING.md`
- Modify: `CLAUDE.md`（在 `## Architecture` 一节之前插入新节）

- [ ] **Step 1: 写 CONTRIBUTING.md**

写入 `docs/CONTRIBUTING.md`：

```markdown
# 贡献指南（Git 约定）

## 分支模型（develop + main 双轨）

- `main`：稳定可玩版本。只在章节完成、回归测试全绿、真机验证过的节点上更新。
- `develop`：日常开发分支，所有日常提交落在 develop。
- develop → main 合并用 `git merge --no-ff`，保留合并节点；按章节/大功能在 main 上打 tag（`v0.x`）。
- 风险大的单项工作可从 develop 开短期分支，完成后合回 develop。

## 提交信息

格式：

    <type>: <中文主题>

    <动机与背景>

    <实现要点 / 关键决策>

    <测试与验证>

- type 集合：`feat` `fix` `docs` `refactor` `test` `chore` `ui`（视觉/布局调整）；破坏性变更 `feat!` / `fix!`。
- 主题 ≤ 32 个汉字，祈使语气，概括"做了什么"。
- 一个提交只做一件事：多主题必须拆开，禁止用"；"拼接不相关改动。
- 细节进 body：动机、实现要点、测试情况写在 body，不把主题撑长。
- 引用设计稿/计划时，body 里给出 `docs/` 下的路径。

## 推送与远端

- 远端：Gitee `origin`。
- 单人单机开发；确需改写已推送的历史时用 `git push --force-with-lease`。
```

- [ ] **Step 2: CLAUDE.md 增引用**

在 `CLAUDE.md` 的 `## Architecture` 标题行之前插入：

```markdown
## Git 约定

分支模型与提交信息规范见 `docs/CONTRIBUTING.md`：日常开发落在 `develop`，`main` 只收稳定节点（`--no-ff` 合并）；提交必须带 type 前缀（`feat/fix/docs/refactor/test/chore/ui`），主题 ≤ 32 汉字，一事一提交，细节进 body。

```

- [ ] **Step 3: 提交**

```bash
git add docs/CONTRIBUTING.md CLAUDE.md
git commit -m "docs: Git 约定成文（CONTRIBUTING 与 CLAUDE.md 引用）" -m "- docs/CONTRIBUTING.md：develop+main 双轨、提交信息规范
- CLAUDE.md 增「Git 约定」小节指向该文档
- 设计稿：docs/superpowers/specs/2026-10-03-git-conventions-design.md"
```

---

### Task 2: 改写准备——工具脚本与消息目录

**Files:**
- Create: `.git-rewrite-tools/todo-editor.sh`（临时）
- Create: `.git-rewrite-tools/reword-editor.sh`（临时）
- Create: `.git-rewrite-msgs/catalog.txt`（临时）

全部用 bash heredoc 创建（避免 CRLF；Write 工具在 Windows 上可能写出 CRLF 导致 `sh` 报 bad interpreter）。

- [ ] **Step 1: 记录树哈希与建回滚分支**

```bash
git status --porcelain        # 必须为空
git rev-parse main^{tree}     # 记下输出，任务 7 比对
git branch backup-main-pre-rewrite
```

Expected: 树哈希一行 40 位十六进制；分支创建无输出。

- [ ] **Step 2: 创建 todo-editor.sh**

```bash
mkdir -p .git-rewrite-tools .git-rewrite-msgs
cat > .git-rewrite-tools/todo-editor.sh <<'EOF'
#!/bin/sh
# 按原哈希把 pick 改成 reword / edit
sed -i -E 's/^pick (e531400|3995b1b|d84176f|90cf059|866c9dd|b0cf06b|a758228|eff73e7|cefb446|50dd0a3|f0f52ac|be597a4|b9ea1ad|ff6b66a|891f57d|754ab49|65e8804|1d821eb|e1b9a39|6b9e7a4|fa2825a|d4a9168|411dfd5|d5c4bf9|6d7f16b) /reword \1 /' "$1"
sed -i -E 's/^pick (8583c27|e8e3091|26d7c3f|5d48439) /edit \1 /' "$1"
cat "$1" >&2
EOF
chmod +x .git-rewrite-tools/todo-editor.sh
```

- [ ] **Step 3: 创建 reword-editor.sh**

```bash
cat > .git-rewrite-tools/reword-editor.sh <<'EOF'
#!/bin/sh
# 用法: reword-editor.sh <COMMIT_EDITMSG>
# 按原主题行在 $CATALOG 中查找替换消息；找不到则原样保留
f="$1"
subj=$(head -n 1 "$f")
awk -v subj="$subj" '
  $0=="<<<ORIG>>>" {mode="orig"; next}
  $0=="<<<NEW>>>"  {mode="new"; next}
  $0=="<<<END>>>"  {mode=""; next}
  mode=="orig"     {hit=($0==subj)}
  mode=="new" && hit {print}
' "$CATALOG" > "$f.new"
if [ -s "$f.new" ]; then mv "$f.new" "$f"; else rm -f "$f.new"; fi
EOF
chmod +x .git-rewrite-tools/reword-editor.sh
```

- [ ] **Step 4: 创建消息目录 catalog.txt**

`<<<ORIG>>>` 段必须与原主题**逐字一致**（含全角括号、破折号、空格）。

```bash
cat > .git-rewrite-msgs/catalog.txt <<'EOF'
<<<ORIG>>>
test: 服务器测试改用 t.after 拆卸防悬挂 + door.ipa 一致性不变量（Task 1 评审遗留）
<<<NEW>>>
test: 服务器测试防悬挂与 door.ipa 不变量

- 服务器测试改用 t.after 拆卸，防句柄悬挂
- 新增 door.ipa 一致性不变量（Task 1 评审遗留）
<<<END>>>
<<<ORIG>>>
fix: 补 ᛟ 门之符文折线（Task 8 依赖）+ drawIcon 状态隔离
<<<NEW>>>
fix: 补 ᛟ 门之符文折线与 drawIcon 状态隔离

- 补全 ᛟ（OE）符文折线数据，Task 8 依赖
- drawIcon 状态隔离，避免调用间残留
<<<END>>>
<<<ORIG>>>
feat: TTS 音色打分/口型脉冲/估时兜底 + WebAudio 合成音效
<<<NEW>>>
feat: 音频层——TTS 打分与 WebAudio 音效

- TTS 音色打分/口型脉冲/估时兜底
- WebAudio 合成音效
<<<END>>>
<<<ORIG>>>
fix: 女声名 male 子串误判（FEMALE 先判）+ speak 非字符串不 reject（含回归测试）
<<<NEW>>>
fix: 女声名子串误判与 speak 非字符串两处

- 女声名含 male 子串误判：FEMALE 列表先判
- speak 非字符串入参不 reject，走兜底
- 含回归测试
<<<END>>>
<<<ORIG>>>
fix: inside 恢复画布语义（测试改用带黑边矩形）+ 碰撞圆心退化推出（计划同步）
<<<NEW>>>
fix: inside 画布语义与碰撞圆心退化两处

- inside 恢复画布语义，测试改用带黑边矩形
- 碰撞圆心退化时按向量推出
- 计划文档同步
<<<END>>>
<<<ORIG>>>
feat: 游戏事件机（碰/拾/拼/用/门/提示/跳拍）纯逻辑与全套测试（含 hello-末位门醒修正与测试解构/门词源两处笔误修复）
<<<NEW>>>
feat: 第一章游戏事件机纯逻辑与测试

- 碰/拾/拼/用/门/提示/跳拍全流程
- 修正 hello 末位门醒
- 测试解构与门词源笔误两处修复
<<<END>>>
<<<ORIG>>>
feat: MC 式工具栏 DOM（合成槽/渐进共鸣/点读/跨层拖拽幽灵）+ crafting 开关修复与回归测试
<<<NEW>>>
feat: MC 式工具栏 DOM 与合成交互

- 合成槽/渐进共鸣/点读/跨层拖拽幽灵
- 修 crafting 开关不生效，附回归测试
<<<END>>>
<<<ORIG>>>
fix: 拖拽事件按 pointerId 过滤（防多点误触）+ 自动合成移出渐进共鸣开关（防关灯死锁）
<<<NEW>>>
fix: 多点误触与关灯死锁两处

- 拖拽事件按 pointerId 过滤，防多点误触
- 自动合成移出渐进共鸣开关，防关灯死锁
<<<END>>>
<<<ORIG>>>
fix: 符文发光呼吸改作用于 canvas（原 .rune 文字选择器为死规则）+ 未点亮格光标语义
<<<NEW>>>
fix: 符文呼吸动画与未点亮格光标

- 发光呼吸改作用于 canvas（原 .rune 文字选择器是死规则）
- 未点亮格光标改 not-allowed 语义
<<<END>>>
<<<ORIG>>>
feat: 主循环全接线（输入/交互/指令解释器/门仪式/调试钩子）+ 评审遗留九项修正（门后风声/jump防双拾取/仪式期静默/touch加固/揭示兜底等）
<<<NEW>>>
feat: 主循环全接线与评审遗留修正

- 输入/交互/指令解释器/门仪式/调试钩子接入主循环
- 评审遗留九项：门后风声、jump 防双拾取、仪式期静默、touch 加固、揭示兜底等
<<<END>>>
<<<ORIG>>>
fix: 仪式石双渲染与磁吸盗取 + 点击走位死锁（每帧交互半径检查/卡死放弃/落点钳制）+ 座位光晕叠加 + 音频恢复/失焦按键/跳拍重放加固
<<<NEW>>>
fix: 仪式交互与音频失焦五处加固

- 仪式石双渲染与磁吸盗取
- 点击走位死锁：每帧交互半径检查/卡死放弃/落点钳制
- 座位光晕叠加
- 音频恢复/失焦按键/跳拍重放
<<<END>>>
<<<ORIG>>>
fix: hello 拼出后须持气泡面见大叔才庆祝（回礼后指向开关）+ 右半黑暗加深
<<<NEW>>>
fix: hello 庆祝流程与右半黑暗

- hello 拼出后须持气泡面见大叔才庆祝，回礼后指向开关
- 右半黑暗加深
<<<END>>>
<<<ORIG>>>
ui: 场景美术升级——MC 风合成台（厚板/粗腿/内嵌四石槽，持石时发光招手）+ 砖墙扰动渐变 + 挂毯 + 月窗光池 + 火把托架 + 地板倒角砖缝
<<<NEW>>>
ui: 场景美术升级为 MC 风

- 合成台：厚板/粗腿/内嵌四石槽，持石时发光招手
- 砖墙扰动渐变/挂毯/月窗光池/火把托架/地板倒角砖缝
<<<END>>>
<<<ORIG>>>
feat: 内网部署——默认 3001 端口监听 0.0.0.0 + HTTP Basic 认证（timingSafeEqual 比对，测试覆盖 401 质询）
<<<NEW>>>
feat: 内网部署——3001 端口与 Basic 认证

- 默认 3001 端口监听 0.0.0.0
- HTTP Basic 认证（timingSafeEqual 比对）
- 测试覆盖 401 质询
<<<END>>>
<<<ORIG>>>
ui: 合成台上移全露+蜡烛聚焦、黑暗边界右收(610-740)、开关重画为四角螺丝摇杆式+LED
<<<NEW>>>
ui: 合成台布局与开关重画

- 合成台上移全露、蜡烛聚焦
- 黑暗边界右收（610-740）
- 开关重画为四角螺丝摇杆式 + LED
<<<END>>>
<<<ORIG>>>
feat: 认证可开关（默认开；AUTH=0 关闭）——3001 内网带认证 / 3000 本机免认证
<<<NEW>>>
feat: 认证可开关

- 默认开启；AUTH=0 环境变量关闭
- 3001 内网带认证 / 3000 本机免认证
<<<END>>>
<<<ORIG>>>
fix: 语音延迟根因——起音看门狗（1.2s 哑火即 cancel 放行队列）+ 开局静音热身（预拉移动端网络音型）
<<<NEW>>>
fix: 语音延迟两处根因

- 起音看门狗：1.2s 哑火即 cancel 放行队列
- 开局静音热身：预拉移动端网络音型
<<<END>>>
<<<ORIG>>>
ux: 词具再点物品栏=放下（toggle）；全部提示/序章/说明文案去 AI 腔（短句、去破折号、去教程式完整句）
<<<NEW>>>
ui: 词具放下交互与文案去 AI 腔

- 词具再点物品栏 = 放下（toggle）
- 提示/序章/说明文案改短句，去破折号与教程腔
<<<END>>>
<<<ORIG>>>
refactor: 抽公共壳 shell.js（启动/音频/E系统/指令解释器/结算）+ 横版共用件 sideview.js（物理与渲染）；ch2/ch3 瘦身接入（行为不变，66 测试全绿）
<<<NEW>>>
refactor: 抽公共壳 shell 与横版共用件 sideview

- shell.js：启动/音频/E 系统/指令解释器/结算
- sideview.js：横版物理与渲染共用件
- ch2/ch3 瘦身接入，行为不变（66 测试全绿）
<<<END>>>
<<<ORIG>>>
refactor: ch1 接入公共壳（main.js 瘦身为纯事件机+俯视 kit）；修 autostart 事件早派发 bug；按角色还原慢速语速；/api/chapter[1-9] 路由泛化；书档只带本章需要的旧音素（neededSeeds）
<<<NEW>>>
refactor: ch1 接入公共壳

- main.js 瘦身为纯事件机 + 俯视 kit
- 修 autostart 事件早派发 bug
- 按角色还原慢速语速
- /api/chapter[1-9] 路由泛化
- 书档只带本章需要的旧音素（neededSeeds）
<<<END>>>
<<<ORIG>>>
feat: 教学拍与析声录；项目更名析声者 The Echo Splitter
<<<NEW>>>
feat: 教学拍与析声录，项目更名

- 教学拍与析声录内容/UI
- 项目更名析声者 The Echo Splitter：README/文档/页面标题
<<<END>>>
<<<ORIG>>>
feat: 西墙回声物与门之低语；析声录生涯词库；布景对齐回归修复
<<<NEW>>>
feat: 西墙回声物与门之低语

- 西墙回声物与门之低语
- 析声录生涯词库
- 布景对齐回归修复
<<<END>>>
<<<ORIG>>>
fix: 共享 syncHeld 兼容第一关世界形状（hand 指令 TypeError 曾致第一关不可通关）
<<<NEW>>>
fix: 共享 syncHeld 兼容第一关世界形状

- hand 指令 TypeError 曾致第一关不可通关
<<<END>>>
<<<ORIG>>>
fix: glow 椭圆重载修复开灯即死机（7 参错位致 color.replace TypeError 杀死 RAF）
<<<NEW>>>
fix: glow 椭圆重载开灯死机

- 7 参错位致 color.replace TypeError 杀死 RAF，对齐重载签名修复
<<<END>>>
<<<ORIG>>>
docs: git 提交规范与分支模型设计稿（develop+main 双轨、提交信息规范、旧历史清理方案）
<<<NEW>>>
docs: git 提交规范与分支模型设计稿

- develop+main 双轨、提交信息规范、旧历史清理方案
<<<END>>>
EOF
```

- [ ] **Step 5: 冒烟测试两个脚本**

```bash
printf 'pick e531400 test: x\npick 41666fe feat: y\npick 8583c27 fix: z\n' > /tmp/todo-test
sh .git-rewrite-tools/todo-editor.sh /tmp/todo-test
cat /tmp/todo-test
printf 'test: 服务器测试改用 t.after 拆卸防悬挂 + door.ipa 一致性不变量（Task 1 评审遗留）\n\n# 注释\n' > /tmp/msg-test
CATALOG="$PWD/.git-rewrite-msgs/catalog.txt" sh .git-rewrite-tools/reword-editor.sh /tmp/msg-test
cat /tmp/msg-test
```

Expected: 第一段输出 3 行——`reword e531400 …`、`pick 41666fe …`（未标记，原样）、`edit 8583c27 …`；第二段输出新主题 `test: 服务器测试防悬挂与 door.ipa 不变量` + 空行 + 两条 body（注释行被替换掉）。任何一段不符则停下修脚本，不得进入 Task 3。

---

### Task 3: 启动 rebase，第一停靠 8583c27（拆 2）

- [ ] **Step 1: 发起 rebase**

```bash
export CATALOG="$PWD/.git-rewrite-msgs/catalog.txt"
export GIT_SEQUENCE_EDITOR="$PWD/.git-rewrite-tools/todo-editor.sh"
export GIT_EDITOR="$PWD/.git-rewrite-tools/reword-editor.sh"
git rebase -i e85bcb2
```

Expected: stderr 打印改写后的 todo；rebase 停在第一个 `edit`——`8583c27`（提示 "stopped at ..."）。若中途 reword 停靠报错，检查 catalog 中 ORIG 行是否与原主题逐字一致。

- [ ] **Step 2: 拆分 8583c27**

该提交只改 3 个文件：`public/index.html`（幽灵修复）、`.gitattributes`、`docs/superpowers/plans/2026-10-01-echo-stone.md`（EOL）。

```bash
git reset HEAD^
git add public/index.html
git commit -m "fix: 拖拽幽灵移出 transform 舞台" -m "- 修复 fixed 定位随 transform 舞台偏移（包含块错误）"
git add .gitattributes docs/superpowers/plans/2026-10-01-echo-stone.md
git commit -m "chore: .gitattributes 统一 EOL" -m "- 计划文档同步换行规范"
git status --porcelain    # 必须为空
git rebase --continue
```

Expected: 两个提交创建；rebase 继续到下一停靠 `e8e3091`。

---

### Task 4: 第二停靠 e8e3091（拆 3）

- [ ] **Step 1: 拆分 e8e3091（第二、三间房）**

文件分组：跨关基建 = `profile.js + test/profile.test.js + server.js + main.js + art.js + test/art.test.js`；jump = `chapter2.json + chapter2.html + ch2.js + test/ch2.test.js`；rope = `chapter3.json + chapter3.html + ch3.js + test/ch3.test.js`。

```bash
git reset HEAD^
git add public/js/profile.js test/profile.test.js server.js public/js/main.js public/js/art.js test/art.test.js
git commit -m "feat: 跨关基建——书档携带与路由" -m "- profile 声音书档跨关携带（含测试）
- /api/chapterN 路由
- 结算「下一间房」入口
- art 图鉴图标扩充"
git add content/chapter2.json public/chapter2.html public/js/ch2.js test/ch2.test.js
git commit -m "feat: 第二间房 jump" -m "- 空格尝试/红叉气泡/记忆凝石 p/跳跃物理/深渊软重生
- 事件机与横版 kit、内容与测试"
git add content/chapter3.json public/chapter3.html public/js/ch3.js test/ch3.test.js
git commit -m "feat: 第三间房 rope" -m "- 断绳低语/绳索补全/攀爬
- 事件机与横版 kit、内容与测试"
git status --porcelain    # 必须为空
git rebase --continue
```

Expected: 三个提交创建；rebase 继续到 `26d7c3f`。

---

### Task 5: 第三停靠 26d7c3f（拆 2）

- [ ] **Step 1: 拆分 26d7c3f（workbench 模块化 / 语音队列）**

分组：语音 = `public/js/audio.js + test/audio.test.js`；其余全部归 workbench 提交（含 CLAUDE.md）。

```bash
git reset HEAD^
git add -- . ':(exclude)public/js/audio.js' ':(exclude)test/audio.test.js'
git commit -m "feat: 合成台新操作全关卡化与模块化" -m "- 抽 workbench.js/chapter.js 共享层，四关卡接入瘦身
- hotbar/kit 相应改造与测试"
git add public/js/audio.js test/audio.test.js
git commit -m "feat: 语音队列点读最新优先" -m "- SpeechQueue 点读 lane 改 latest-wins，快速点读不再堆积"
git status --porcelain    # 必须为空
git rebase --continue
```

Expected: 两个提交创建；rebase 继续到 `5d48439`。

---

### Task 6: 最后停靠 5d48439（拆 4）并完成 rebase

- [ ] **Step 1: 拆分 5d48439**

分组：素材 = `tupian/ + public/assets/ + server.js`；前三关 UI = `content/chapter2.json content/chapter3.json public/js/{ch2,ch3,scene,art,door,main,shell,sideview,sprites}.js test/{art,ch2,ch3,door,game}.test.js`；ch4 = `content/chapter4.json public/chapter4.html public/js/ch4.js test/ch4.test.js`；CLAUDE.md 单独。

```bash
git reset HEAD^
git add tupian public/assets server.js
git commit -m "chore: 入库像素素材与源图" -m "- tupian/ 素材源图
- public/assets 墙/地/道具 webp
- server MIME 补 webp"
git add content/chapter2.json content/chapter3.json public/js/ch2.js public/js/ch3.js public/js/scene.js public/js/art.js public/js/door.js public/js/main.js public/js/shell.js public/js/sideview.js public/js/sprites.js test/art.test.js test/ch2.test.js test/ch3.test.js test/door.test.js test/game.test.js
git commit -m "ui: 前三关界面优化" -m "- sprites/scene/sideview 接入新素材
- ch2/ch3 视觉与交互打磨，door/main/shell/art 联动
- 内容与测试同步"
git add content/chapter4.json public/chapter4.html public/js/ch4.js test/ch4.test.js
git commit -m "feat: 第四关主线" -m "- ch4 事件机 + 横版 kit
- chapter4 内容/页面/测试"
git add CLAUDE.md
git commit -m "docs: CLAUDE.md 项目指引" -m "- 项目概览/命令/架构/测试边界"
git status --porcelain    # 必须为空
git rebase --continue
```

Expected: 四个提交创建；此后剩余 reword 全部经 catalog 自动替换，rebase 跑完回到命令行（无残留状态，`git status` 显示 on branch main, clean）。

- [ ] **Step 2: 确认 rebase 干净结束**

```bash
git status
ls .git/rebase-merge 2>/dev/null || echo "no rebase in progress"
```

Expected: working tree clean，无 rebase 进行中。

---

### Task 7: 改写验证

- [ ] **Step 1: 树哈希比对（最关键）**

```bash
git rev-parse main^{tree}
```

Expected: 与任务 2 Step 1 记录的哈希**完全一致**。不一致 = 内容被改坏，立即 `git reset --hard backup-main-pre-rewrite` 回滚并排查，不得推送。

- [ ] **Step 2: 提交数与格式合规**

```bash
git log --oneline | wc -l                 # 期望 68
git log --pretty=format:%s | grep -cvE '^(feat|fix|docs|refactor|test|chore|ui)(!)?: '   # 期望 0
git log --pretty=format:%s | awk 'length($0)>48'                                         # 人工过目，不应有超长主题
```

- [ ] **Step 3: 主题人工抽查**

```bash
git log --oneline | head -40
```

Expected: 全部为 `type: 短主题`，无"；"拼接、无 `ux:` 类型、拆分出的 11 条新提交在列（素材入库/前三关 UI/第四关/CLAUDE 指引/跨关基建/jump/rope/workbench 模块化/语音队列/拖拽幽灵/EOL）。

- [ ] **Step 4: npm test**

```bash
npm test
```

Expected: 全部 pass，0 fail（树哈希已证内容不变，此为冗余兜底）。

---

### Task 8: force push + 建 develop + 删 chapter1

- [ ] **Step 1: force push main**

```bash
git push --force-with-lease origin main
```

Expected: 推送成功，无拒绝。

- [ ] **Step 2: 建 develop 并推送、切换**

```bash
git branch develop
git push -u origin develop
git switch develop
```

Expected: develop 与 main 同顶，成为当前分支。

- [ ] **Step 3: 删 chapter1（本地 + 远端）**

注意：历史已改写，旧链不再是 main 祖先，本地必须用 `-D`。

```bash
git branch -D chapter1
git push origin --delete chapter1
```

Expected: 本地与远端 chapter1 均删除。

---

### Task 9: 清理与终验

- [ ] **Step 1: 清理临时产物**

```bash
rm -rf .git-rewrite-tools .git-rewrite-msgs
unset CATALOG GIT_SEQUENCE_EDITOR GIT_EDITOR
git branch -D backup-main-pre-rewrite
```

（backup 分支确认一切正常后才删；若想保留一段时间也可以，告知用户即可。）

- [ ] **Step 2: 终验——对照设计稿验收标准逐条确认**

```bash
git fetch origin
git status -sb                                   # develop 与 origin/develop 同步
git branch -a                                    # 仅 main/develop + 远端同名
git log origin/main --oneline -3                 # 与本地 main 一致
git log --oneline | wc -l                        # 68
ls docs/CONTRIBUTING.md                          # 存在
grep -n "CONTRIBUTING" CLAUDE.md                 # 有引用
```

Expected: 设计稿 5 条验收标准全部满足。

- [ ] **Step 3: 提交计划勾选与收尾说明**

无需新提交（改写不引入任何工作区变化）。向用户汇报：新分支模型、68 条历史、删除的 chapter1、后续日常落在 develop。

---

## 回滚预案

任一步出错且无法前进时：

```bash
git rebase --abort 2>/dev/null
git reset --hard backup-main-pre-rewrite
```

推送前一切都在本地，回滚零成本；Task 8 Step 1 是不可逆点，之前的树哈希验证（任务 7 Step 1）是该点的强制前置。
