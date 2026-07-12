import { integer, pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const githubUser = pgTable("github_users", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	githubId: text("github_id").notNull().unique(),
	login: text("login").notNull(),
	nodeId: text("node_id"),
	avatarUrl: text("avatar_url"),
	htmlUrl: text("html_url"),
	name: text("name"),
	company: text("company"),
	blog: text("blog"),
	location: text("location"),
	email: text("email"),
	bio: text("bio"),
	twitterUsername: text("twitter_username"),
	publicRepos: integer("public_repos").notNull(),
	publicGists: integer("public_gists").notNull(),
	followers: integer("followers").notNull(),
	following: integer("following").notNull(),
	githubCreatedAt: timestamp("github_created_at").notNull(),
	githubUpdatedAt: timestamp("github_updated_at").notNull(),
	syncedAt: timestamp("synced_at").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});
