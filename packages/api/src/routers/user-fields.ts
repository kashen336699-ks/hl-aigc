import { db } from "@hl-aigc/db";
import { fieldAuditLog } from "@hl-aigc/db/schema/field-audit-log";
import { userFieldDefinition } from "@hl-aigc/db/schema/user-field-definition";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { adminProcedure, router } from "../index";

const FIELD_KEY_PATTERN = /^[a-z][a-z0-9_]*$/;

const fieldTypeSchema = z.enum([
	"text",
	"textarea",
	"number",
	"boolean",
	"datetime",
]);

const createFieldInputSchema = z.object({
	name: z.string().trim().min(1, "Name is required"),
	key: z
		.string()
		.trim()
		.min(1, "Key is required")
		.regex(
			FIELD_KEY_PATTERN,
			"Key must start with a lowercase letter and contain only lowercase letters, digits, or underscores"
		),
	type: fieldTypeSchema,
	required: z.boolean().optional().default(false),
	description: z.string().trim().min(1).optional(),
});

export const userFieldsRouter = router({
	list: adminProcedure.query(() =>
		db.query.userFieldDefinition.findMany({
			orderBy: (fields, { asc }) => [asc(fields.createdAt)],
		})
	),

	create: adminProcedure
		.input(createFieldInputSchema)
		.mutation(async ({ ctx, input }) => {
			const existing = await db.query.userFieldDefinition.findFirst({
				where: eq(userFieldDefinition.key, input.key),
			});
			if (existing) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: `Field key "${input.key}" already exists`,
					cause: { pdrCode: "FIELD_KEY_CONFLICT" },
				});
			}

			try {
				return await db.transaction(async (tx) => {
					const [created] = await tx
						.insert(userFieldDefinition)
						.values({
							name: input.name,
							key: input.key,
							type: input.type,
							required: input.required,
							description: input.description ?? null,
						})
						.returning();
					if (!created) {
						throw new Error("Insert returned no row");
					}

					await tx.insert(fieldAuditLog).values({
						action: "created",
						fieldKey: input.key,
						operatorUserId: ctx.session.user.id,
					});

					return created;
				});
			} catch {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "Failed to create field definition",
					cause: { pdrCode: "DATABASE_ERROR" },
				});
			}
		}),

	delete: adminProcedure
		.input(z.object({ id: z.string().min(1) }))
		.mutation(async ({ ctx, input }) => {
			const existing = await db.query.userFieldDefinition.findFirst({
				where: eq(userFieldDefinition.id, input.id),
			});

			if (!existing) {
				throw new TRPCError({
					code: "NOT_FOUND",
					message: "Field definition not found",
					cause: { pdrCode: "FIELD_NOT_FOUND" },
				});
			}

			if (existing.isSystem) {
				throw new TRPCError({
					code: "FORBIDDEN",
					message: "System fields cannot be deleted",
					cause: { pdrCode: "SYSTEM_FIELD_PROTECTED" },
				});
			}

			await db.transaction(async (tx) => {
				await tx
					.delete(userFieldDefinition)
					.where(eq(userFieldDefinition.id, existing.id));

				await tx.insert(fieldAuditLog).values({
					action: "deleted",
					fieldKey: existing.key,
					operatorUserId: ctx.session.user.id,
				});
			});

			return { id: existing.id, deleted: true as const };
		}),
});
