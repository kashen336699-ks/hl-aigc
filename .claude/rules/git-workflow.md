---
description: Git 提交、分支与合并规范（pnpm + Turborepo monorepo）
---

# Git 工作流规范

## 提交前检查

本项目未配置 husky/lint-staged 等 Git hooks，提交前需**手动**执行以下检查（Biome 由 Ultracite 驱动）：

```bash
pnpm fix          # ultracite fix，自动修复格式与可修复的 lint 问题
pnpm check-types   # turbo run check-types，确保类型检查通过
```

- 涉及 `packages/db` 的 schema 改动，需在提交前跑通 `pnpm db:generate`（必要时 `pnpm db:push`），确保生成的 migration 文件一并提交。
- 不要提交 `pnpm check` / `pnpm fix` 报错未修复的代码。

## Commit Message 规范

采用 [Conventional Commits](https://www.conventionalcommits.org/) 格式：

```
<type>(<scope>): <subject>
```

- **type**: `feat` | `fix` | `refactor` | `perf` | `docs` | `test` | `chore` | `style` | `build` | `ci`
- **scope**（可选）：受影响的 app/package，如 `web`、`server`、`db`、`auth`、`api`、`ui`、`config`、`env`
- **subject**：使用祈使句、简明描述改动目的，不以句号结尾

示例：

```
feat(server): add trpc procedure for github account sync
fix(web): correct auth redirect after login
chore(db): add migration for user table
```

- 提交信息使用中文或英文均可，但需在同一 PR/功能内保持一致。
- 一次提交只做一件事，避免把多个不相关改动混在一起。

## 分支命名

```
<type>/<short-description>
```

例如：`feat/github-account-sync`、`fix/web-auth-redirect`、`chore/upgrade-turbo`。

- 从 `main` 拉取新分支开发，禁止直接在 `main` 上进行日常开发提交。
- 分支名使用小写字母、数字与短横线，不使用下划线或空格。

## Monorepo 提交范围

- 优先按 app/package 拆分提交，便于追溯（例如 `apps/server` 的改动与 `packages/db` 的 schema 改动分开提交）。
- 跨包改动（如同时改 `packages/api` 的类型定义与 `apps/web` 的调用方）可以合并为一次提交，但 commit message 需说明改动范围。
- 不要提交以下生成/忽略内容：`node_modules`、`dist`、`.turbo`、`apps/web/src/routeTree.gen.ts`、`.env*`（参见根 `.gitignore`）。

## Pull Request（如使用远程协作）

- PR 标题遵循与 commit message 相同的 Conventional Commits 格式。
- PR 描述需包含：改动目的、涉及的 app/package、验证方式（如 `pnpm check-types`、`pnpm dev:web` 手动验证等）。
- 合并前确保 `pnpm build` 与 `pnpm check-types`（`turbo run build` / `turbo run check-types`）在受影响的包中通过。
- 目前仓库未配置 CI（无 `.github/workflows`），合并前的检查需由提交者本地手动完成。

## 禁止事项

- 禁止 `git push --force` 到 `main`。
- 禁止提交 `.env`、密钥等敏感文件。
- 禁止使用 `git commit --no-verify` 跳过检查（即使当前未配置 hook，也应保持养成习惯）。
- 禁止在一次提交中夹带无关的格式化重排（应先单独跑 `pnpm fix` 提交，再进行功能改动）。
