# 调研与环境记录

- 项目最初为空 Git 仓库；现有产品设计位于 `docs/superpowers/specs/2026-11-06-online-monopoly-design.md`。
- 用户已审核设计；确认虚构现代城市、轻松清晰的桌游插画风格。
- 服务器使用目标：通常同时一局，4-8 人；不为多房间扩展提前引入 Redis。
- 本地环境：Node.js v24.16.0、npm 11.13.0、pnpm 11.22.0；本机没有 Docker CLI。
- Vite 官方指南要求 Node.js 20.19+ 或 22.12+，本机 Node 24 满足要求。
- Socket.IO 的房间可按房间范围广播；单服务实例初期采用默认内存 adapter 即可。
- 并行批次接口：进度 API 提供 `GET /health`、`GET /api/suggestions`、`POST /api/suggestions`，`DATABASE_URL` 指向 PostgreSQL，默认端口 3002。
- Nginx 单入口：游戏站 `/`、进度站 `/progress/`、Socket.IO `/socket.io/`、留言 API `/api/`；生产游戏客户端使用同源 Socket.IO。
- 部署仅一台 Ubuntu 单实例：无需 Redis；Postgres 使用命名卷。云端域名与 TLS 证书尚无，需留文档手工配置步骤。
- 拍卖代码审查发现最高出价者被临时排除，若被超价无法再次竞价；规则子任务应覆盖出价轮转/重新入场。

## 2026-11-09 玩家交易实现发现
- 交易设计见 `docs/superpowers/specs/2026-11-09-player-trading-design.md`；待处理报价属于房间传输状态，不应加入公开 `GameState`。
- 规则包以纯函数状态变更为主；交易结算可接受双方现金和地产编号，在一个新状态中更新现金、所有权和日志。
- 目前只有 `game-rules` 有 Vitest 脚本；服务端没有自动化测试脚手架，因此服务端行为需优先通过类型检查和多客户端浏览器验证。
- 现有服务端广播经 `broadcastRoom` 统一发送房间和棋局状态；新报价需要在房间创建/加入/断线重连等广播场景中同步。
