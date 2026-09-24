CREATE TABLE "auth_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"tenant_user_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "auth_sessions_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "auth_sessions_token_hash_valid" CHECK ("auth_sessions"."token_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_item_modifiers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_item_id" uuid NOT NULL,
	"modifier_group_id" uuid NOT NULL,
	"modifier_option_id" uuid NOT NULL,
	"group_name_snapshot" varchar(100) NOT NULL,
	"option_name_snapshot" varchar(100) NOT NULL,
	"price_delta_minor" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_item_modifiers" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"status" varchar(30) DEFAULT 'ACCEPTED' NOT NULL,
	"product_name_snapshot" varchar(140) NOT NULL,
	"unit_price_minor" integer NOT NULL,
	"modifiers_total_minor" integer NOT NULL,
	"line_total_minor" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "order_items_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "order_items_quantity_valid" CHECK ("order_items"."quantity">0),
	CONSTRAINT "order_items_status_valid" CHECK ("order_items"."status" in ('ACCEPTED','IN_PREPARATION','READY','DELIVERED','CANCELLED'))
);
--> statement-breakpoint
ALTER TABLE "order_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "order_status_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"order_id" uuid NOT NULL,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "order_status_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"service_session_id" uuid NOT NULL,
	"reference" varchar(12) NOT NULL,
	"status" varchar(20) DEFAULT 'ACCEPTED' NOT NULL,
	"idempotency_key" varchar(100) NOT NULL,
	"payload_hash" varchar(64) NOT NULL,
	"total_minor" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "orders_tenant_idempotency_unique" UNIQUE("tenant_id","idempotency_key"),
	CONSTRAINT "orders_total_valid" CHECK ("orders"."total_minor">=0)
);
--> statement-breakpoint
ALTER TABLE "orders" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "outbox_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"aggregate_type" varchar(50) NOT NULL,
	"aggregate_id" uuid NOT NULL,
	"event_type" varchar(100) NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "outbox_events" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "service_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"service_point_id" uuid NOT NULL,
	"entry_credential_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'OPEN' NOT NULL,
	"opened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"closed_at" timestamp with time zone,
	CONSTRAINT "service_sessions_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "service_sessions_status_valid" CHECK ("service_sessions"."status" in ('OPEN','CHECK_REQUESTED','CLOSING','CLOSED'))
);
--> statement-breakpoint
ALTER TABLE "service_sessions" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "password_hash" varchar(255);--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_tenant_user_fk" FOREIGN KEY ("tenant_id","tenant_user_id") REFERENCES "public"."tenant_users"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_item_modifiers" ADD CONSTRAINT "order_item_modifiers_item_fk" FOREIGN KEY ("tenant_id","order_item_id") REFERENCES "public"."order_items"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_fk" FOREIGN KEY ("tenant_id","order_id") REFERENCES "public"."orders"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_status_history" ADD CONSTRAINT "order_history_order_fk" FOREIGN KEY ("tenant_id","order_id") REFERENCES "public"."orders"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_session_fk" FOREIGN KEY ("tenant_id","service_session_id") REFERENCES "public"."service_sessions"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_sessions" ADD CONSTRAINT "service_sessions_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_sessions" ADD CONSTRAINT "service_sessions_point_fk" FOREIGN KEY ("tenant_id","service_point_id") REFERENCES "public"."service_points"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "service_sessions" ADD CONSTRAINT "service_sessions_credential_fk" FOREIGN KEY ("tenant_id","entry_credential_id") REFERENCES "public"."entry_credentials"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auth_sessions_tenant_user_idx" ON "auth_sessions" USING btree ("tenant_id","tenant_user_id");--> statement-breakpoint
CREATE INDEX "outbox_unpublished_idx" ON "outbox_events" USING btree ("published_at","created_at");--> statement-breakpoint
CREATE POLICY "auth_sessions_tenant_isolation" ON "auth_sessions" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("auth_sessions"."tenant_id"=nullif(current_setting('app.current_tenant_id',true),'')::uuid) WITH CHECK ("auth_sessions"."tenant_id"=nullif(current_setting('app.current_tenant_id',true),'')::uuid);--> statement-breakpoint
CREATE POLICY "order_item_modifiers_tenant_isolation" ON "order_item_modifiers" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("order_item_modifiers"."tenant_id"=nullif(current_setting('app.current_tenant_id',true),'')::uuid) WITH CHECK ("order_item_modifiers"."tenant_id"=nullif(current_setting('app.current_tenant_id',true),'')::uuid);--> statement-breakpoint
CREATE POLICY "order_items_tenant_isolation" ON "order_items" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("order_items"."tenant_id"=nullif(current_setting('app.current_tenant_id',true),'')::uuid) WITH CHECK ("order_items"."tenant_id"=nullif(current_setting('app.current_tenant_id',true),'')::uuid);--> statement-breakpoint
CREATE POLICY "order_history_tenant_isolation" ON "order_status_history" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("order_status_history"."tenant_id"=nullif(current_setting('app.current_tenant_id',true),'')::uuid) WITH CHECK ("order_status_history"."tenant_id"=nullif(current_setting('app.current_tenant_id',true),'')::uuid);--> statement-breakpoint
CREATE POLICY "orders_tenant_isolation" ON "orders" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("orders"."tenant_id"=nullif(current_setting('app.current_tenant_id',true),'')::uuid) WITH CHECK ("orders"."tenant_id"=nullif(current_setting('app.current_tenant_id',true),'')::uuid);--> statement-breakpoint
CREATE POLICY "outbox_tenant_isolation" ON "outbox_events" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("outbox_events"."tenant_id"=nullif(current_setting('app.current_tenant_id',true),'')::uuid) WITH CHECK ("outbox_events"."tenant_id"=nullif(current_setting('app.current_tenant_id',true),'')::uuid);--> statement-breakpoint
CREATE POLICY "service_sessions_tenant_isolation" ON "service_sessions" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("service_sessions"."tenant_id"=nullif(current_setting('app.current_tenant_id',true),'')::uuid) WITH CHECK ("service_sessions"."tenant_id"=nullif(current_setting('app.current_tenant_id',true),'')::uuid);
--> statement-breakpoint
ALTER TABLE "auth_sessions" FORCE ROW LEVEL SECURITY; ALTER TABLE "service_sessions" FORCE ROW LEVEL SECURITY; ALTER TABLE "orders" FORCE ROW LEVEL SECURITY; ALTER TABLE "order_items" FORCE ROW LEVEL SECURITY; ALTER TABLE "order_item_modifiers" FORCE ROW LEVEL SECURITY; ALTER TABLE "order_status_history" FORCE ROW LEVEL SECURITY; ALTER TABLE "outbox_events" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT,INSERT,UPDATE,DELETE ON "auth_sessions","service_sessions","orders","order_items","order_item_modifiers","order_status_history","outbox_events" TO "mesa_digital_app";
--> statement-breakpoint
CREATE UNIQUE INDEX "service_sessions_one_active_point" ON "service_sessions" ("tenant_id","service_point_id") WHERE status IN ('OPEN','CHECK_REQUESTED','CLOSING');
--> statement-breakpoint
DROP FUNCTION "resolve_public_catalog_scope"(varchar);
--> statement-breakpoint
CREATE FUNCTION "resolve_public_catalog_scope"("requested_hash" varchar(64)) RETURNS TABLE ("tenant_id" uuid,"tenant_name" varchar(160),"credential_id" uuid,"service_point_id" uuid,"service_point_kind" varchar(30),"service_point_label" varchar(100)) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT c.tenant_id,t.name,c.id,p.id,p.kind,p.label FROM public.entry_credentials c JOIN public.service_points p ON p.tenant_id=c.tenant_id AND p.id=c.service_point_id JOIN public.tenant_entry_modes m ON m.tenant_id=p.tenant_id AND m.service_point_kind=p.kind JOIN public.tenants t ON t.id=c.tenant_id WHERE c.token_hash=requested_hash AND c.kind='QR' AND c.revoked_at IS NULL AND p.active=true AND t.status='ACTIVE' LIMIT 1 $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "resolve_public_catalog_scope"(varchar) FROM PUBLIC; GRANT EXECUTE ON FUNCTION "resolve_public_catalog_scope"(varchar) TO "mesa_digital_app";
--> statement-breakpoint
CREATE FUNCTION "resolve_login_identity"("requested_email" varchar,"requested_slug" varchar) RETURNS TABLE("user_id" uuid,"tenant_id" uuid,"tenant_user_id" uuid,"password_hash" varchar) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT u.id,t.id,tu.id,u.password_hash FROM public.users u JOIN public.tenant_users tu ON tu.user_id=u.id JOIN public.tenants t ON t.id=tu.tenant_id WHERE u.email=requested_email AND t.slug=requested_slug AND u.status='ACTIVE' AND tu.status='ACTIVE' AND t.status='ACTIVE' LIMIT 1 $$;
--> statement-breakpoint
CREATE FUNCTION "resolve_auth_principal"("requested_hash" varchar) RETURNS TABLE("user_id" uuid,"tenant_id" uuid,"tenant_user_id" uuid,"capabilities" text[]) LANGUAGE sql STABLE SECURITY DEFINER SET search_path=pg_catalog AS $$ SELECT s.user_id,s.tenant_id,s.tenant_user_id,coalesce(array_agg(DISTINCT c.key) FILTER (WHERE c.key IS NOT NULL),'{}') FROM public.auth_sessions s LEFT JOIN public.tenant_user_roles tur ON tur.tenant_id=s.tenant_id AND tur.tenant_user_id=s.tenant_user_id LEFT JOIN public.role_capabilities rc ON rc.tenant_id=tur.tenant_id AND rc.role_id=tur.role_id LEFT JOIN public.capabilities c ON c.id=rc.capability_id JOIN public.users u ON u.id=s.user_id JOIN public.tenant_users tu ON tu.tenant_id=s.tenant_id AND tu.id=s.tenant_user_id JOIN public.tenants t ON t.id=s.tenant_id WHERE s.token_hash=requested_hash AND s.revoked_at IS NULL AND s.expires_at>now() AND u.status='ACTIVE' AND tu.status='ACTIVE' AND t.status='ACTIVE' GROUP BY s.user_id,s.tenant_id,s.tenant_user_id LIMIT 1 $$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "resolve_login_identity"(varchar,varchar),"resolve_auth_principal"(varchar) FROM PUBLIC; GRANT EXECUTE ON FUNCTION "resolve_login_identity"(varchar,varchar),"resolve_auth_principal"(varchar) TO "mesa_digital_app";
