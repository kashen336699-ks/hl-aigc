---
description: 测试相关规范与当前项目测试现状说明
---

# Testing

## 当前现状

- 根目录及各 app/package 的 `package.json` **均未配置 `test` 脚本**，仓库中也没有任何 `*.test.*` / `*.spec.*` 文件或 Vitest/Jest 等测试框架依赖。
- `turbo.json` 中没有 `test` task。
- 在测试基础设施补齐之前，代码质量的主要保障手段是：
  - `pnpm check`（即 `ultracite check`，底层为 Biome）用于静态检查
  - `pnpm fix`（即 `ultracite fix`）用于自动修复
  - `pnpm check-types`（`turbo run check-types`，各 app 通过 `tsc -b` / `vite build && tsc --noEmit`）用于类型检查
- 新增代码前，先确认是否已有测试脚本/框架；如无，不要臆造 `pnpm test` 等不存在的命令。

## 引入测试时的建议规范

若后续为本 monorepo（Turborepo + pnpm workspaces, TypeScript）添加测试，遵循以下约定以保持一致性：

- **框架**：优先使用 **Vitest**（与 Vite/TS/ESM 生态一致，`apps/web` 已用 Vite），避免引入 Jest 造成配置重复。
- **位置与命名**：测试文件与被测源码同目录，命名为 `*.test.ts` / `*.test.tsx`；不要额外建立与源码结构脱节的 `__tests__` 平铺目录。
- **脚本约定**：
  - 每个需要测试的 app/package 在自己的 `package.json` 中添加 `"test": "vitest run"`（或按需 `"test:watch": "vitest"`）。
  - 在根 `turbo.json` 中新增 `test` task，并根据是否依赖构建产物设置 `dependsOn`（一般为 `["^build"]` 或留空）、`inputs`。
  - 通过根 `package.json` 增加 `"test": "turbo run test"` 统一入口。
- **分层**：
  - `packages/db`：对 Drizzle schema / repository 函数的单元测试，测试数据库操作建议使用独立的测试数据库或内存/临时 SQLite，不得连到开发/生产数据库。
  - `packages/auth`：对 better-auth 相关的自定义逻辑（如权限判断、hook）编写单元测试。
  - `apps/server`：对 tRPC procedure / Hono route 的集成测试，使用 tRPC 的 caller 或 Hono 的 `app.request` 直接调用，不必起真实 HTTP server。
  - `apps/web`：对纯逻辑（hooks、utils）用 Vitest 单元测试；对组件按需使用 `@testing-library/react`；避免为简单展示型组件强行编写测试。
- **异步测试**：遵循项目整体的异步规范（见 Ultracite 标准）——测试内使用 `async/await`，断言写在 `it()`/`test()` 内部，不使用 `done` 回调。
- **禁止事项**：
  - 不在提交的测试代码中使用 `.only` / `.skip`。
  - 不在测试中直接连接真实的第三方服务（数据库/邮件/支付等），必须 mock 或使用测试专用实例。
  - 不因为“懒得配置”而把测试断言写成 `console.log` 打印，必须使用真实的 `expect`/`assert`。

## Ultracite 作为测试前置门槛

- 提交前运行 `pnpm dlx ultracite fix` 修复自动可修复项，`pnpm check` 确认无遗留问题；这是当前唯一强制的自动化质量门槛，测试基础设施补齐后应与其并列而非取代。
