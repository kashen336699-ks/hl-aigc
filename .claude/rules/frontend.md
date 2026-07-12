---
description: 前端开发规范 (apps/web — Vite + React 19 + TanStack Router/Query + tRPC + shadcn/ui)
globs: apps/web/**, packages/ui/**
---

# Frontend Rules

## 技术栈

- **构建**: Vite 8 + `@vitejs/plugin-react`，端口 3001（`apps/web/vite.config.ts`）
- **框架**: React 19（函数组件 + Hooks）
- **路由**: TanStack Router，文件路由（`apps/web/src/routes/**`），启用 `autoCodeSplitting`；不要手写 `routeTree.gen.ts`，它由 `tanstackRouter` 插件在 `dev`/`build` 时自动生成
- **数据请求**: TanStack Query + tRPC，通过 `createTRPCOptionsProxy`（见 `apps/web/src/utils/trpc.ts`）
- **样式**: Tailwind CSS v4（`@tailwindcss/vite` 插件，非 PostCSS 配置文件驱动）
- **UI 组件库**: `@hl-aigc/ui`（shadcn/ui，`style: base-lyra`，baseColor `neutral`，见 `packages/ui/components.json` / `apps/web/components.json`）
- **认证**: `better-auth/react` 客户端（`apps/web/src/lib/auth-client.ts`）
- **主题**: `next-themes`，`ThemeProvider` 挂在根组件，`attribute="class"`，storageKey `vite-ui-theme`

## 路径别名

- `@/*` → `apps/web/src/*`
- `@hl-aigc/ui/*` → `packages/ui/src/*`（组件用 `@hl-aigc/ui/components/*`，工具用 `@hl-aigc/ui/lib/*`，hooks 用 `@hl-aigc/ui/hooks/*`）
- 新代码统一使用别名导入，不要用跨包相对路径（如 `../../../packages/ui/...`）

## 路由约定（TanStack Router）

- 路由文件放在 `apps/web/src/routes/`，用 `createFileRoute("/path")({...})` 定义
- 需要登录保护的路由放在 `_auth/` 目录下（pathless layout route），在 `beforeLoad` 中用 `authClient.getSession()` 校验，未登录时 `throw redirect({ to: "/login" })`
- 根路由 `__root.tsx` 用 `createRootRouteWithContext<RouterAppContext>()`，通过 `head()` 设置 meta/title，不要在页面组件里手动操作 `document.title`
- 路由 `component` 里保持精简，业务逻辑/数据获取放到独立 hook 或组件中

## 数据请求（tRPC + TanStack Query）

- 统一通过 `trpc`（`createTRPCOptionsProxy` 生成的 proxy，来自 `@/utils/trpc`）调用后端，不要在组件里直接用 `fetch` 拼 `/trpc` 路径
- 查询用 `useQuery(trpc.xxx.yyy.queryOptions(...))`，变更用 `useMutation(trpc.xxx.yyy.mutationOptions(...))` 模式（tRPC + TanStack Query 官方推荐用法）
- 全局 `QueryClient` 已配置 `onError` 统一 toast 报错并提供 retry action（见 `utils/trpc.ts`），组件内不需要重复 try/catch 处理查询错误，除非有特殊 UI 需求
- 服务端类型来自 `@hl-aigc/api`（`AppRouter`），不要在前端手写重复的接口类型

## 环境变量

- 前端环境变量通过 `@hl-aigc/env/web` 的 `env` 对象读取（如 `env.VITE_SERVER_URL`），不要直接用 `import.meta.env.VITE_*`，统一走 env 包做校验

## UI 组件（shadcn/ui + Tailwind v4）

- 优先复用 `@hl-aigc/ui` 中已有组件（`packages/ui/src/components/`），如 `button`、`dropdown-menu`、`sonner` 等；新增可复用的基础组件应加入 `packages/ui`，而非在 `apps/web` 里重复实现
- 新增 shadcn 组件用 shadcn CLI（style `base-lyra`，见 `components.json`），保持生成产物与项目已有组件风格一致
- className 合并统一使用 `cn()`（`@hl-aigc/ui/lib/utils`，基于 `clsx` + `tailwind-merge`），不要手动字符串拼接 className
- 深浅色模式统一使用 Tailwind 的 `dark:` 变体 + CSS 变量（见 `packages/ui/src/styles/globals.css`），不要在组件里写 `theme === "dark" ? ... : ...` 分支渲染样式
- 表单校验使用 `@tanstack/react-form` + `@hookform/resolvers`/`zod`（项目依赖已包含），保持与现有 `sign-in-form.tsx`/`sign-up-form.tsx` 的写法一致
- Radix 风格组件基于 `@base-ui/react`，交互组件需要用 `render={<... />}` 的 render prop 模式传自定义触发元素时，参考 `mode-toggle.tsx` 的写法

## 组件组织

- 页面级组件放 `apps/web/src/routes/`，可复用的业务组件放 `apps/web/src/components/`，跨应用通用的基础 UI 组件放 `packages/ui/src/components/`
- 组件文件用 kebab-case 命名（如 `mode-toggle.tsx`、`user-menu.tsx`），导出组件名用 PascalCase
- 不要在组件内部定义组件；不要在渲染函数外部产生副作用

## 其他

- 提交前运行 `pnpm check`（`ultracite check`）与 `pnpm fix`（`ultracite fix`），确保通过 Biome 校验
- 类型检查用各 app 的 `check-types` script（`vite build && tsc --noEmit`）
