---
description: TypeScript/Biome (Ultracite) coding style for the hl-aigc monorepo
globs: "**/*.{ts,tsx}"
---

# Coding Style

This repo enforces style via **Biome** (extending `ultracite/biome/core` + `ultracite/biome/react`), configured in `biome.json` at the repo root. Rules below are inferred from that config plus the shared `tsconfig.base.json` (`packages/config`). See `.claude/CLAUDE.md` for the full Ultracite standards reference — this file only calls out what's specific/enforced in this repo.

## Formatting (Biome-enforced, run `pnpm fix`)

- Indent style: **tabs**, not spaces.
- Quote style: **double quotes** for JS/TS strings.
- Imports: `organizeImports` is on — don't hand-order imports, let `pnpm fix` sort them.
- Never hand-format to fight Biome; run `pnpm fix` (`ultracite fix`) before committing and `pnpm check` (`ultracite check`) to verify.

## Linting rules explicitly enforced (`biome.json` overrides)

- `noParameterAssign`: never reassign function parameters.
- `useAsConstAssertion`: use `as const` for literal/immutable values.
- `useDefaultParameterLast`: default parameters must come last.
- `useEnumInitializers`: always initialize enum members explicitly.
- `useSelfClosingElements`: self-close JSX elements with no children (`<Foo />`).
- `useSingleVarDeclarator`: one variable per `const`/`let` declaration.
- `noUnusedTemplateLiteral`: don't use template literals when a plain string works.
- `useNumberNamespace`: use `Number.parseInt`/`Number.isNaN` etc., not global `parseInt`/`isNaN`.
- `noInferrableTypes`: don't annotate types TypeScript can already infer (e.g. `const x: number = 5`).
- `noUselessElse`: no `else` after a block that always returns/throws — prefer early return.
- `useExhaustiveDependencies` is set to `info` (warn only) — still fix hook dependency arrays, but it won't fail CI.
- Tailwind class sorting (`useSortedClasses`, nursery) is a **warning with safe autofix**, applied to `clsx`, `cva`, and `cn` calls — let `pnpm fix` reorder classes rather than hand-ordering them.

## TypeScript (`tsconfig.base.json`)

- `strict: true` plus `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch` — code must compile clean under these; don't add `// @ts-ignore` to route around them, fix the type.
- `verbatimModuleSyntax: true` — use `import type { X }` / `export type { X }` for type-only imports/exports (mixed imports will fail the build).
- `isolatedModules: true` — every file must be independently transpilable; don't rely on cross-file type merging that breaks this (e.g. re-exporting a `const enum`).
- Root `tsconfig.json` additionally sets `strictNullChecks: true` (redundant under `strict`, kept explicit).
- Module target is `ESNext` with `moduleResolution: bundler` — use ESM import syntax everywhere, no `require()`.
- Run `pnpm check-types` (`turbo run check-types`) to validate across the monorepo.

## Monorepo conventions

- Workspace packages are scoped `@hl-aigc/*` (`packages/api`, `auth`, `config`, `db`, `env`, `ui`). Import shared logic via the package name (e.g. `@hl-aigc/db`), never via relative `../../packages/...` paths across app boundaries.
- Backend (`apps/server`): Hono + tRPC + Drizzle ORM + better-auth. Define tRPC routers under `packages/api/src/routers`; keep request/response shapes validated with `zod`.
- Frontend (`apps/web`): Vite + React 19 + Tailwind v4. Components live under `src/components`, routes under `src/routes` (file-based routing) — follow the existing flat structure rather than introducing new nesting conventions.
- No test script is currently configured (root and per-app `package.json`) — don't assume a test runner exists; check before adding test-only lint rules or invoking `pnpm test`.

## General (from Ultracite baseline, worth restating)

- Prefer `unknown` over `any`.
- Use `for...of` over `.forEach()`/indexed loops.
- Use optional chaining (`?.`) and nullish coalescing (`??`).
- Always `await` promises inside async functions; handle errors with `try-catch`.
- No `console.log`, `debugger`, or `alert` left in committed code.
- Throw `Error` objects with descriptive messages, never raw strings.
