import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

function extractPdrCode(cause: unknown): string | undefined {
	if (
		typeof cause === "object" &&
		cause !== null &&
		"pdrCode" in cause &&
		typeof cause.pdrCode === "string"
	) {
		return cause.pdrCode;
	}
	return;
}

export const t = initTRPC.context<Context>().create({
	errorFormatter({ shape, error }) {
		return {
			...shape,
			data: {
				...shape.data,
				pdrCode: extractPdrCode(error.cause),
			},
		};
	},
});

export const router = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
	if (!ctx.session) {
		throw new TRPCError({
			code: "UNAUTHORIZED",
			message: "Authentication required",
			cause: "No session",
		});
	}
	return next({
		ctx: {
			...ctx,
			session: ctx.session,
		},
	});
});

export const adminProcedure = protectedProcedure.use(({ ctx, next }) => {
	if (ctx.session.user.role !== "admin") {
		throw new TRPCError({
			code: "FORBIDDEN",
			message: "Admin privileges required",
			cause: "Insufficient role",
		});
	}
	return next({ ctx });
});
