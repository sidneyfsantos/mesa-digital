DROP FUNCTION IF EXISTS "resolve_public_table_qr"(varchar);
--> statement-breakpoint
ALTER TABLE "restaurant_tables" RENAME TO "service_points";
--> statement-breakpoint
ALTER TABLE "service_points" ADD COLUMN "kind" varchar(30) DEFAULT 'FIXED_TABLE' NOT NULL;
--> statement-breakpoint
ALTER TABLE "service_points" ALTER COLUMN "kind" DROP DEFAULT;
--> statement-breakpoint
ALTER TABLE "service_points" RENAME CONSTRAINT "restaurant_tables_tenant_id_id_unique" TO "service_points_tenant_id_id_unique";
--> statement-breakpoint
ALTER TABLE "service_points" RENAME CONSTRAINT "restaurant_tables_label_not_blank" TO "service_points_label_not_blank";
--> statement-breakpoint
ALTER TABLE "service_points" RENAME CONSTRAINT "restaurant_tables_code_not_blank" TO "service_points_code_not_blank";
--> statement-breakpoint
ALTER TABLE "service_points" RENAME CONSTRAINT "restaurant_tables_tenant_id_tenants_id_fk" TO "service_points_tenant_id_tenants_id_fk";
--> statement-breakpoint
ALTER INDEX "restaurant_tables_tenant_code_unique" RENAME TO "service_points_tenant_code_unique";
--> statement-breakpoint
DROP INDEX "restaurant_tables_tenant_id_idx";
--> statement-breakpoint
CREATE INDEX "service_points_tenant_id_kind_idx" ON "service_points" USING btree ("tenant_id", "kind");
--> statement-breakpoint
ALTER TABLE "service_points" ADD CONSTRAINT "service_points_kind_valid" CHECK ("service_points"."kind" in ('FIXED_TABLE', 'MOBILE_TAB'));
--> statement-breakpoint
ALTER POLICY "restaurant_tables_tenant_isolation" ON "service_points" RENAME TO "service_points_tenant_isolation";
--> statement-breakpoint
ALTER TABLE "table_qr_credentials" RENAME TO "entry_credentials";
--> statement-breakpoint
ALTER TABLE "entry_credentials" RENAME COLUMN "table_id" TO "service_point_id";
--> statement-breakpoint
ALTER TABLE "entry_credentials" ADD COLUMN "kind" varchar(20) DEFAULT 'QR' NOT NULL;
--> statement-breakpoint
ALTER TABLE "entry_credentials" RENAME CONSTRAINT "table_qr_credentials_token_hash_unique" TO "entry_credentials_token_hash_unique";
--> statement-breakpoint
ALTER TABLE "entry_credentials" RENAME CONSTRAINT "table_qr_credentials_tenant_id_id_unique" TO "entry_credentials_tenant_id_id_unique";
--> statement-breakpoint
ALTER TABLE "entry_credentials" RENAME CONSTRAINT "table_qr_credentials_hash_format" TO "entry_credentials_hash_format";
--> statement-breakpoint
ALTER TABLE "entry_credentials" RENAME CONSTRAINT "table_qr_credentials_tenant_table_fk" TO "entry_credentials_tenant_service_point_fk";
--> statement-breakpoint
DROP INDEX "table_qr_credentials_one_active_per_table";
--> statement-breakpoint
CREATE UNIQUE INDEX "entry_credentials_one_active_qr_per_service_point" ON "entry_credentials" USING btree ("tenant_id", "service_point_id", "kind") WHERE "entry_credentials"."revoked_at" is null;
--> statement-breakpoint
ALTER INDEX "table_qr_credentials_tenant_table_idx" RENAME TO "entry_credentials_tenant_service_point_idx";
--> statement-breakpoint
ALTER TABLE "entry_credentials" ADD CONSTRAINT "entry_credentials_kind_valid" CHECK ("entry_credentials"."kind" = 'QR');
--> statement-breakpoint
ALTER POLICY "table_qr_credentials_tenant_isolation" ON "entry_credentials" RENAME TO "entry_credentials_tenant_isolation";
--> statement-breakpoint
CREATE TABLE "tenant_entry_modes" (
  "tenant_id" uuid NOT NULL,
  "service_point_kind" varchar(30) NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "tenant_entry_modes_tenant_kind_pk" PRIMARY KEY("tenant_id", "service_point_kind"),
  CONSTRAINT "tenant_entry_modes_kind_valid" CHECK ("tenant_entry_modes"."service_point_kind" in ('FIXED_TABLE', 'MOBILE_TAB')),
  CONSTRAINT "tenant_entry_modes_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict
);
--> statement-breakpoint
INSERT INTO "tenant_entry_modes" ("tenant_id", "service_point_kind") SELECT "id", 'FIXED_TABLE' FROM "tenants" ON CONFLICT DO NOTHING;
--> statement-breakpoint
ALTER TABLE "tenant_entry_modes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "tenant_entry_modes_tenant_isolation" ON "tenant_entry_modes" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("tenant_entry_modes"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("tenant_entry_modes"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "tenant_entry_modes" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "tenant_entry_modes" TO "mesa_digital_app";
--> statement-breakpoint
UPDATE "capabilities" SET "key" = 'service_point.read', "description" = 'Read service points and entry modes' WHERE "key" = 'table.read';
--> statement-breakpoint
UPDATE "capabilities" SET "key" = 'service_point.manage', "description" = 'Manage service points and entry modes' WHERE "key" = 'table.manage';
--> statement-breakpoint
CREATE FUNCTION "resolve_public_entry_qr"("requested_hash" varchar(64))
RETURNS TABLE ("tenant_name" varchar(160), "service_point_kind" varchar(30), "service_point_label" varchar(100))
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$
  SELECT tenant.name, service_point.kind, service_point.label
  FROM public.entry_credentials AS credential
  INNER JOIN public.service_points AS service_point ON service_point.tenant_id = credential.tenant_id AND service_point.id = credential.service_point_id
  INNER JOIN public.tenant_entry_modes AS entry_mode ON entry_mode.tenant_id = service_point.tenant_id AND entry_mode.service_point_kind = service_point.kind
  INNER JOIN public.tenants AS tenant ON tenant.id = credential.tenant_id
  WHERE credential.token_hash = requested_hash AND credential.kind = 'QR' AND credential.revoked_at IS NULL AND service_point.active = true AND tenant.status = 'ACTIVE'
  LIMIT 1
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "resolve_public_entry_qr"(varchar) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION "resolve_public_entry_qr"(varchar) TO "mesa_digital_app";
