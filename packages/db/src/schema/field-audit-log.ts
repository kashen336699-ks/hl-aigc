import { relations } from "drizzle-orm";
import { index, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "./auth";

export const fieldAuditLog = pgTable(
	"field_audit_logs",
	{
		id: text("id")
			.primaryKey()
			.$defaultFn(() => crypto.randomUUID()),
		action: text("action").$type<"created" | "deleted">().notNull(),
		fieldKey: text("field_key").notNull(),
		operatorUserId: text("operator_user_id")
			.notNull()
			.references(() => user.id, { onDelete: "restrict" }),
		createdAt: timestamp("created_at").defaultNow().notNull(),
	},
	(table) => [
		index("fieldAuditLog_operatorUserId_idx").on(table.operatorUserId),
	]
);

export const fieldAuditLogRelations = relations(fieldAuditLog, ({ one }) => ({
	operator: one(user, {
		fields: [fieldAuditLog.operatorUserId],
		references: [user.id],
	}),
}));
