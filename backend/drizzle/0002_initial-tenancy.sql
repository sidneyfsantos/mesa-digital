CREATE TABLE "restaurant_tables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"label" varchar(100) NOT NULL,
	"code" varchar(50),
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "restaurant_tables_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "restaurant_tables_label_not_blank" CHECK (btrim("restaurant_tables"."label") <> ''),
	CONSTRAINT "restaurant_tables_code_not_blank" CHECK ("restaurant_tables"."code" is null or btrim("restaurant_tables"."code") <> '')
);
--> statement-breakpoint
ALTER TABLE "restaurant_tables" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "table_qr_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"table_id" uuid NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	CONSTRAINT "table_qr_credentials_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "table_qr_credentials_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "table_qr_credentials_hash_format" CHECK ("table_qr_credentials"."token_hash" ~ '^[0-9a-f]{64}$')
);
--> statement-breakpoint
ALTER TABLE "table_qr_credentials" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "table_qr_credentials" ADD CONSTRAINT "table_qr_credentials_tenant_table_fk" FOREIGN KEY ("tenant_id","table_id") REFERENCES "public"."restaurant_tables"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "restaurant_tables_tenant_code_unique" ON "restaurant_tables" USING btree ("tenant_id","code") WHERE "restaurant_tables"."code" is not null;--> statement-breakpoint
CREATE INDEX "restaurant_tables_tenant_id_idx" ON "restaurant_tables" USING btree ("tenant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "table_qr_credentials_one_active_per_table" ON "table_qr_credentials" USING btree ("tenant_id","table_id") WHERE "table_qr_credentials"."revoked_at" is null;--> statement-breakpoint
CREATE INDEX "table_qr_credentials_tenant_table_idx" ON "table_qr_credentials" USING btree ("tenant_id","table_id");--> statement-breakpoint
CREATE POLICY "restaurant_tables_tenant_isolation" ON "restaurant_tables" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("restaurant_tables"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("restaurant_tables"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "table_qr_credentials_tenant_isolation" ON "table_qr_credentials" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("table_qr_credentials"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("table_qr_credentials"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid);--> statement-breakpoint
ALTER TABLE "restaurant_tables" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "table_qr_credentials" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "restaurant_tables", "table_qr_credentials" TO "mesa_digital_app";
--> statement-breakpoint
CREATE FUNCTION "resolve_public_table_qr"("requested_hash" varchar(64))
RETURNS TABLE ("tenant_name" varchar(160), "table_label" varchar(100))
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog
AS $$
  SELECT tenant.name, restaurant_table.label
  FROM public.table_qr_credentials AS credential
  INNER JOIN public.restaurant_tables AS restaurant_table
    ON restaurant_table.tenant_id = credential.tenant_id
   AND restaurant_table.id = credential.table_id
  INNER JOIN public.tenants AS tenant ON tenant.id = credential.tenant_id
  WHERE credential.token_hash = requested_hash
    AND credential.revoked_at IS NULL
    AND restaurant_table.active = true
    AND tenant.status = 'ACTIVE'
  LIMIT 1
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "resolve_public_table_qr"(varchar) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "resolve_public_table_qr"(varchar) TO "mesa_digital_app";
