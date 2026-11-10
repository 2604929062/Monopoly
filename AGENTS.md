# 项目协作约定

- 开始开发前，先看 `.planning/monopoly-online/progress.md`，只读取当前任务相关的规则和代码。
- 游戏规则以 `docs/game-rules-v1.md` 为准；权威规则逻辑放在 `packages/game-rules`，服务端负责裁定。
- 游戏开发任务使用项目技能 `.agents/skills/big-game-dev/SKILL.md`；按任务范围选择性调用 `codebase`、`planning-with-files` 和 `playwright`，避免重复加载无关资料。
- 多阶段任务在 `.planning/monopoly-online/progress.md` 记录已完成事项、验证结果和下一步；会话较长时同步更新 `docs/continue-at-home-prompt.md`。
- 遇到 `stream disconnected before completion` 或远程压缩错误时，不要连续重试压缩。先把进度写入上述文件，再在同一项目目录开新会话继续。
- 不要把真实 API Key、数据库密码或服务器密钥写入项目文件。
- 修改完成后按相关性运行测试；完整验证命令为 `pnpm test`、`pnpm typecheck`、`pnpm build` 和 `git diff --check`。
