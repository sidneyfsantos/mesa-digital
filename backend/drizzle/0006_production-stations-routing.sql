CREATE TABLE "product_routing" (
	"tenant_id" uuid NOT NULL,
	"product_id" uuid NOT NULL,
	"station_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "product_routing_pk" PRIMARY KEY("tenant_id","product_id")
);
--> statement-breakpoint
ALTER TABLE "product_routing" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE TABLE "production_stations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"kind" varchar(30) NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "production_stations_tenant_id_id_unique" UNIQUE("tenant_id","id"),
	CONSTRAINT "production_stations_name_not_blank" CHECK (btrim("production_stations"."name") <> ''),
	CONSTRAINT "production_stations_order_valid" CHECK ("production_stations"."sort_order" >= 0)
);
--> statement-breakpoint
ALTER TABLE "production_stations" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "station_id" uuid;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "started_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "ready_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "order_items" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "product_routing" ADD CONSTRAINT "product_routing_product_fk" FOREIGN KEY ("tenant_id","product_id") REFERENCES "public"."catalog_products"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_routing" ADD CONSTRAINT "product_routing_station_fk" FOREIGN KEY ("tenant_id","station_id") REFERENCES "public"."production_stations"("tenant_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "production_stations" ADD CONSTRAINT "production_stations_tenant_id_tenants_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "product_routing_tenant_station_idx" ON "product_routing" USING btree ("tenant_id","station_id");--> statement-breakpoint
CREATE INDEX "production_stations_tenant_kind_idx" ON "production_stations" USING btree ("tenant_id","kind");--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_station_fk" FOREIGN KEY ("tenant_id","station_id") REFERENCES "public"."production_stations"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "product_routing_tenant_isolation" ON "product_routing" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("product_routing"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("product_routing"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid);--> statement-breakpoint
CREATE POLICY "production_stations_tenant_isolation" ON "production_stations" AS PERMISSIVE FOR ALL TO "mesa_digital_app" USING ("production_stations"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid) WITH CHECK ("production_stations"."tenant_id" = nullif(current_setting('app.current_tenant_id', true), '')::uuid);
--> statement-breakpoint
ALTER TABLE "product_routing" FORCE ROW LEVEL SECURITY; ALTER TABLE "production_stations" FORCE ROW LEVEL SECURITY;
--> statement-breakpoint
GRANT SELECT,INSERT,UPDATE,DELETE ON "product_routing","production_stations" TO "mesa_digital_app";