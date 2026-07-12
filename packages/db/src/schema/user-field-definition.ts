import { boolean, pgTable, text, timestamp } from "drizzle-orm/pg-core";

/**
 * Admin-managed custom field definitions for `github_users` records
 * (dynamic field model — see specs/1.github-account-sync/design.md).
 *
 * `key` must match `^[a-z][a-z0-9_]*$` and is validated at the application
 * layer (zod) before insert; `type` is one of
 * `text | textarea | number | boolean | datetime`, also validated at the
 * application layer rather than enforced via a Postgres enum type.
 */
export const userFieldDefinition = pgTable("user_field_definitions", {
	id: text("id")
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID()),
	name: text("name").notNull(),
	key: text("key").notNull().unique(),
	type: text("type").notNull(),
	required: boolean("required").default(false).notNull(),
	description: text("description"),
	isSystem: boolean("is_system").default(false).notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
	updatedAt: timestamp("updated_at")
		.defaultNow()
		.$onUpdate(() => /* @__PURE__ */ new Date())
		.notNull(),
});
