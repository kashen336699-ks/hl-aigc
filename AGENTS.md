# 项目踩坑与教训(AGENTS.md)

- [T-001] `packages/db/src/schema/index.ts` 是手工维护的 barrel(当前仅 `export * from "./auth"`),新增 schema 文件(如本 task 的 `github-user.ts`,以及已存在但同样未导出的 `field-audit-log.ts`、`user-field-definition.ts`)后必须手动在这里补 `export * from "./xxx"`。否则 `packages/db/src/index.ts` 里 `import * as schema from "./schema"` 拿到的聚合 schema 不包含新表,`createDb()` 生成的 `db` 实例上 `db.query.<newTable>` 关系查询会静默不可用。这个坑不会在 `pnpm db:generate`(drizzle-kit 直接扫描 `./src/schema` 目录生成迁移,不经过 index.ts)阶段暴露,只有运行时用到 `db.query.*` 才会发现表"不存在"。**新增/修改 schema 文件后,必须顺手检查并更新 `schema/index.ts` 的导出。**

- [T-002] `pgTable` 里手写 `id: text("id").primaryKey()` 时容易漏掉 `.$defaultFn(() => crypto.randomUUID())`,导致该表的 `id` 没有默认值生成器。本 feature 里 `github-user.ts`、`field-audit-log.ts` 都用 `.primaryKey().$defaultFn(() => crypto.randomUUID())` 自动生成 UUID;design.md 的 API 契约(如 `userFields.create` 入参只有 `{ name, key, type, required?, description? }`,不含 `id`)决定了后续 insert 不会显式传 `id`,一旦某张表漏了 `$defaultFn`,要等到真正跑 insert 时才会因 `id` 违反 NOT NULL 而运行时报错,TypeScript/drizzle-kit generate 都不会提前发现。**新增 `pgTable` 时,凡是主键 `id` 列,一律照抄同 feature 内已有表(如 `github-user.ts`)的 `.primaryKey().$defaultFn(() => crypto.randomUUID())` 写法,不要只写 `.primaryKey()`。**
- [T-002] 同一 feature 内多张 `pgTable` 若有字段语义上是有限字符串联合(如 `type`/`action`),应统一用 `text(...).​$type<"a" | "b" | ...>()` 做 TS 层收窄,而不是只在注释里写"取值范围"。只写注释、不写 `.$type<...>()` 会导致这张表的字段类型比同 PR 里的兄弟表(如 `field-audit-log.ts` 的 `action` 列)弱,后续业务代码里这个字段会被推断成裸 `string`,拿不到编译期校验。**新增/修改字段是受限取值枚举时,优先用 `.$type<...>()` 而不是仅靠文档注释。**

- [T-004] 新表里 `references(() => user.id, { onDelete: ... })` 的 `onDelete` 策略不能照抄 `auth.ts`(session/account 等 better-auth 管理表)里清一色的 `"cascade"`。`auth.ts` 的 cascade 语义是"这条记录依附于用户账号,账号没了记录也该没";但审计日志/操作记录类表(如 `field-audit-log.ts` 的 `operatorUserId`)语义是"记录一个曾经发生的事实",不应随操作者账号被删而消失,用 cascade 会导致历史审计数据被静默清空。design.md 未必会对每个新 FK 显式标注 ON DELETE 策略。**新增 FK 到 `user.id` 时,先判断这张表与 user 的关系是"从属生命周期"(倾向 cascade)还是"历史事实记录"(倾向 restrict,或改 nullable + set null),不要默认抄 cascade;design.md 没写清楚时在 PR/task 里显式记录选择理由,留给统一 migration 校验时复核。**

- [T-005] `packages/db` 的 `auth.ts`(`user`/`session`/`account`/`verification` 表)是 better-auth 的托管 schema,在这里给 `user` 表加列(如 `role: text("role").$type<"user" | "admin">().default("user").notNull()`)只是让数据库层拥有这个字段,**不会**自动出现在 `packages/auth` 的 `betterAuth()` session/user 对象里 —— 必须在 `packages/auth` 配置里通过 `user.additionalFields` 显式声明同名字段(含类型、`input`/`defaultValue`),否则 API/前端拿不到 `role`,现象是"列已建好但业务层读不到",容易被误判为迁移没跑。**在 `auth.ts` 给 `user`/`session` 等 better-auth 表新增列后,必须同步检查 `packages/auth` 是否需要加 `additionalFields` 声明。**
- [T-005] 本仓库的 drizzle migration 采用"攒批生成"策略:多个 schema 改动 task(如 T-001~T-006)先并行把 `*.ts` schema 改完,统一由一个专门的 migration task(如 T-007)最后跑一次 `drizzle-kit generate`,而不是每个 schema task 各自生成。单个 schema task 里**不要**顺手跑 migration 生成,否则容易产生多份不完整/相互冲突的迁移文件。**改 `packages/db/src/schema/*.ts` 后,除非任务描述明确要求生成 migration,否则只改 schema,不跑 `db:generate`。**

- [T-006] `packages/db/src/schema/index.ts` 按 `.claude/rules/database.md` 约定必须用 `export * from "./xxx"` barrel 汇总所有 schema 文件(供 `packages/db/src/index.ts` 的 `drizzle(url, { schema })` 使用),但这与 CLAUDE.md/Ultracite 的通用规则 `noBarrelFile`("Avoid barrel files")结构性冲突,导致 `pnpm dlx ultracite check packages/db/src/schema/index.ts`(以及全仓库 `pnpm check`)对这个文件**必现报错**,且报错在改动前就已存在(不是任何一个具体 schema task 引入的),不要误判成自己改坏了什么、也不要为了消掉这条 lint 而改成非 barrel 写法(会破坏 `db.query.*` 关系查询)。**根治方式是在根 `biome.json` 给 `packages/db/src/schema/index.ts` 加 `overrides` 显式关闭 `noBarrelFile`,这属于独立的 lint 配置 task,不要在普通 schema 改动 task 里顺手改 `biome.json`。**

- [T-007] `drizzle-kit generate` 会按 Postgres 默认命名规则 `<表名>_<列名>_<引用表名>_<引用列名>_fk` 拼接外键约束名,但**不会**检查是否超过 PostgreSQL 标识符上限 63 字节(`NAMEDATALEN-1`)。当表名/列名较长(如 `user_field_values.field_definition_id` 引用 `user_field_definitions.id`)时拼出来的约束名会超长,`drizzle-kit generate` 仍会把这个超长名字原样写进迁移 SQL 和 `meta/*_snapshot.json`,但真正执行迁移时 Postgres 会**静默截断**成 63 字节、丢掉尾部(通常是 `_fk` 后缀),导致数据库里实际生效的约束名与迁移文件/snapshot 记录的名字不一致(功能仍正确,FK 照样生效,但后续若有代码/脚本按记录的全名去 `DROP`/重命名该约束,或跑 `drizzle-kit introspect/pull` 反向核对,会因名字对不上而出错)。**生成迁移前,人工过一遍新增外键的拼接约束名长度;超长的话在 schema 里用 `references()`/`foreignKey()` 显式传一个 ≤63 字节的短约束名,再跑 `generate`,不要依赖 drizzle-kit 自动截断或不做处理。**
- [T-007] 本仓库部分 schema task(T-001~T-006)在开发阶段可能已用 `pnpm db:push` 直接把表结构同步到开发库,而 migration 攒批 task(T-007)是之后才补跑 `drizzle-kit generate` 产出正式迁移文件的 —— 这两条路径各自独立,`db:push` 不会在 `meta/_journal.json` 留下记录。**在没有 `DATABASE_URL`/无法连接开发库的环境里生成完 migration 后,不能只做 SQL 静态核对就视为完成;必须在能连接到该开发库的环境里先确认目标表是否已被 `db:push` 建过(结构是否与新迁移一致),再执行 `pnpm db:migrate`,否则可能因表已存在而报错,或掩盖两条路径产生的 schema 差异。**

- [T-008] `better-auth` 的 `user.additionalFields` 声明某个字段时,若不显式写 `input: false`,该字段默认允许客户端在 sign-up/update 请求体里直接传值覆盖 —— 对 `role` 这类权限字段来说,这意味着普通用户能在注册/改资料请求里把自己的 `role` 直接设成 `"admin"`,是实打实的权限提升漏洞,不能靠"前端没做对应输入框"来防护。**给 `user`/`session` 声明任何权限相关的 additionalFields(如 `role`、`isAdmin`、`permissions`)时,一律显式加 `input: false`,把写入路径收窄到只能走服务端/管理脚本直接改库,不要因为字段"看起来不像用户会填"就省略这一步。**

- [T-010] `packages/api/src/context.ts` 里从 `x-forwarded-for`/`x-real-ip` 请求头取客户端 IP(供限流用)时,这两个头是客户端可任意伪造的普通请求头,若部署环境没有在边缘反向代理(nginx/云 LB)处强制覆写/清洗它们,攻击者可以每次请求换一个 `X-Forwarded-For` 值,把"按 IP 限流"绕成形同虚设。这不是本 task 的 bug(design.md 就是这么设计的),但凡是**基于请求头识别客户端身份/IP 做限流或访问控制**,一律要在实现旁边(或部署文档)显式写明"前提:边缘反代已覆写该头,不可信任客户端直传值",并把这个前提同步给下游消费该字段的 task(如限流 task),不要让"信任 header"这个假设只存在于设计者脑内。**新增/复用任何从请求头解析出的"客户端标识"字段时,先确认部署链路上是否有反代兜底,没有的话要么在代码里加显式注释说明依赖前提,要么补一层可信代理校验。**
- [T-010] 本环境的 `codex` code review 工具在当前沙箱下会因 MCP 传输层错误(`rmcp::transport::worker` 报 `HTTP 500`)反复崩溃退出(exit 133),更换默认参数/`--disable web_search`/覆盖 `mcp_servers`、`plugins` 配置等方式都无法绕过。**这是环境问题而非代码问题,不要在同一 task 里反复重试 codex 超过 2-3 次浪费时间;确认是这个已知崩溃特征后,直接切换到人工两轮 review + 安全扫描作为等效替代,并在交付说明里如实记录"codex 不可用,已用等效人工审查替代"。**

- [T-012] GitHub REST API 对"权限不足"和"触发限流"这两种不同场景**都会返回 HTTP 403**,不能只看状态码区分;必须额外检查响应头 `x-ratelimit-remaining` 是否为 `"0"` 才能判定是限流(见 `packages/api/src/lib/github-client.ts` 的 `isRateLimitedResponse`)。后续新增调用 GitHub REST API 的代码(如 T-013 `github` router,或任何新端点)如果直接用"403 → 权限错误"这种简单映射,会把用户触发的限流误判成权限问题,给出错误的错误提示/处理逻辑。**新增 GitHub API 调用时复用 `github-client.ts` 里已有的状态码分类逻辑,不要重新发明一套 403 判断。**
- [T-012] 用 `AbortController` + `fetch` 做请求超时时,`setTimeout` 触发 `controller.abort()` 后 `fetch` 会抛出 `DOMException(name: "AbortError")`,必须在 `catch` 里用 `error instanceof DOMException && error.name === "AbortError"` 专门识别并归类为"超时",而不是和其他网络失败(DNS 失败、连接被拒等)混在同一个"unavailable"分类里——否则超时和网络不可用在监控/日志里无法区分,排查外部依赖故障时会误判。同时 `clearTimeout(timeoutId)` 必须放在 `finally` 里,请求正常返回时也要清掉定时器,否则残留的 timer 会在测试环境里阻止进程退出。**新增任何带超时的外部 HTTP 调用,照抄 `github-client.ts` 的 `AbortController` + `finally clearTimeout` 模式。**

- [T-018] `packages/api/src/routers/index.ts` 的 `appRouter` 目前只挂了 `healthCheck`/`privateData`,像 `userFields` 这类 router 即使代码已写好也可能还没 `router({...})` 进 `appRouter`——前端页面 task 若按 tasks.md 依赖说明被安排与后端 Phase 并行开发,遇到这种情况不要阻塞等待,而是本地写 mock 数据 + `// TODO(T-xxx)` 注释标出未来切换点,但 mock 数据结构必须**严格对齐 design.md 里该 procedure 的返回契约**(字段名、类型、可选性一个不差),这样后续联调 task 只需把数据获取函数换成 `trpc.xxx.yyy.queryOptions()` 而不用碰渲染逻辑。**写前端 mock 数据前,先去 design.md 找对应 procedure 的 output 契约照抄字段,不要凭页面需要臆造字段名。**
- [T-018] `packages/ui/src/components` 目前没有现成的 Table/Badge 组件,页面级列表(如字段管理页)容易在页面文件内用原生 `<table>` + 内联 `<span>` 徽标手搓,并且要手动照抄项目视觉语言(`rounded-none`、`ring-1 ring-foreground/10`)才能与其他页面保持一致。**如果发现自己在第二个页面里重复写同一套 table/badge 样式,应该把它提成 `packages/ui` 的通用组件,而不是继续复制粘贴;新增页面前先看 `packages/ui/src/components` 有没有可复用的表格/徽标组件。**

---

## Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

### Quick Reference

- **Format code**: `pnpm dlx ultracite fix`
- **Check for issues**: `pnpm dlx ultracite check`
- **Diagnose setup**: `pnpm dlx ultracite doctor`

Biome (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

### Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

#### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

#### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

#### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

#### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

#### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

#### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

#### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

#### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

#### Framework-Specific Guidance

**Next.js:**

- Use Next.js `<Image>` component for images
- Use `next/head` or App Router metadata API for head elements
- Use Server Components for async data fetching instead of async Client Components

**React 19+:**

- Use ref as a prop instead of `React.forwardRef`

**Solid/Svelte/Vue/Qwik:**

- Use `class` and `for` attributes (not `className` or `htmlFor`)

---

### Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

### When Biome Can't Help

Biome's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Biome can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Biome. Run `pnpm dlx ultracite fix` before committing to ensure compliance.
