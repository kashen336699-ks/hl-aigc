import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core";
import { githubUser } from "./github-user";
import { userFieldDefinition } from "./user-field-definition";

/**
 * Per-`github_users` values for admin-defined custom fields
 * (dynamic field model — see specs/1.github-account-sync/design.md).
 *
 * V1.0 does not ship a value-entry UI; this table is created to hold the
 * shape for future writes. `value` stores all `type`s as text; the
 * application layer is responsible for serializing/deserializing per
 * `userFieldDefinition.type`.
 *
 * Both foreign keys cascade on delete: a value row only makes sense in the
 * context of its owning github user and field definition, so removing
 * either parent should remove the value (unlike audit-log FKs, which record
 * historical facts and must not cascade).
 */
export const userFieldValue = pgTable(
	"user_field_values",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		githubUserId: text("github_user_id")
			.notNull()
			.references(() => githubUser.id, { onDelete: "cascade" }),
		fieldDefinitionId: text("field_definition_id")
			.notNull()
			.references(() => userFieldDefinition.id, { onDelete: "cascade" }),
		value: text("value"),
		createdAt: timestamp("created_at").defaultNow().notNull(),
		updatedAt: timestamp("updated_at")
			.defaultNow()
			.$onUpdate(() => /* @__PURE__ */ new Date())
			.notNull(),
	},
	(table) => [
		index("userFieldValue_githubUserId_idx").on(table.githubUserId),
		index("userFieldValue_fieldDefinitionId_idx").on(table.fieldDefinitionId),
		unique("userFieldValue_githubUserId_fieldDefinitionId_unique").on(
			table.githubUserId,
			table.fieldDefinitionId
		),
	]
);

export const userFieldValueRelations = relations(userFieldValue, ({ one }) => ({
	githubUser: one(githubUser, {
		fields: [userFieldValue.githubUserId],
		references: [githubUser.id],
	}),
	fieldDefinition: one(userFieldDefinition, {
		fields: [userFieldValue.fieldDefinitionId],
		references: [userFieldDefinition.id],
	}),
}));
