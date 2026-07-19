# hl-aigc

基于 [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack) 的全栈 TypeScript monorepo。

## 当前功能

详见 `docs/PRD.md` 与 `specs/1.github-account-sync/`：

- **GitHub 账户信息同步**（`/github-sync`，公开页面）：用户输入 GitHub Personal Access Token，服务端调用 GitHub `GET /user` 拉取账户信息并按 `githubId` 幂等写入数据库。Token 全链路不落盘、不写日志、不回传；同步接口按客户端 IP 限流（60 秒 5 次）。
- **自定义字段管理**（`/admin/fields`，仅管理员）：对用户信息表新增/删除自定义字段（text/textarea/number/boolean/datetime），`key` 全局唯一，删除走事务级联清理并写审计日志（`field_audit_logs`）。
- **认证与权限**：better-auth 邮箱密码登录；`user.role`（`user` | `admin`）驱动管理员权限，字段管理接口由 tRPC `adminProcedure` 鉴权，前端路由再叠加登录保护。

## 技术栈

- **Monorepo**: pnpm workspaces + Turborepo
- **后端** (`apps/server`): Hono + tRPC + Drizzle ORM (PostgreSQL) + better-auth
- **前端** (`apps/web`): Vite + React 19 + TanStack Router/Query + Tailwind v4 + shadcn/ui
- **Lint/Format**: Biome（经由 Ultracite 预设）

## 目录结构

```text
hl-aigc/
├── apps/
│   ├── web/       # 前端 (Vite + React 19，端口 3001)
│   └── server/    # 后端 (Hono + tRPC，默认端口 3000)
├── packages/
│   ├── api/       # tRPC 路由 / 业务逻辑
│   ├── auth/      # better-auth 配置
│   ├── config/    # 共享 tsconfig
│   ├── db/        # Drizzle schema / migrations
│   ├── env/       # 环境变量校验 (zod)
│   └── ui/        # 共享 shadcn/ui 组件
├── specs/         # 功能规格文档 (requirements / design / tasks)
└── docs/PRD.md    # 产品需求文档
```

## 本地开发

```bash
pnpm install

# 配置环境变量（按注释填写）
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env

# 准备一个 PostgreSQL（示例：Docker）
docker run -d --name hl-aigc-pg -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=hl_aigc -p 5432:5432 postgres:17-alpine

# 同步数据库结构（本地开发用 push；生产走 migration，见下文）
pnpm db:push

# 启动前后端
pnpm dev
```

前端 [http://localhost:3001](http://localhost:3001)，后端 [http://localhost:3000](http://localhost:3000)。

## 环境变量

| 变量 | 位置 | 说明 |
| --- | --- | --- |
| `DATABASE_URL` | `apps/server/.env` | PostgreSQL 连接串（必填） |
| `BETTER_AUTH_SECRET` | `apps/server/.env` | better-auth 签名密钥，≥32 字符（必填） |
| `BETTER_AUTH_URL` | `apps/server/.env` | 服务端对外地址（必填，生产为 HTTPS） |
| `CORS_ORIGIN` | `apps/server/.env` | 前端来源，用于 CORS 与 trustedOrigins（必填） |
| `PORT` | `apps/server/.env` | 服务端监听端口，默认 3000 |
| `NODE_ENV` | `apps/server/.env` | 默认 `development` |
| `VITE_SERVER_URL` | `apps/web/.env` | 后端地址，Vite **构建时**内联（必填） |

所有变量经 `packages/env`（zod）校验，缺失或非法会在启动/构建时报错。

## 生产部署

### 1. 构建

```bash
pnpm install
pnpm build   # server 产物 apps/server/dist/，web 产物 apps/web/dist/
```

注意：`VITE_SERVER_URL` 在 `vite build` 时被内联进前端产物，构建前必须设置为线上后端地址。

### 2. 数据库迁移

生产环境使用受控 migration（不要用 `db:push`）：

```bash
# 确保 DATABASE_URL 指向生产库（drizzle.config.ts 读取 apps/server/.env 或进程环境变量）
pnpm db:migrate
```

迁移文件位于 `packages/db/src/migrations/`，当前为 `0000_worthless_dragon_lord.sql`（8 张表：better-auth 4 张 + `github_users`、`user_field_definitions`、`user_field_values`、`field_audit_logs`）。

### 3. 启动服务端

```bash
cd apps/server && node dist/index.mjs
```

服务端产物由 tsdown 打包（workspace 包已内联），运行时只需 Node ≥ 20 与 `.env`/进程环境变量。

### 4. 部署前端

`apps/web/dist/` 为纯静态产物，可部署到任意静态托管（Nginx、Vercel、CDN 等）。SPA 需配置 history fallback（所有路径回退到 `index.html`）。

### 5. 提升首个管理员

注册首个账号后，手动执行 SQL 将其提升为管理员（V1.0 无角色管理 UI，为既定方案，见 `specs/1.github-account-sync/tasks.md` 风险点）：

```sql
UPDATE "user" SET role = 'admin' WHERE email = 'you@example.com';
```

### 部署注意事项

- **必须 HTTPS**：session cookie 为 `secure + sameSite=none`，非 HTTPS 环境（localhost 除外）登录态无法建立。
- **反向代理**：同步接口限流依赖 `x-forwarded-for`/`x-real-ip` 识别客户端 IP，请确保代理正确透传；取不到时退化为共享 `unknown` 桶。
- **单实例假设**：限流为进程内存实现，多实例部署时阈值按实例数放大；如需多实例，先接入集中式限流（Redis 等）。
- **CORS**：`CORS_ORIGIN` 只支持单一来源，前端域名变更时需同步修改。

## 常用脚本

- `pnpm dev` / `pnpm dev:web` / `pnpm dev:server`：开发模式
- `pnpm build`：构建所有应用
- `pnpm check-types`：全仓库类型检查
- `pnpm check` / `pnpm fix`：Biome 检查 / 自动修复
- `pnpm db:generate` / `pnpm db:migrate` / `pnpm db:push` / `pnpm db:studio`：数据库工作流

## UI 组件

共享 shadcn/ui 组件位于 `packages/ui`，设计令牌在 `packages/ui/src/styles/globals.css`。新增共享组件：

```bash
npx shadcn@latest add accordion popover table -c packages/ui
```

```tsx
import { Button } from "@hl-aigc/ui/components/button";
```
<!-- preview test -->
