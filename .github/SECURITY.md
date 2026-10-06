# 安全策略

## 影响面

析声者是**零依赖、无构建**的本地浏览器游戏：

- 服务端 `server.js` 只用 Node 内置 `http`，职责限于 `public/` 静态分发与 `/api/chapterN` 内容读取；
- 客户端是原生 ES Modules + Canvas，不发起任何第三方请求，不采集数据，不用麦克风，没有账号体系；
- 仓库没有 `node_modules`，供应链风险面基本只剩 GitHub Actions 用到的第三方 action。

因此真正相关的安全问题主要是这几类：

- `server.js` 的静态路径穿越（已通过把解析结果约束在 `public/` 内来防御）
- 内容接口对章节号与路径的校验
- CI 工作流的权限与第三方 action 版本

## 报告方式

**请不要开公开 issue。** 走 GitHub 的[私密漏洞报告](https://github.com/AmbitionSight/TheEchoSplitter/security/advisories/new)。

请一并附上：复现步骤、受影响的提交或版本、你的环境（Node 版本 + 浏览器），以及你判断的影响面。

## 支持范围

项目只按 `main` 分支的最新提交维护，不为历史提交回补补丁。