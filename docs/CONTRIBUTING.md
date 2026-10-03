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
