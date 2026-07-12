CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"role" text DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "field_audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"action" text NOT NULL,
	"field_key" text NOT NULL,
	"operator_user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "github_users" (
	"id" text PRIMARY KEY NOT NULL,
	"github_id" text NOT NULL,
	"login" text NOT NULL,
	"node_id" text,
	"avatar_url" text,
	"html_url" text,
	"name" text,
	"company" text,
	"blog" text,
	"location" text,
	"email" text,
	"bio" text,
	"twitter_username" text,
	"public_repos" integer NOT NULL,
	"public_gists" integer NOT NULL,
	"followers" integer NOT NULL,
	"following" integer NOT NULL,
	"github_created_at" timestamp NOT NULL,
	"github_updated_at" timestamp NOT NULL,
	"synced_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "github_users_github_id_unique" UNIQUE("github_id")
);
--> statement-breakpoint
CREATE TABLE "user_field_definitions" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"key" text NOT NULL,
	"type" text NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"description" text,
	"is_system" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_field_definitions_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "user_field_values" (
	"id" text PRIMARY KEY NOT NULL,
	"github_user_id" text NOT NULL,
	"field_definition_id" text NOT NULL,
	"value" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "userFieldValue_githubUserId_fieldDefinitionId_unique" UNIQUE("github_user_id","field_definition_id")
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_audit_logs" ADD CONSTRAINT "field_audit_logs_operator_user_id_user_id_fk" FOREIGN KEY ("operator_user_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_field_values" ADD CONSTRAINT "user_field_values_github_user_id_github_users_id_fk" FOREIGN KEY ("github_user_id") REFERENCES "public"."github_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_field_values" ADD CONSTRAINT "user_field_values_field_definition_id_user_field_definitions_id_fk" FOREIGN KEY ("field_definition_id") REFERENCES "public"."user_field_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");--> statement-breakpoint
CREATE INDEX "fieldAuditLog_operatorUserId_idx" ON "field_audit_logs" USING btree ("operator_user_id");--> statement-breakpoint
CREATE INDEX "userFieldValue_githubUserId_idx" ON "user_field_values" USING btree ("github_user_id");--> statement-breakpoint
CREATE INDEX "userFieldValue_fieldDefinitionId_idx" ON "user_field_values" USING btree ("field_definition_id");