CREATE TABLE "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"key" varchar(50) NOT NULL,
	"name" varchar(100) NOT NULL,
	"is_system" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_tenant_id_key_unique" UNIQUE("tenant_id","key"),
	CONSTRAINT "roles_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "roles_key_normalized" CHECK ("roles"."key" = lower(btrim("roles"."key")) and "roles"."key" ~ '^[a-z]+(?:_[a-z]+)*$')
);
--> statement-breakpoint
ALTER TABLE "roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "capabilities" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" varchar(100) NOT NULL,
	"description" varchar(240) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "capabilities_key_unique" UNIQUE("key"),
	CONSTRAINT "capabilities_key_normalized" CHECK ("capabilities"."key" = lower(btrim("capabilities"."key")) and "capabilities"."key" ~ '^[a-z]+(?:[._][a-z]+)*$')
);
--> statement-breakpoint
CREATE TABLE "role_capabilities" (
	"tenant_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"capability_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "role_capabilities_tenant_role_capability_pk" PRIMARY KEY("tenant_id","role_id","capability_id")
);
--> statement-breakpoint
ALTER TABLE "role_capabilities" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tenant_user_roles" (
	"tenant_id" uuid NOT NULL,
	"tenant_user_id" uuid NOT NULL,
	"role_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_user_roles_tenant_user_role_pk" PRIMARY KEY("tenant_id","tenant_user_id","role_id")
);
--> statement-breakpoint
ALTER TABLE "tenant_user_roles" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "tenant_users" DROP CONSTRAINT "tenant_users_tenant_id_user_id_pk";--> statement-breakpoint
ALTER TABLE "tenant_users" ADD COLUMN "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "roles" ADD CONSTRAINT "roles_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_capabilities" ADD CONSTRAINT "role_capabilities_capability_id_capabilities_id_fk" FOREIGN KEY ("capability_id") REFERENCES "public"."capabilities"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "role_capabilities" ADD CONSTRAINT "role_capabilities_tenant_role_fk" FOREIGN KEY ("tenant_id","role_id") REFERENCES "public"."roles"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_user_id_unique" UNIQUE("tenant_id","user_id");--> statement-breakpoint
ALTER TABLE "tenant_users" ADD CONSTRAINT "tenant_users_tenant_id_id_unique" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "tenant_user_roles" ADD CONSTRAINT "tenant_user_roles_tenant_user_fk" FOREIGN KEY ("tenant_id","tenant_user_id") REFERENCES "public"."tenant_users"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_user_roles" ADD CONSTRAINT "tenant_user_roles_tenant_role_fk" FOREIGN KEY ("tenant_id","role_id") REFERENCES "public"."roles"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "roles_tenant_id_idx" ON "roles" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "role_capabilities_tenant_id_idx" ON "role_capabilities" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "tenant_user_roles_tenant_user_idx" ON "tenant_user_roles" USING btree ("tenant_id","tenant_user_id");--> statement-breakpoint
CREATE POLICY "roles_tenant_isolation" ON "roles" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("roles"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("roles"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "role_capabilities_tenant_isolation" ON "role_capabilities" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("role_capabilities"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("role_capabilities"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_user_roles_tenant_isolation" ON "tenant_user_roles" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("tenant_user_roles"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("tenant_user_roles"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "roles" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "role_capabilities" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "tenant_user_roles" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT ON TABLE "capabilities" TO "mesa_digital_app";
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "roles", "role_capabilities", "tenant_user_roles" TO "mesa_digital_app";
--> statement-breakpoint
INSERT INTO "capabilities" ("key", "description") VALUES
('tenant.manage', 'Manage tenant settings'),
('user.read', 'Read tenant users'), ('user.manage', 'Manage tenant users'),
('role.read', 'Read roles'), ('role.manage', 'Manage roles'),
('catalog.read', 'Read catalog'), ('catalog.manage', 'Manage catalog'),
('table.read', 'Read tables'), ('table.manage', 'Manage tables'),
('qr.manage', 'Manage QR credentials'),
('order.read', 'Read orders'), ('order.create', 'Create orders'),
('order.manage', 'Manage orders'),
('production.read', 'Read production'),
('production.manage', 'Manage production'),
('cancellation.request', 'Request cancellation'),
('cancellation.approve', 'Approve cancellation'),
('session.read', 'Read table sessions'),
('session.withdraw_check_request', 'Withdraw a check request'),
('session.start_closing', 'Start session closing'),
('session.close', 'Close a session'),
('session.correct_closed', 'Correct a closed session with audit'),
('audit.read', 'Read audit events'), ('report.read', 'Read reports')
ON CONFLICT ("key") DO UPDATE SET "description" = excluded."description";
