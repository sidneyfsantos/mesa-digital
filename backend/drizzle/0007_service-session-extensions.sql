CREATE TABLE "bill_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"service_session_id" uuid NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"withdrawn_at" timestamp with time zone,
	"withdrawn_by" uuid,
	CONSTRAINT "bill_requests_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "bill_requests_session_active_unique" UNIQUE("tenant_id","service_session_id")
);
--> statement-breakpoint
ALTER TABLE "bill_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "cancellation_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"reason" varchar(500) NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"requested_by" uuid NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" varchar(500),
	CONSTRAINT "cancellation_requests_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "cancellation_requests_item_pending_unique" UNIQUE("tenant_id","order_item_id"),
	CONSTRAINT "cancellation_requests_status_valid" CHECK ("cancellation_requests"."status" in ('PENDING','APPROVED','REJECTED'))
);
--> statement-breakpoint
ALTER TABLE "cancellation_requests" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "service_calls" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"service_session_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'PENDING' NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolved_by" uuid,
	CONSTRAINT "service_calls_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "service_calls_status_valid" CHECK ("service_calls"."status" in ('PENDING','RESOLVED'))
);
--> statement-breakpoint
ALTER TABLE "service_calls" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "service_session_totals" (
	"tenant_id" uuid NOT NULL,
	"service_session_id" uuid NOT NULL,
	"original_total_minor" integer DEFAULT 0 NOT NULL,
	"cancelled_total_minor" integer DEFAULT 0 NOT NULL,
	"discount_total_minor" integer DEFAULT 0 NOT NULL,
	"additional_service_total_minor" integer DEFAULT 0 NOT NULL,
	"effective_total_minor" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "service_session_totals_pk" PRIMARY KEY("tenant_id","service_session_id")
);
--> statement-breakpoint
ALTER TABLE "service_session_totals" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "bill_requests" ADD CONSTRAINT "bill_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bill_requests" ADD CONSTRAINT "bill_requests_session_fk" FOREIGN KEY ("tenant_id","service_session_id") REFERENCES "public"."service_sessions"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_requests" ADD CONSTRAINT "cancellation_requests_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cancellation_requests" ADD CONSTRAINT "cancellation_requests_item_fk" FOREIGN KEY ("tenant_id","order_item_id") REFERENCES "public"."order_items"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_calls" ADD CONSTRAINT "service_calls_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_calls" ADD CONSTRAINT "service_calls_session_fk" FOREIGN KEY ("tenant_id","service_session_id") REFERENCES "public"."service_sessions"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_session_totals" ADD CONSTRAINT "service_session_totals_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_session_totals" ADD CONSTRAINT "service_session_totals_session_fk" FOREIGN KEY ("tenant_id","service_session_id") REFERENCES "public"."service_sessions"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bill_requests_session_idx" ON "bill_requests" USING btree ("service_session_id");--> statement-breakpoint
CREATE INDEX "service_calls_session_idx" ON "service_calls" USING btree ("service_session_id");--> statement-breakpoint
CREATE POLICY "bill_requests_tenant_isolation" ON "bill_requests" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("bill_requests"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("bill_requests"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "cancellation_requests_tenant_isolation" ON "cancellation_requests" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("cancellation_requests"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("cancellation_requests"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "service_calls_tenant_isolation" ON "service_calls" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("service_calls"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("service_calls"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "service_session_totals_tenant_isolation" ON "service_session_totals" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("service_session_totals"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("service_session_totals"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "bill_requests" FORCE ROW LEVEL SECURITY; ALTER TABLE "cancellation_requests" FORCE ROW LEVEL SECURITY; ALTER TABLE "service_calls" FORCE ROW LEVEL SECURITY; ALTER TABLE "service_session_totals" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT,INSERT,UPDATE,DELETE ON "bill_requests","cancellation_requests","service_calls","service_session_totals" TO "mesa_digital_app";