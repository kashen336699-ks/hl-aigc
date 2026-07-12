# GitHub 账户信息同步与字段管理 — 任务清单

## 架构: monorepo

## 任务列表

### Phase 1: 数据层（shared schema，被 auth/api 消费）

- [x] T-001: 新增 `github_users` schema `packages/db:src/schema/github-user.ts` ~15min
- [x] T-002: 新增 `user_field_definitions` schema `packages/db:src/schema/user-field-definition.ts` ~15min
- [x] T-003: 新增 `user_field_values` schema（含 `(githubUserId, fieldDefinitionId)` 唯一约束、级联外键）`packages/db:src/schema/user-field-value.ts` ~15min
- [x] T-004: 新增 `field_audit_logs` schema `packages/db:src/schema/field-audit-log.ts` ~10min
- [x] T-005: `user` 表新增 `role` 列（text，默认 `"user"`）`packages/db:src/schema/auth.ts` ~10min
- [x] T-006: 在 `schema/index.ts` 导出新 schema `packages/db:src/schema/index.ts` ~5min
- [x] T-007: 生成 Drizzle migration 并核对 SQL（`drizzle-kit generate`）`packages/db:src/migrations` ~15min

### Phase 2: 认证层（消费方：packages/api）

- [x] T-008: `betterAuth()` 配置通过 `user.additionalFields` 声明 `role`，使 session 携带角色 `packages/auth:src/index.ts` ~15min

### Phase 3: API 层（tRPC procedures）

- [x] T-009: 新增 `adminProcedure`（基于 `protectedProcedure` 校验 `role === "admin"`，否则 `FORBIDDEN`）`packages/api:src/index.ts` ~15min
- [x] T-010: `Context` 扩展客户端 IP（供限流使用）`packages/api:src/context.ts` ~15min
- [x] T-011: 进程内滑动窗口限流工具 `packages/api:src/lib/rate-limiter.ts` ~30min
- [x] T-012: GitHub 客户端封装（超时、错误分类：invalid/permission/rate-limited/unavailable/timeout）`packages/api:src/lib/github-client.ts` ~30min
- [x] T-013: `github` router：`syncProfile`（public + 限流 + 幂等写入 `github_users`）、`getUser`（admin）`packages/api:src/routers/github.ts` ~1h
- [x] T-014: `userFields` router：`list`/`create`/`delete`（admin，`key` 格式与唯一性校验，删除走事务级联并写审计日志）`packages/api:src/routers/user-fields.ts` ~1h
- [x] T-015: 挂载 `github`、`userFields` 到 `appRouter` `packages/api:src/routers/index.ts` ~5min

### Phase 4: 前端（可先用 mock 数据并行开发，联调阶段切真实 API）

- [x] T-016: 同步页路由 + Token 输入表单（隐藏/显隐切换、非空校验、提交防重入、成功后清空）`apps/web:src/routes/github-sync.tsx` ~45min
- [x] T-017: 同步结果展示卡片（头像/用户名/姓名/主页/简介/仓库数/粉丝数/`syncedAt`）`apps/web:src/routes/github-sync.tsx` ~20min
- [x] T-018: 字段管理页路由 + 字段列表（名称/标识/类型/来源/创建时间/操作，复用 `_auth` 布局做登录保护）`apps/web:src/routes/_auth/admin/fields.tsx` ~45min
- [x] T-019: 新增字段弹窗表单（`key` 格式前端校验，与后端一致）`apps/web:src/routes/_auth/admin/fields.tsx` ~30min
- [x] T-020: 删除字段二次确认弹窗（系统字段禁用删除）`apps/web:src/routes/_auth/admin/fields.tsx` ~20min
- [x] T-021: 导航入口：同步页/字段管理页链接（管理员可见性判断）`apps/web:src/components/header.tsx` ~15min

### Phase 5: 集成与验收

- [x] T-022: 前后端联调，切真实 API，校验错误码到文案的映射（`VALIDATION_ERROR` 等 9 个错误码全覆盖）~30min
- [x] T-023: 按 requirements.md AC-001~AC-012 逐项验证 ~30min（结论见下方"验收结论"）
- [x] T-024: 安全排查：确认 Token 不出现在数据库、浏览器存储、URL、响应结果、服务端日志中 ~20min（结论见下方"验收结论"）

## 依赖关系

- T-007 依赖 T-001~T-006（migration 需等 schema 定稿）。
- T-008 依赖 T-005、T-007（role 列需先落库）。
- T-009 依赖 T-008（adminProcedure 需要 session 携带 role）。
- T-013 依赖 T-001、T-007、T-010、T-011、T-012。
- T-014 依赖 T-002、T-003、T-004、T-007、T-009。
- T-015 依赖 T-013、T-014。
- T-016/T-017 可与 Phase 3 并行开发（先用 mock），T-022 联调阶段切换到 T-013 真实接口。
- T-018/T-019/T-020 可与 Phase 3 并行开发（先用 mock），T-022 联调阶段切换到 T-014 真实接口。
- T-021 依赖 T-016、T-018（需要两个页面路由已存在）。
- T-022 依赖 T-015 与全部 Phase 4 任务。
- T-023、T-024 依赖 T-022。
- 跨包依赖：`packages/db` schema 变更 → 消费方 `packages/auth`（role 字段）、`packages/api`（全部新表）需同步更新；`packages/api` router 变更 → 消费方 `apps/web`（`packages/api` 的 `AppRouter` 类型）。

## 风险点

- **管理员判定缺口**：项目当前无角色管理 UI，首个管理员需手动执行 SQL 或种子脚本将某用户 `role` 置为 `admin`；若后续需要管理员管理界面，属于超出本 feature 范围的新需求。
- **限流的分布式局限**：进程内滑动窗口限流在多实例部署下各实例独立计数，实际限流阈值会被放大；V1.0 假设单实例部署，多实例场景需换成集中式限流（如 Redis），不在本 feature 范围。
- **GitHub API 限流/超时的可测性**：本地开发环境较难稳定复现 GitHub 429/5xx，建议在 T-012 中通过可注入的 HTTP client 或 mock server 覆盖这些分支的单测。
- **Token 泄漏面广**：日志中间件（`hono/logger`）默认可能记录请求信息，T-013 实现时需确认该路由不经过会打印 body/头的日志逻辑，或显式脱敏；T-024 需覆盖网络面板、服务端 stdout、数据库三处排查。
- **字段类型与值校验的一致性**：`user_field_values.value` 以 text 存储所有类型，写入方（未来 feature）需在应用层按 `type` 序列化/反序列化，本 feature 只建表不实现写入 UI，需在交接时明确这一点避免误解为已完整实现。

## 验收结论（T-023/T-024，2026-07-08）

按 requirements.md AC-001~AC-012 逐项核对代码实现：

- AC-001~AC-007、AC-009~AC-012：均已实现并通过审查（`github.syncProfile` 幂等 upsert、`SyncResultCard` 展示、错误分类映射、`userFields` 的 key 校验/事务删除+级联/审计日志/`adminProcedure` 鉴权）。
- **AC-008 明确不做**：requirements.md 验收标准原要求"新增字段后可为用户保存对应类型的字段值"，与 design.md"字段值录入 UI 不在 V1.0 范围"的既有决策冲突。2026-07-08 需求方确认接受此缺口，AC-008 从 V1.0 交付范围移除，`user_field_values` 表结构继续预留，写入能力留待后续独立 feature。

Token 泄漏面排查（T-024）结论：

- 数据库：`github_users` schema 无 token 字段，未持久化 ✓
- 浏览器持久化存储：审计确认同步页提交（成功/失败）后 `localStorage`/`sessionStorage` 均为空 ✓
- URL：`syncProfile` 走 tRPC mutation（POST body），网络层实测请求 URL 不含 token ✓
- 响应结果：`syncProfile` 返回字段不含 token ✓
- 服务端日志：`hono/logger()` 仅打印 method/path/status/耗时，不打印 header 或 body，不会泄漏 `Authorization`/token ✓
- **修复项**：审计中发现同步失败时 token 仍残留在输入框（原实现只在成功时 `formApi.reset()`），已改为 `finally` 块中无条件清空，缩短 token 在 DOM 中的暴露窗口，更贴合 F-002"提交后清空"的要求。

## 真实端到端验证（2026-07-08，补充）

此前的验证均基于 mock 网络响应。本次用本地 Docker Postgres（`postgres:17-alpine`）+ `pnpm dev` 全栈跑通了一次真实链路，未再依赖 mock：

- `pnpm db:push` 在真实库上建表成功，8 张表（4 张 better-auth + 4 张本 feature 新表）结构核对无误。
- 真实注册 + 登录一个用户，走真实 better-auth 流程；手动 SQL 把该用户提升为 `admin`（印证"管理员判定缺口"风险点里记录的既定方案）。
- 管理员账号下：真实创建字段 `user_level` → 数据库 `user_field_definitions` 与 `field_audit_logs`（`action=created`）均写入正确；真实删除该字段 → 级联清理、`field_audit_logs` 追加 `action=deleted` 记录，`operator_user_id` 正确指向该管理员。
- 用一个格式合法但无效的 Token 触发真实 GitHub API 调用（非 mock，实测 541ms 往返）→ 收到 GitHub 真实 401 → 正确映射为 `GITHUB_TOKEN_INVALID` → 前端提示"GitHub Token 无效或已过期"→ `github_users` 表确认无写入（AC-006 生效）→ 服务端日志与 token 输入框均确认不含该 token（T-024 修复项在真实链路下验证生效）。

结论：AC-001~AC-007、AC-009~AC-012 除代码审查外，已有一次真实端到端复现，而不仅是 mock 验证。

## 部署就绪补齐（2026-07-10）

对照 PRD 复查时发现并补齐以下遗漏（requirements.md 的 F-001~F-010 在拆解时漏掉了 PRD FR-06）：

- **FR-06（P0）+ PRD 9.8**：同步页此前缺少"最小权限提示"与"隐私说明"。已在 `apps/web/src/routes/github-sync.tsx` 补充：页面用途说明、最小权限提示（classic PAT 仅需 read:user / fine-grained PAT 无需仓库权限）、隐私说明（列明将保存哪些公开资料），并将该页文案统一为中文（与字段管理页、pdr-error 文案一致）。
- **端口可配置**：`apps/server` 监听端口由硬编码 3000 改为 `env.PORT`（`packages/env/src/server.ts` 新增校验，默认 3000），满足部署环境注入端口的需要。
- **部署资料**：新增 `apps/server/.env.example`、`apps/web/.env.example`；重写 `README.md`（修正不存在的 `apps/docs` 描述，补生产部署章节：构建、migration、启动、静态托管、首个管理员提升 SQL、HTTPS/反向代理/单实例限流注意事项）。

遗留（不阻塞部署，已知且接受）：

- 可观测性中的 requestId 未实现（当前 `hono/logger` 记录 method/path/status/耗时）；如需请求级追踪，后续可加 `hono/request-id` 中间件。
- AC-008（字段值录入 UI）维持 2026-07-08 的 descope 决定。
