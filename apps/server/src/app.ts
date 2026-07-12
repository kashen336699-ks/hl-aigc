import { createContext } from "@hl-aigc/api/context";
import { appRouter } from "@hl-aigc/api/routers/index";
import { auth } from "@hl-aigc/auth";
import { env } from "@hl-aigc/env/server";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

const STATUS_PAGE = `<!doctype html>
<html lang="zh-CN">
	<head>
		<meta charset="utf-8" />
		<meta name="viewport" content="width=device-width, initial-scale=1" />
		<title>hl-aigc API</title>
		<style>
			body {
				font-family: ui-sans-serif, system-ui, sans-serif;
				max-width: 40rem;
				margin: 4rem auto;
				padding: 0 1rem;
				color: #1f2937;
			}
			h1 { font-size: 1.5rem; }
			code {
				background: #f3f4f6;
				padding: 0.15rem 0.4rem;
				border-radius: 0.25rem;
				font-size: 0.875em;
			}
			.ok { color: #16a34a; font-weight: 600; }
			li { margin: 0.4rem 0; }
		</style>
	</head>
	<body>
		<h1>hl-aigc API</h1>
		<p>服务状态:<span class="ok">运行中</span>(Hono on AWS Lambda + API Gateway)</p>
		<ul>
			<li>健康检查:<code>GET /healthz</code></li>
			<li>业务接口:<code>/trpc/*</code>(tRPC)</li>
			<li>认证:<code>/api/auth/*</code>(better-auth)</li>
		</ul>
	</body>
</html>`;

export const app = new Hono();

app.use(logger());
app.use(
	"/*",
	cors({
		origin: env.CORS_ORIGIN,
		allowMethods: ["GET", "POST", "OPTIONS"],
		allowHeaders: ["Content-Type", "Authorization"],
		credentials: true,
	})
);

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

app.use(
	"/trpc/*",
	trpcServer({
		router: appRouter,
		createContext: (_opts, context) => createContext({ context }),
	})
);

app.get("/", (c) => c.html(STATUS_PAGE));

app.get("/healthz", (c) => c.text("OK"));
