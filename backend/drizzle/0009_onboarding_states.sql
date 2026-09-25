CREATE TABLE "onboarding_states" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"step" varchar(50) NOT NULL,
	"data" varchar(5000) DEFAULT '{}' NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "onboarding_states_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "onboarding_states_step_valid" CHECK ("onboarding_states"."step" in ('BASIC_DATA','IDENTITY','ENTRY_MODE','SERVICE_POINTS','STATIONS','CATALOG','COMPLETED'))
);
--> statement-breakpoint
ALTER TABLE "onboarding_states" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "onboarding_states" ADD CONSTRAINT "onboarding_states_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "onboarding_states_tenant_idx" ON "onboarding_states" USING btree ("tenant_id");--> statement-breakpoint
CREATE POLICY "onboarding_states_tenant_isolation" ON "onboarding_states" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("onboarding_states"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("onboarding_states"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "onboarding_states" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT,INSERT,UPDATE,DELETE ON "onboarding_states" TO "mesa_digital_app";