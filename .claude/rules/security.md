---
description: Security rules for auth, env/secrets, CORS, tRPC authorization, and database access in this monorepo
globs: apps/**,packages/**
---

# Security

## Secrets & Environment Variables

- All env vars are declared and validated via `@t3-oss/env-core` in `packages/env/src/server.ts` (server) and `packages/env/src/web.ts` (client). Never read `process.env.*` / `import.meta.env.*` directly in app code — import `env` from `@hl-aigc/env/server` or `@hl-aigc/env/web` instead.
- When adding a new secret or config value, add it to the appropriate schema in `packages/env/src` with the strictest reasonable zod validator (e.g. `z.string().min(32)` for secrets like `BETTER_AUTH_SECRET`), not a bare `z.string()`.
- Only variables prefixed `VITE_` may be exposed to the client (`apps/web`). Never put secrets (API keys, DB URL, `BETTER_AUTH_SECRET`) behind a `VITE_` prefix.
- Never commit `.env`, `.env*.local`, or any file containing real secrets — `.gitignore` already excludes `.env` and `.env*.local`; keep it that way and don't add overrides.
- Never hardcode secrets, API keys, or credentials in source files, tests, or fixtures. Use env vars.
- Don't log full request headers, cookies, session tokens, or `Authorization` values.

## Authentication (better-auth)

- Auth is configured once in `packages/auth/src/index.ts` via `createAuth()` / the exported `auth` singleton. Don't instantiate a second `betterAuth()` instance elsewhere.
- Session cookies use `httpOnly: true`, `secure: true`, `sameSite: "none"` (see `advanced.defaultCookieAttributes`). Do not weaken these when touching auth config; if `sameSite: "none"` changes, `secure` must stay `true` (browsers reject `SameSite=None` without `Secure`).
- `trustedOrigins` is derived from `env.CORS_ORIGIN`. Do not hardcode additional origins or wildcard it.
- The auth HTTP handler is mounted at `/api/auth/*` and must stay outside/ahead of any auth-requiring middleware — don't wrap it in `protectedProcedure` or similar.
- Never bypass better-auth by minting your own session tokens/cookies or rolling custom password hashing.

## Authorization (tRPC)

- Any procedure that reads or mutates user-owned or non-public data must use `protectedProcedure` from `packages/api/src/index.ts`, never `publicProcedure`.
- Inside protected procedures, scope all DB queries to `ctx.session.user.id` (or equivalent). Never trust a client-supplied user/org ID for authorization decisions — derive identity from `ctx.session` only.
- Don't add ad-hoc auth checks inside individual procedure bodies when a `protectedProcedure`-style middleware would do — keep authorization centralized in `packages/api/src/index.ts` so it can't be forgotten on a new route.
- Validate all tRPC input with zod schemas (`.input(z.object({...}))`); never accept unvalidated/untyped input from the client.

## CORS & Network

- CORS is configured once in `apps/server/src/index.ts` using `env.CORS_ORIGIN` — a single trusted origin with `credentials: true`. Don't change `origin` to `"*"` or a wildcard while `credentials: true` is set (invalid and unsafe), and don't add extra permissive CORS middleware elsewhere.
- Keep `allowMethods` / `allowHeaders` minimal — only add methods/headers actually needed by a new endpoint.
- Any new backend route (Hono handler) that touches session/user data must go through the same `cors` + auth pattern already established, not a separate unauthenticated app instance.

## Database (Drizzle ORM)

- Use Drizzle's query builder / parameterized queries for all DB access. Never build SQL via string concatenation or template literals with unsanitized input, even with `sql\`...\`` — use `sql.placeholder` / parameter binding if raw SQL is unavoidable.
- Schema changes go through `pnpm db:generate` + `pnpm db:migrate` (or `pnpm db:push` in dev) — don't hand-edit generated migration files to mask a schema/security issue.
- Don't select or return sensitive columns (password hashes, tokens) from queries that feed client-facing responses; better-auth's schema (`packages/db/schema/auth`) already isolates credential storage — don't duplicate password/session handling in app tables.

## General

- Add `rel="noopener"` (and typically `noreferrer`) on any `target="_blank"` link in `apps/web`.
- Never use `eval()`, `Function(...)` from strings, or `dangerouslySetInnerHTML` with unsanitized data.
- Validate and sanitize all external/user input at the boundary (tRPC input schemas, Hono route handlers) before it reaches business logic.
- When adding new workspace packages that need env access, depend on `@hl-aigc/env` rather than reading `process.env` directly, so validation stays centralized.
