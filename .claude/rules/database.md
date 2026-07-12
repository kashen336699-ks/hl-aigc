---
description: 数据库开发规范 (packages/db — Drizzle ORM + PostgreSQL)
globs: packages/db/**, packages/auth/**
---

# Database Rules

## 技术栈

- **ORM**: Drizzle ORM（`drizzle-orm/node-postgres`），驱动 `pg`
- **数据库**: PostgreSQL（`dialect: "postgresql"`，见 `packages/db/drizzle.config.ts`）
- **迁移工具**: `drizzle-kit`（`db:generate` 生成迁移 SQL，`db:migrate` 执行迁移，`db:push` 直接同步 schema，`db:studio` 打开可视化面板）
- **环境变量**: `DATABASE_URL` 通过 `@hl-aigc/env`（`packages/env/src/server.ts`，`t3-oss/env-core` + zod 校验）读取；`drizzle.config.ts` 单独用 `dotenv` 加载 `apps/server/.env`

## 包结构与导出

- 包名 `@hl-aigc/db`，导出方式为 `exports` 通配（`"./*": "./src/*.ts"`），子路径直接按文件路径导入，例如 `@hl-aigc/db/schema/auth`
- `src/index.ts` 导出 `createDb()` 工厂函数和默认单例 `db`；需要独立实例（如测试、多租户）时用 `createDb()`，常规业务代码直接用 `db`
- `db = createDb()` 内部用 `env.DATABASE_URL` 和 `drizzle(url, { schema })`，schema 会自动带上关系查询（`db.query.xxx.findMany` 等）能力

## Schema 约定

- schema 文件放在 `src/schema/` 下，按业务领域拆分文件（如 `auth.ts`），统一从 `src/schema/index.ts` 用 `export * from "./xxx"` 汇总
- 表名、字段名使用 snake_case 字符串（如 `pgTable("user", ...)`、`text("email_verified")`），TS 属性名使用 camelCase
- 主键统一用 `text("id").primaryKey()`（配合 better-auth 生成的字符串 ID），不要混用 `serial`/`uuid` 除非该表明确需要
- 时间戳字段固定模式：`createdAt: timestamp("created_at").defaultNow().notNull()`；`updatedAt` 用 `.defaultNow().$onUpdate(() => new Date()).notNull()`
- 外键统一显式声明 `onDelete` 行为（多为 `{ onDelete: "cascade" }`），不要留默认行为不写
- 高频查询字段（尤其外键列）用 `index()` 建索引，索引命名格式 `"{table}_{column}Idx"`（如 `session_userId_idx`）
- 表间关系用 `relations()` 单独定义并导出（如 `userRelations`、`sessionRelations`），命名格式 `{tableName}Relations`，不要把关系逻辑写进 `pgTable` 定义里

## 迁移工作流

- 修改 schema 后本地开发优先用根目录 `pnpm db:push` 快速同步（通过 turbo 过滤 `-F @hl-aigc/db` 执行）
- 需要产出可追踪的迁移文件（团队协作/生产环境）时用 `pnpm db:generate` 生成 SQL，再用 `pnpm db:migrate` 执行；迁移文件输出目录为 `packages/db/src/migrations`
- 不要手工编辑 `drizzle-kit` 生成的迁移 SQL 文件；需要调整就改 schema 后重新生成
- `pnpm db:studio` 用于本地检查数据，不要在生产 `DATABASE_URL` 下运行未经确认的写操作

## 与 better-auth 的集成

- `packages/auth` 通过 `drizzleAdapter(db, { schema, provider: "pg", ... })` 接入 `packages/db` 的 `db` 实例和 `schema`（见 `packages/auth/src/index.ts`）
- `user` / `session` / `account` / `verification` 四张表结构由 better-auth 的字段约定驱动，新增字段前先确认 better-auth 插件是否已有对应扩展机制，避免手动改动破坏适配器假设
- 业务表需要关联用户时，外键统一指向 `user.id`（`text` 类型），并加 `onDelete: "cascade"` 与索引，参照 `session`/`account` 的写法

## 使用规范

- 查询优先用 Drizzle 的关系查询 API（`db.query.user.findFirst({ with: { sessions: true } })`）而非手写 join，除非关系查询无法表达复杂条件
- 不要在业务代码里拼接原始 SQL 字符串；确需原生 SQL 时用 Drizzle 的 `sql` 模板标签，避免注入风险
- `packages/db` 不直接依赖 `apps/server`/`apps/web`，保持数据库层与应用层解耦；业务专属的查询封装应放在调用方（如 `apps/server` 的 tRPC procedure）而不是塞进 `packages/db`
