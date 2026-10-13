CREATE TABLE "compliance_audit_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"admin_id" integer NOT NULL,
	"conversation_id" integer NOT NULL,
	"case_reference" text NOT NULL,
	"justification" text NOT NULL,
	"authorized_by" text NOT NULL,
	"action" text DEFAULT 'inspection_access' NOT NULL,
	"ip_address" text,
	"grant_token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_verifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"otp_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "password_resets" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"otp_hash" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp NOT NULL,
	"used_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "sender_role" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "attachments" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "voice_duration" numeric;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "cnic_number" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "person_address" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "business_address" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "driving_license_number" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "license_expiry_date" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plate_number" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "sessions_revoked_at" timestamp;--> statement-breakpoint
ALTER TABLE "compliance_audit_logs" ADD CONSTRAINT "compliance_audit_logs_admin_id_users_id_fk" FOREIGN KEY ("admin_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "compliance_audit_logs" ADD CONSTRAINT "compliance_audit_logs_conversation_id_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."conversations"("id") ON DELETE cascade ON UPDATE no action;