import { createDb } from "@hl-aigc/db";
// biome-ignore lint/performance/noNamespaceImport: drizzleAdapter 需要完整 schema 对象
import * as schema from "@hl-aigc/db/schema/auth";
import { env } from "@hl-aigc/env/server";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

export function createAuth() {
	const db = createDb();

	return betterAuth({
		database: drizzleAdapter(db, {
			provider: "pg",

			schema,
		}),
		trustedOrigins: [env.CORS_ORIGIN],
		emailAndPassword: {
			enabled: true,
		},
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		user: {
			additionalFields: {
				role: {
					type: ["user", "admin"] as const,
					// Clients must never be able to set their own role at
					// sign-up/update; role is only promoted via direct DB/seed
					// script (see specs/1.github-account-sync).
					input: false,
					defaultValue: "user",
				},
			},
		},
		advanced: {
			defaultCookieAttributes: {
				sameSite: "none",
				secure: true,
				httpOnly: true,
			},
		},
		plugins: [],
	});
}

export const auth = createAuth();
