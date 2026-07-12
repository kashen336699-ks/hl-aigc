# GitHub 账户信息同步与字段管理 — 技术设计

## 项目架构

- 架构类型：monorepo（pnpm workspace + turborepo）
- 涉及模块：
  - `packages/db` — Drizzle schema、migration
  - `packages/auth` — better-auth 配置（新增 `role` 字段）
  - `packages/api` — tRPC router/procedure、GitHub 客户端、字段管理逻辑
  - `packages/env` — 新增 GitHub API 相关环境变量（如需要）
  - `apps/server` — Hono 入口（如需新增中间件/限流）
  - `apps/web` — 同步页（页面 A）、字段管理页（页面 B）

## 方案概述

1. 复用现有 tRPC 基础设施（`packages/api`），新增两个 router：`github`（同步/查询）、`userFields`（字段管理），而不是新建独立 REST 路由。PRD 第 8 节的 REST 路径作为语义参考，实际以 tRPC procedure 命名呈现，行为与错误码语义保持一致。
2. `github.syncProfile` 为 `publicProcedure`（无需登录，任何持有 Token 的人都可同步自己的 GitHub 信息，符合 PRD 5.1 普通用户角色不要求系统账号），但施加基于 IP 的限流中间件。
3. `github.getUser`、`userFields.*` 为 `adminProcedure`（在现有 `protectedProcedure` 基础上叠加角色校验），满足 PRD「字段管理接口必须鉴权并校验管理员权限」。
4. 数据模型采用 PRD 推荐的「字段定义表 + 字段值表」动态字段方案，全部通过 Drizzle 管理，不做运行时 DDL。

## 架构变更

- `packages/db/src/schema/` 新增 4 张表：`github-user.ts`、`user-field-definition.ts`、`user-field-value.ts`、`field-audit-log.ts`，并在 `schema/index.ts` 导出。
- `packages/db/src/schema/auth.ts` 的 `user` 表新增 `role` 列（`text`，默认 `"user"`，可选值 `"user" | "admin"`）。
- `packages/auth/src/index.ts` 的 `betterAuth()` 配置通过 `user.additionalFields` 声明 `role`，使 session 携带角色信息。
- `packages/api/src/index.ts` 新增 `adminProcedure`（在 `protectedProcedure` 基础上校验 `ctx.session.user.role === "admin"`，否则抛 `FORBIDDEN`）。
- `packages/api/src/routers/` 新增 `github.ts`、`user-fields.ts`，并在 `routers/index.ts` 的 `appRouter` 中挂载为 `github`、`userFields` 命名空间。
- `packages/api/src/lib/github-client.ts`（新增）：封装对 GitHub `GET /user` 的调用、超时、错误分类。
- `packages/api/src/lib/rate-limiter.ts`（新增）：进程内滑动窗口限流（V1.0 单实例场景足够；多实例场景为后续优化项，非本 feature 范围）。
- `packages/api/src/context.ts` 扩展 `Context`，附带客户端 IP（从 Hono `context.req.header("x-forwarded-for")` 或连接信息取值，取不到则退化为 `"unknown"` 并对该桶做更严格限流）。
- `apps/web` 新增路由：`/github-sync`（同步页，公开）、`/_auth/admin/fields`（字段管理页，复用现有 `_auth` 布局做登录保护，procedure 层再做 admin 校验做双重防护）。

## 数据模型

### `github_users`

| 列 | 类型 | 约束 |
| --- | --- | --- |
| id | text (uuid) | PK |
| githubId | text | NOT NULL, UNIQUE |
| login | text | NOT NULL |
| nodeId | text | nullable |
| avatarUrl | text | nullable |
| htmlUrl | text | nullable |
| name | text | nullable |
| company | text | nullable |
| blog | text | nullable |
| location | text | nullable |
| email | text | nullable |
| bio | text | nullable |
| twitterUsername | text | nullable |
| publicRepos | integer | NOT NULL |
| publicGists | integer | NOT NULL |
| followers | integer | NOT NULL |
| following | integer | NOT NULL |
| githubCreatedAt | timestamp | NOT NULL |
| githubUpdatedAt | timestamp | NOT NULL |
| syncedAt | timestamp | NOT NULL |
| createdAt | timestamp | NOT NULL, default now |
| updatedAt | timestamp | NOT NULL, `$onUpdate(now)` |

### `user_field_definitions`

| 列 | 类型 | 约束 |
| --- | --- | --- |
| id | text (uuid) | PK |
| name | text | NOT NULL |
| key | text | NOT NULL, UNIQUE，`^[a-z][a-z0-9_]*$` |
| type | text | NOT NULL, enum: text/textarea/number/boolean/datetime |
| required | boolean | NOT NULL, default false |
| description | text | nullable |
| isSystem | boolean | NOT NULL, default false（保留字段标记，本 feature 不预置系统字段，但为未来扩展保留列） |
| createdAt | timestamp | NOT NULL, default now |
| updatedAt | timestamp | NOT NULL |

### `user_field_values`

| 列 | 类型 | 约束 |
| --- | --- | --- |
| id | text (uuid) | PK |
| githubUserId | text | NOT NULL, FK → `github_users.id` ON DELETE CASCADE |
| fieldDefinitionId | text | NOT NULL, FK → `user_field_definitions.id` ON DELETE CASCADE |
| value | text | nullable（按 `type` 序列化存储，V1.0 不提供录入 UI，仅保留表结构） |
| createdAt | timestamp | NOT NULL |
| updatedAt | timestamp | NOT NULL |

唯一约束：`(githubUserId, fieldDefinitionId)`。

### `field_audit_logs`

| 列 | 类型 | 约束 |
| --- | --- | --- |
| id | text (uuid) | PK |
| action | text | NOT NULL, enum: created/deleted |
| fieldKey | text | NOT NULL |
| operatorUserId | text | NOT NULL, FK → `user.id` |
| createdAt | timestamp | NOT NULL, default now |

## API 契约

统一响应包装：

```ts
type ApiSuccess<T> = { success: true; data: T };
type ApiError = { success: false; error: { code: string; message: string } };
```

错误码集合：`VALIDATION_ERROR` `GITHUB_TOKEN_INVALID` `GITHUB_PERMISSION_DENIED` `GITHUB_RATE_LIMITED` `GITHUB_UNAVAILABLE` `DATABASE_ERROR` `FIELD_KEY_CONFLICT` `SYSTEM_FIELD_PROTECTED` `FIELD_NOT_FOUND`。

tRPC 层通过 `TRPCError({ code, message })` 抛出，`code` 取最接近的标准 tRPC code（如 `BAD_REQUEST`、`UNAUTHORIZED`、`FORBIDDEN`、`TOO_MANY_REQUESTS`、`INTERNAL_SERVER_ERROR`），PRD 错误码放入 `TRPCError.cause`（`{ pdrCode: 'GITHUB_TOKEN_INVALID' }`），前端 `onError` 统一解析 `cause.pdrCode` 映射到文案。

| Procedure | 类型 | 输入 | 输出 |
| --- | --- | --- | --- |
| `github.syncProfile` | mutation, public, 限流 | `{ token: string }` | `{ id, githubId, login, name, avatarUrl, htmlUrl, syncedAt }` |
| `github.getUser` | query, admin | `{ id: string }` | 完整 `github_users` 记录 |
| `userFields.list` | query, admin | 无 | 字段定义数组 |
| `userFields.create` | mutation, admin | `{ name, key, type, required?, description? }` | 新建的字段定义 |
| `userFields.delete` | mutation, admin | `{ id: string }` | `{ id, deleted: true }` |

## 组件设计

### 页面 A：`apps/web/src/routes/github-sync.tsx`

- `GithubTokenForm`（`packages/ui` 复用 `Input`/`InputGroup`/`Button`）：受控密码输入 + 显隐切换 + 提交态。
- `SyncResultCard`：展示头像、用户名、姓名、主页、简介、仓库数、粉丝数、`syncedAt`。
- 状态机：`idle | submitting | success | error`。

### 页面 B：`apps/web/src/routes/_auth/admin/fields.tsx`

- `FieldListTable`：名称/标识/类型/来源/创建时间/操作列。
- `CreateFieldDialog`：表单 + 客户端 `key` 格式校验（正则与后端一致）。
- `DeleteFieldConfirm`：二次确认弹窗，系统字段禁用删除按钮。
- 空状态、加载态、错误提示复用 `packages/ui` 的 `Empty`、`Skeleton`、`sonner` toast。

## 状态管理

- 页面 A：本地 `useState` 管理表单与请求状态，不引入全局 store；成功后立即清空 token 输入。
- 页面 B：tRPC React Query 缓存字段列表；创建/删除后 `invalidate` 对应 query key。

## 安全考虑

- Token 仅存在于请求内存中，`github.syncProfile` handler 执行完毕（无论成功失败）后不引用该变量；不写入任何日志（`logger()` 中间件不记录请求体，或对该路由跳过 body 日志）。
- 服务端日志对 `Authorization` 头做脱敏（如替换为 `Bearer ***`）。
- 限流：按客户端 IP 滑动窗口（如 60 秒 5 次），命中时返回 `GITHUB_RATE_LIMITED`。
- `adminProcedure` 双重防护：路由层 `_auth` 布局要求已登录，procedure 层再校验 `role === "admin"`；未登录/非管理员分别返回 `UNAUTHORIZED`/`FORBIDDEN`。
- 所有输入通过 zod schema 校验（tRPC `.input(zodSchema)`），杜绝未校验参数进入 Drizzle 查询（Drizzle 本身已参数化，无 SQL 注入风险）。
- 删除字段与其关联值、创建用户记录与首次同步在同一 Drizzle 事务内完成。

## 技术决策

| 决策 | 选项 | 理由 |
| --- | --- | --- |
| 接口形态 | tRPC procedure（非独立 REST 路由） | 复用项目现有 tRPC/Hono 基础设施，避免维护两套路由与鉴权逻辑 |
| 管理员判定 | `user.role` 列 + `adminProcedure` | 项目当前无角色系统，新增最小化字段满足 PRD 鉴权要求，避免引入完整 RBAC（超出 V1.0 范围） |
| 同步接口鉴权 | `publicProcedure` + IP 限流 | PRD 未要求登录才能同步；用限流替代身份鉴权防滥用 |
| 字段值录入 UI | 本 feature 不做 | requirements.md 开放问题 3：PRD 未明确要求 V1.0 提供录入 UI，仅要求字段定义管理；`user_field_values` 表结构预留 |
| 限流实现 | 进程内滑动窗口 | V1.0 单实例部署假设下足够；分布式限流（Redis 等）超出当前基础设施范围，留作后续优化 |
| 错误码传递 | 标准 tRPC code + `cause.pdrCode` | 兼容 tRPC 生态（React Query 错误处理）同时保留 PRD 定义的业务错误码供前端精确文案匹配 |
