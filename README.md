# 世界杯账本

英文项目名：`world-cup-ledger`

一个完全 Docker 部署的世界杯记账应用。支持自建用户名密码登录、邀请码注册、共享盘口、个人投注、结算、统计、深色/浅色模式和移动端访问。

## 功能

- 用户名/密码登录，邀请码注册，后台用户和邀请码管理。
- 同一个账本组共享盘口，多个用户可以在同一盘口下分别记录投注。
- 支持手动创建盘口，也支持从世界杯赛程快速创建自动结算盘口。
- 从 ESPN FIFA World Cup scoreboard 同步赛程、比分和完赛状态。
- 从赛程创建的盘口会按“球队 + 盘口值”在完赛后自动结算为赢、输、走水、半赢或半输。
- Docker 内置 `worker` 服务定时同步比分，不依赖宿主机 cron。

## 启动

```bash
cp .env.example .env
docker compose up -d --build
```

访问：

```text
http://localhost:13218
http://局域网IP:13218
https://world-cup.vl1n.icu
```

默认管理员来自 `.env`：

```text
ADMIN_USERNAME=admin
ADMIN_PASSWORD=change-me-strong-password
```

首次迁移时会创建默认账本和管理员；已有用户时不会覆盖。

## 赛程和自动结算

默认数据源不需要 API key：

```text
https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard
```

相关环境变量：

```text
APP_TIME_ZONE=Asia/Shanghai
SYNC_SECRET=change-this-sync-secret-at-least-32-chars
SCORE_SYNC_INTERVAL_SECONDS=300
SCORE_SYNC_RETRY_SECONDS=15
WORLD_CUP_DATES=20260611-20260719
WORLD_CUP_SCOREBOARD_LIMIT=200
```

页面上可以在 `/schedule` 手动同步赛程/结算；Docker 的 `worker` 服务会按 `SCORE_SYNC_INTERVAL_SECONDS` 定时同步。公网部署时务必把 `SYNC_SECRET` 改成强随机值。

自动结算只作用于从赛程页创建、且开启 `auto_settle` 的盘口。手动创建的旧盘口不会被自动改状态。

## 反向代理

如果用 `world-cup.vl1n.icu` 反代到本机 `13218` 端口，Nginx 至少保留：

```nginx
proxy_set_header Host $host;
proxy_set_header X-Forwarded-Proto $scheme;
```

## 常用命令

```bash
docker compose ps
docker compose logs -f web
docker compose logs -f worker
docker compose logs -f migrate
docker compose down
```

Docker Compose 项目名固定为 `world-cup-ledger`，容器名会类似
`world-cup-ledger-web-1`、`world-cup-ledger-api-1`。
