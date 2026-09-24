CREATE TABLE "catalog_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_categories_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "catalog_categories_name_not_blank" CHECK (btrim("catalog_categories"."name") <> ''),
	CONSTRAINT "catalog_categories_order_valid" CHECK ("catalog_categories"."sort_order" >= 0)
);
--> statement-breakpoint
ALTER TABLE "catalog_categories" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "catalog_products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"category_id" uuid NOT NULL,
	"name" varchar(140) NOT NULL,
	"description" text,
	"price_minor" integer NOT NULL,
	"currency" varchar(3) DEFAULT 'BRL' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "catalog_products_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "catalog_products_name_not_blank" CHECK (btrim("catalog_products"."name") <> ''),
	CONSTRAINT "catalog_products_price_valid" CHECK ("catalog_products"."price_minor" >= 0),
	CONSTRAINT "catalog_products_currency_valid" CHECK ("catalog_products"."currency" = 'BRL'),
	CONSTRAINT "catalog_products_order_valid" CHECK ("catalog_products"."sort_order" >= 0)
);
--> statement-breakpoint
ALTER TABLE "catalog_products" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"storage_provider" varchar(30) DEFAULT 'LOCAL' NOT NULL,
	"storage_key" varchar(240) NOT NULL,
	"mime_type" varchar(80) NOT NULL,
	"size_bytes" integer NOT NULL,
	"width" integer,
	"height" integer,
	"alt_text" varchar(180),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_assets_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "media_assets_storage_key_unique" UNIQUE("storage_key"),
	CONSTRAINT "media_assets_size_valid" CHECK ("media_assets"."size_bytes" > 0 and "media_assets"."size_bytes" <= 5242880),
	CONSTRAINT "media_assets_mime_valid" CHECK ("media_assets"."mime_type" in ('image/jpeg','image/png','image/webp'))
);
--> statement-breakpoint
ALTER TABLE "media_assets" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "modifier_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"required" boolean DEFAULT false NOT NULL,
	"min_selections" integer DEFAULT 0 NOT NULL,
	"max_selections" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "modifier_groups_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "modifier_groups_name_not_blank" CHECK (btrim("modifier_groups"."name") <> ''),
	CONSTRAINT "modifier_groups_selections_valid" CHECK ("modifier_groups"."min_selections" >= 0 and "modifier_groups"."max_selections" >= 1 and "modifier_groups"."min_selections" <= "modifier_groups"."max_selections"),
	CONSTRAINT "modifier_groups_required_valid" CHECK (("modifier_groups"."required" = false) or ("modifier_groups"."min_selections" >= 1))
);
--> statement-breakpoint
ALTER TABLE "modifier_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "modifier_options" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"group_id" uuid NOT NULL,
	"name" varchar(100) NOT NULL,
	"price_delta_minor" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "modifier_options_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "modifier_options_name_not_blank" CHECK (btrim("modifier_options"."name") <> ''),
	CONSTRAINT "modifier_options_price_valid" CHECK ("modifier_options"."price_delta_minor" >= 0)
);
--> statement-breakpoint
ALTER TABLE "modifier_options" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_media" (
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"media_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_media_pk" PRIMARY KEY("tenant_id","product_id","media_id")
);
--> statement-breakpoint
ALTER TABLE "product_media" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "product_modifier_groups" (
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"modifier_group_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_modifier_groups_pk" PRIMARY KEY("tenant_id","product_id","modifier_group_id")
);
--> statement-breakpoint
ALTER TABLE "product_modifier_groups" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "tenant_branding" (
	"tenant_id" uuid PRIMARY KEY NOT NULL,
	"display_name" varchar(160) NOT NULL,
	"primary_color" varchar(7) DEFAULT '#C2410C' NOT NULL,
	"logo_media_id" uuid,
	"cover_media_id" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tenant_branding_name_not_blank" CHECK (btrim("tenant_branding"."display_name") <> ''),
	CONSTRAINT "tenant_branding_color_valid" CHECK ("tenant_branding"."primary_color" ~ '^#[0-9A-F]{6}$')
);
--> statement-breakpoint
ALTER TABLE "tenant_branding" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "catalog_categories" ADD CONSTRAINT "catalog_categories_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog_products" ADD CONSTRAINT "catalog_products_tenant_category_fk" FOREIGN KEY ("tenant_id","category_id") REFERENCES "public"."catalog_categories"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifier_groups" ADD CONSTRAINT "modifier_groups_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "modifier_options" ADD CONSTRAINT "modifier_options_tenant_group_fk" FOREIGN KEY ("tenant_id","group_id") REFERENCES "public"."modifier_groups"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_product_fk" FOREIGN KEY ("tenant_id","product_id") REFERENCES "public"."catalog_products"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_asset_fk" FOREIGN KEY ("tenant_id","media_id") REFERENCES "public"."media_assets"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_modifier_groups" ADD CONSTRAINT "product_modifier_groups_product_fk" FOREIGN KEY ("tenant_id","product_id") REFERENCES "public"."catalog_products"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_modifier_groups" ADD CONSTRAINT "product_modifier_groups_group_fk" FOREIGN KEY ("tenant_id","modifier_group_id") REFERENCES "public"."modifier_groups"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_branding" ADD CONSTRAINT "tenant_branding_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_branding" ADD CONSTRAINT "tenant_branding_logo_fk" FOREIGN KEY ("tenant_id","logo_media_id") REFERENCES "public"."media_assets"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_branding" ADD CONSTRAINT "tenant_branding_cover_fk" FOREIGN KEY ("tenant_id","cover_media_id") REFERENCES "public"."media_assets"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "catalog_categories_tenant_order_idx" ON "catalog_categories" USING btree ("tenant_id","sort_order","id");--> statement-breakpoint
CREATE INDEX "catalog_products_tenant_category_order_idx" ON "catalog_products" USING btree ("tenant_id","category_id","sort_order","id");--> statement-breakpoint
CREATE INDEX "modifier_groups_tenant_order_idx" ON "modifier_groups" USING btree ("tenant_id","sort_order","id");--> statement-breakpoint
CREATE INDEX "modifier_options_tenant_group_order_idx" ON "modifier_options" USING btree ("tenant_id","group_id","sort_order","id");--> statement-breakpoint
CREATE INDEX "product_media_tenant_product_order_idx" ON "product_media" USING btree ("tenant_id","product_id","sort_order");--> statement-breakpoint
CREATE INDEX "product_modifier_groups_tenant_product_order_idx" ON "product_modifier_groups" USING btree ("tenant_id","product_id","sort_order");--> statement-breakpoint
CREATE POLICY "catalog_categories_tenant_isolation" ON "catalog_categories" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("catalog_categories"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("catalog_categories"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "catalog_products_tenant_isolation" ON "catalog_products" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("catalog_products"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("catalog_products"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "media_assets_tenant_isolation" ON "media_assets" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("media_assets"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("media_assets"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "modifier_groups_tenant_isolation" ON "modifier_groups" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("modifier_groups"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("modifier_groups"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "modifier_options_tenant_isolation" ON "modifier_options" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("modifier_options"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("modifier_options"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "product_media_tenant_isolation" ON "product_media" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("product_media"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("product_media"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "product_modifier_groups_tenant_isolation" ON "product_modifier_groups" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("product_modifier_groups"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("product_modifier_groups"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "tenant_branding_tenant_isolation" ON "tenant_branding" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("tenant_branding"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("tenant_branding"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "catalog_categories" FORCE ROW LEVEL SECURITY;
ALTER TABLE "catalog_products" FORCE ROW LEVEL SECURITY;
ALTER TABLE "media_assets" FORCE ROW LEVEL SECURITY;
ALTER TABLE "modifier_groups" FORCE ROW LEVEL SECURITY;
ALTER TABLE "modifier_options" FORCE ROW LEVEL SECURITY;
ALTER TABLE "product_media" FORCE ROW LEVEL SECURITY;
ALTER TABLE "product_modifier_groups" FORCE ROW LEVEL SECURITY;
ALTER TABLE "tenant_branding" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "catalog_categories", "catalog_products", "media_assets", "modifier_groups", "modifier_options", "product_media", "product_modifier_groups", "tenant_branding" TO "mesa_digital_app";
--> statement-breakpoint
CREATE FUNCTION "resolve_public_catalog_scope"("requested_hash" varchar(64))
RETURNS TABLE ("tenant_id" uuid, "tenant_name" varchar(160), "service_point_kind" varchar(30), "service_point_label" varchar(100))
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
AS $$
  SELECT credential.tenant_id, tenant.name, service_point.kind, service_point.label
  FROM public.entry_credentials AS credential
  INNER JOIN public.service_points AS service_point ON service_point.tenant_id = credential.tenant_id AND service_point.id = credential.service_point_id
  INNER JOIN public.tenant_entry_modes AS entry_mode ON entry_mode.tenant_id = service_point.tenant_id AND entry_mode.service_point_kind = service_point.kind
  INNER JOIN public.tenants AS tenant ON tenant.id = credential.tenant_id
  WHERE credential.token_hash = requested_hash AND credential.kind = 'QR' AND credential.revoked_at IS NULL AND service_point.active = true AND tenant.status = 'ACTIVE'
  LIMIT 1
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION "resolve_public_catalog_scope"(varchar) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION "resolve_public_catalog_scope"(varchar) TO "mesa_digital_app";
