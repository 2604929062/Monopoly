# Ubuntu 24.04 部署

## 组成与前置条件

Compose 启动单实例游戏服务、游戏静态站、进度静态站、进度 API、PostgreSQL 和 Nginx。公网只开放 Nginx 的 HTTP 端口；Socket.IO 与 API 走同源反向代理，数据库及应用端口仅在 Compose 内网可见。适用于一局 4–8 人的轻量部署，不包含多副本、负载均衡或自动扩缩容。

仓库使用 pnpm workspace，构建镜像基于 Node.js 24；运行机器需安装 Docker Engine 和 Docker Compose 插件。进度 API 已集成在 `apps/progress-api`，启动时自动创建建议表，提供 `GET /health`、`GET /api/health` 健康检查以及建议读写接口。

## 本地启动

在仓库根目录执行：

```sh
cp .env.example .env
```

编辑 `.env`，为 `POSTGRES_PASSWORD` 填入随机长密码，建议使用 URL-safe 字符（字母、数字、`_`、`-`），因为 API 使用 `DATABASE_URL` 连接数据库。生产环境同时将 `PUBLIC_ORIGIN` 设为浏览器实际访问的完整来源，例如 `https://game.example.com`（不带路径、末尾不加斜线）。随后运行：

```sh
docker compose up -d --build
docker compose ps
```

主页提供游戏；进度站位于 `/progress/`；API 位于 `/api/`；Socket.IO 使用 `/socket.io/`。默认 HTTP 端口为 80，可通过 `HTTP_PORT` 修改。Nginx 的 `/api/` location 与 `proxy_pass http://progress-api:3002/api/;` 都带 `/api/` URI 前缀。Nginx 会用 `proxy_pass` 中的 URI 前缀替换匹配到的 location 前缀，因此此处是等长替换，实际保留 API 前缀：客户端 `GET /api/suggestions` 转发为后端 `GET /api/suggestions`，不是 `/suggestions`。后端路由应按 `/api/suggestions` 注册。容器健康检查则直接请求 API 容器的 `GET /health`，不经过 Nginx。检查日志：

```sh
docker compose logs -f nginx game-server progress-api
```

## 域名与 HTTPS

Compose 当前只提供 HTTP，不会申请证书或自动配置域名。部署前需在云平台安全组和 Ubuntu 防火墙放行 80/443，将域名 A/AAAA 记录指向服务器，并选择一种 TLS 终止方式：在宿主机用 Certbot 管理 Nginx/证书，或在 Compose 前增加经审核的 TLS 代理。配置证书后确保 HTTPS 请求的 `/socket.io/` WebSocket Upgrade 与 `/api/` 路由仍转发至本 Compose 网络，并把 `.env` 的 `PUBLIC_ORIGIN` 改为 `https://` 来源，再重建 `game-server`。不要将数据库端口或 3001/3002 端口映射到公网。

## Gitee 手动部署

首次部署时将代码推送至 Gitee，在服务器克隆仓库并进入项目目录；创建 `.env`（可参考 `.env.example`，不要提交真实密钥），确认安全组和域名设置后执行 `docker compose up -d --build`。之后手动更新：

```sh
git pull --ff-only
docker compose up -d --build
docker compose ps
```

更新前建议先备份数据库。不要用 `docker compose down -v`，它会删除数据库卷。

## 数据库备份与恢复

备份至当前目录的带日期文件：

```sh
docker compose exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc' > "citygame-$(date +%F-%H%M%S).dump"
```

恢复前先停止 API 写入，并确认目标库数据可以被覆盖。将 `BACKUP_FILE` 替换为备份文件路径：

```sh
docker compose stop progress-api
cat BACKUP_FILE | docker compose exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner'
docker compose start progress-api
```

备份文件应复制到服务器以外的安全存储，并定期验证恢复流程。

## 应用集成提醒

- 游戏前端开发环境回退到 `http://localhost:3001`，生产环境使用当前页面来源和默认 `/socket.io/`；镜像构建时设 `VITE_GAME_SERVER_URL=/`。该值与服务端的 CORS 来源变量 `GAME_WEB_ORIGIN` 分开配置。
- 进度站用 Vite CLI `--base=/progress/` 生成子路径资源，不修改应用配置。SPA 路由刷新回退到 `/progress/index.html`。
- Compose 设 `GAME_WEB_ORIGIN=${PUBLIC_ORIGIN:-http://localhost}`；如果进度站 API 需要跨域则应改为同源相对 `/api/`，无需额外 CORS 来源。
- progress-api 需读取 `DATABASE_URL`、监听 `0.0.0.0:3002`；本地直接运行 `pnpm dev:progress-api` 前需先准备 PostgreSQL，生产环境由 Compose 自动提供数据库。
