import { protectedProcedure, publicProcedure, router } from "../index";
import { githubRouter } from "./github";
import { userFieldsRouter } from "./user-fields";

export const appRouter = router({
	healthCheck: publicProcedure.query(() => "OK"),
	privateData: protectedProcedure.query(({ ctx }) => ({
		message: "This is private",
		user: ctx.session.user,
	})),
	github: githubRouter,
	userFields: userFieldsRouter,
});
export type AppRouter = typeof appRouter;
