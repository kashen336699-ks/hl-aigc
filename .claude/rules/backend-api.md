---
description: 后端 API 规范（Hono + tRPC + Drizzle + better-auth，apps/server 与 packages/api）
globs: apps/server/**,packages/api/**,packages/auth/**,packages/db/**,packages/env/**
---

# Backend API 规范

## 架构与职责边界

- **`apps/server`**：仅负责组装 —— 创建 Hono `app`、挂载 `cors`/`logger` 中间件、挂载 `better-auth` 的 `/api/auth/*` 路由、挂载 `@hono/trpc-server` 的 `/trpc/*` 路由、`serve()` 启动。不在这里写业务逻辑或新增 tRPC procedure。
- **`packages/api`**：tRPC 的定义中心。
  - `src/index.ts`：`initTRPC` 实例、`router`、`publicProcedure`、`protectedProcedure` 等基础导出。
  - `src/context.ts`：`createContext`，从 Hono `Context` 中取出 `better-auth` session，组装成 tRPC `Context`。
  - `src/routers/index.ts`：`appRouter`，所有业务 router 的聚合入口；导出 `AppRouter` 类型供前端 `@trpc/client` 使用。
- **`packages/auth`**：`better-auth` 实例（`createAuth()` / `auth`），封装 `drizzleAdapter`、`trustedOrigins`、cookie 策略等认证配置。
- **`packages/db`**：Drizzle ORM 实例（`createDb()` / `db`）与 `src/schema/*.ts` 表结构定义，是唯一的数据库访问层，其他包/app 不直接 `new Pool` 或绕过 Drizzle 连库。
- **`packages/env`**：用 `@t3-oss/env-core` + `zod` 做服务端/客户端环境变量校验（`env/server`、`env/web`），任何包需要环境变量时 `import { env } from "@hl-aigc/env/server"`，禁止直接读 `process.env`。

## tRPC Router / Procedure 规范

- 新增业务功能时，在 `packages/api/src/routers/` 下按领域拆分文件（如 `user.ts`、`post.ts`），导出一个 `router({...})`，再在 `routers/index.ts` 的 `appRouter` 中通过命名空间合并（如 `user: userRouter`），不要把所有 procedure 平铺塞进 `routers/index.ts`。
- 需要登录态的 procedure 一律使用 `protectedProcedure`（来自 `packages/api/src/index.ts`），而不是在 `publicProcedure` 内手写 `if (!ctx.session) throw ...`；`protectedProcedure` 已保证 `ctx.session` 非空并做了类型收窄。
- 输入校验统一用 `zod`：`procedure.input(z.object({...})).query/mutation(...)`；不要跳过输入校验直接信任 `input` 类型。
- 错误统一抛 `TRPCError`（`@trpc/server`），并给出明确的 `code`（如 `UNAUTHORIZED`、`NOT_FOUND`、`BAD_REQUEST`、`FORBIDDEN`）与 `message`，不要用普通 `Error` 或字符串/裸对象。
- 查询类操作用 `.query()`，写操作/副作用用 `.mutation()`，不要用 `.query()` 承载写操作。
- `AppRouter` 类型是前后端契约，修改 procedure 的输入/输出结构后需确认 `apps/web` 中对应的 `@trpc/client` 调用同步更新（跨包改动可在同一次提交中完成，见 `git-workflow.md`）。

## 认证（better-auth）

- session 的获取只通过 `packages/api/src/context.ts` 中的 `auth.api.getSession({ headers })` 完成一次，procedure 内部通过 `ctx.session` 读取，不要在业务 router 里重复调用 `auth.api.getSession`。
- `better-auth` 的路由（`/api/auth/*`）由 `apps/server/src/index.ts` 直接转发给 `auth.handler`，新增认证相关能力（如新的 provider、plugin）在 `packages/auth/src/index.ts` 的 `betterAuth({...})` 配置中添加 `plugins`，不要在 `apps/server` 里手写认证逻辑。
- Cookie/session 安全属性（`sameSite`、`secure`、`httpOnly`）已在 `packages/auth` 统一配置，不要在业务代码中单独设置认证相关 cookie。
- `trustedOrigins` / `CORS_ORIGIN` 需与 Hono 的 `cors()` 中间件保持一致（均来自 `env.CORS_ORIGIN`），修改跨域来源时两处一起改。

## 数据库访问（Drizzle）

- 所有数据库读写通过 `packages/db` 导出的 `db`（或按需 `createDb()`）以及 `src/schema/*.ts` 中定义的表进行，业务代码（`packages/api` 的 router）中 `import { db } from "@hl-aigc/db"` 后用 Drizzle 查询构造器操作，不写原生 SQL 字符串拼接。
- 新增/修改表结构：编辑 `packages/db/src/schema/*.ts`，为外键关系补充 `relations()`，为高频查询字段（如外键列）加 `index()`（参考 `session_userId_idx` 等既有命名模式：`<table>_<column>_idx`）。
- schema 改动后依次执行 `pnpm db:generate`（生成 migration）与 `pnpm db:push` 或 `pnpm db:migrate`，生成的 migration 文件需随代码一起提交（见 `git-workflow.md`）。
- 禁止在生产环境使用 `db:push` 跳过 migration；本地开发可用 `db:push` 快速同步，正式发布走 `db:generate` + `db:migrate`。
- 表名/字段名使用 snake_case（`user_id`、`created_at`），TS 侧字段名使用 camelCase，与现有 `packages/db/src/schema/auth.ts` 保持一致。

## Hono App 层

- `cors()` 中间件的 `allowMethods`/`allowHeaders` 需按实际需要的方法/头显式列出，不要用 `*` 放开所有来源或方法；新增自定义请求头（如自定义鉴权头）时在此显式加入 `allowHeaders`。
- 新增非 tRPC 的 REST 端点（如 webhook、健康检查、文件上传）时，在 `apps/server/src/index.ts` 中以 `app.get/post(...)` 挂载在独立路径下，避免与 `/trpc/*`、`/api/auth/*` 冲突；如端点较多，拆分为独立的 Hono sub-app 并 `app.route("/prefix", subApp)`，不要让 `index.ts` 无限膨胀。
- 服务端口、监听地址等运行时配置来自代码常量（当前 `port: 3000`）或应迁移进 `packages/env`（新增环境变量时同步更新 `packages/env/src/server.ts` 的 zod schema）。

## 环境变量

- 新增服务端环境变量：在 `packages/env/src/server.ts` 的 `createEnv({ server: {...} })` 中用 zod 声明类型与校验规则（必填用 `.min(1)`/具体格式校验，如 `z.url()`），并在部署环境和本地 `.env` 中同步添加，不允许绕过 schema 直接读 `process.env.XXX`。
- 密钥类变量（如 `BETTER_AUTH_SECRET`）需要最小长度等强度校验（现有 `.min(32)`），不要放宽。
- `SKIP_ENV_VALIDATION` 仅用于构建期特殊场景（如生成静态资源），业务运行时不应设置该变量绕过校验。

## 禁止事项

- 禁止在 `apps/server` 中直接操作数据库或直接调用 `betterAuth(...)`，必须通过 `packages/db` / `packages/auth` 的导出。
- 禁止在 tRPC procedure 之外（如全局中间件）静默吞掉错误；错误需要以 `TRPCError` 或对应 HTTP 状态码显式返回。
- 禁止在业务代码中打印/记录完整 session token、密码、`BETTER_AUTH_SECRET` 等敏感信息。
- 禁止新增 procedure 时跳过 `zod` `.input()` 校验直接信任客户端传参。
