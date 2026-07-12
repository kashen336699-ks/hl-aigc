import { db } from "@hl-aigc/db";
import { githubUser } from "@hl-aigc/db/schema/github-user";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure, publicProcedure, router } from "../index";
import {
	fetchGithubUser,
	GithubClientError,
	type GithubClientErrorKind,
} from "../lib/github-client";
import { createRateLimiter } from "../lib/rate-limiter";

const SYNC_RATE_LIMIT_MAX_REQUESTS = 5;
const SYNC_RATE_LIMIT_WINDOW_MS = 60_000;

const syncRateLimiter = createRateLimiter({
	maxRequests: SYNC_RATE_LIMIT_MAX_REQUESTS,
	windowMs: SYNC_RATE_LIMIT_WINDOW_MS,
});

const GITHUB_CLIENT_ERROR_TO_PDR_CODE: Record<GithubClientErrorKind, string> = {
	invalid: "GITHUB_TOKEN_INVALID",
	permission: "GITHUB_PERMISSION_DENIED",
	rate_limited: "GITHUB_RATE_LIMITED",
	unavailable: "GITHUB_UNAVAILABLE",
	timeout: "GITHUB_UNAVAILABLE",
};

const GITHUB_CLIENT_ERROR_TO_TRPC_CODE: Record<
	GithubClientErrorKind,
	"BAD_REQUEST" | "FORBIDDEN" | "TOO_MANY_REQUESTS" | "INTERNAL_SERVER_ERROR"
> = {
	invalid: "BAD_REQUEST",
	permission: "FORBIDDEN",
	rate_limited: "TOO_MANY_REQUESTS",
	unavailable: "INTERNAL_SERVER_ERROR",
	timeout: "INTERNAL_SERVER_ERROR",
};

function toTrpcError(error: GithubClientError): TRPCError {
	return new TRPCError({
		code: GITHUB_CLIENT_ERROR_TO_TRPC_CODE[error.kind],
		message: error.message,
		cause: { pdrCode: GITHUB_CLIENT_ERROR_TO_PDR_CODE[error.kind] },
	});
}

const syncProfileInputSchema = z.object({
	token: z.string().trim().min(1, "Token is required"),
});

export const githubRouter = router({
	syncProfile: publicProcedure
		.input(syncProfileInputSchema)
		.mutation(async ({ ctx, input }) => {
			const rateLimit = syncRateLimiter.check(ctx.clientIp);
			if (!rateLimit.allowed) {
				throw new TRPCError({
					code: "TOO_MANY_REQUESTS",
					message: "Too many sync requests, please try again later",
					cause: { pdrCode: "GITHUB_RATE_LIMITED" },
				});
			}

			let profile: Awaited<ReturnType<typeof fetchGithubUser>>;
			try {
				profile = await fetchGithubUser(input.token);
			} catch (error) {
				if (error instanceof GithubClientError) {
					throw toTrpcError(error);
				}
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to sync GitHub profile",
					cause: { pdrCode: "GITHUB_UNAVAILABLE" },
				});
			}

			const syncedAt = /* @__PURE__ */ new Date();
			const values = {
				githubId: String(profile.id),
				login: profile.login,
				nodeId: profile.node_id ?? null,
				avatarUrl: profile.avatar_url ?? null,
				htmlUrl: profile.html_url ?? null,
				name: profile.name ?? null,
				company: profile.company ?? null,
				blog: profile.blog ?? null,
				location: profile.location ?? null,
				email: profile.email ?? null,
				bio: profile.bio ?? null,
				twitterUsername: profile.twitter_username ?? null,
				publicRepos: profile.public_repos,
				publicGists: profile.public_gists,
				followers: profile.followers,
				following: profile.following,
				githubCreatedAt: new Date(profile.created_at),
				githubUpdatedAt: new Date(profile.updated_at),
				syncedAt,
			};

			let saved: typeof githubUser.$inferSelect;
			try {
				const [upserted] = await db
					.insert(githubUser)
					.values(values)
					.onConflictDoUpdate({
						target: githubUser.githubId,
						set: values,
					})
					.returning();
				if (!upserted) {
					throw new Error("Upsert returned no row");
				}
				saved = upserted;
			} catch {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to persist GitHub profile",
					cause: { pdrCode: "DATABASE_ERROR" },
				});
			}

			return {
				id: saved.id,
				githubId: saved.githubId,
				login: saved.login,
				name: saved.name,
				avatarUrl: saved.avatarUrl,
				htmlUrl: saved.htmlUrl,
				bio: saved.bio,
				publicRepos: saved.publicRepos,
				followers: saved.followers,
				syncedAt: saved.syncedAt,
			};
		}),

	getUser: adminProcedure
		.input(z.object({ id: z.string().min(1) }))
		.query(async ({ input }) => {
			const record = await db.query.githubUser.findFirst({
				where: eq(githubUser.id, input.id),
			});

			if (!record) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "GitHub user not found",
				});
			}

			return record;
		}),
});
