CREATE TYPE "public"."food_source" AS ENUM('ciqual', 'off', 'custom');--> statement-breakpoint
CREATE TABLE "foods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" "food_source" NOT NULL,
	"owner_id" uuid,
	"external_id" text,
	"barcode" text,
	"name" text NOT NULL,
	"brand" text DEFAULT '' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"kcal" real,
	"protein_g" real,
	"carbs_g" real,
	"sugars_g" real,
	"fat_g" real,
	"saturated_fat_g" real,
	"fiber_g" real,
	"salt_g" real,
	"serving_label" text DEFAULT '' NOT NULL,
	"serving_g" real,
	"search_text" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "foods" ADD CONSTRAINT "foods_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "foods_source_external_unique" ON "foods" USING btree ("source","external_id");--> statement-breakpoint
CREATE INDEX "foods_owner_idx" ON "foods" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "foods_barcode_idx" ON "foods" USING btree ("barcode");--> statement-breakpoint
-- Recherche d'aliments tolérante aux fautes de frappe, comme pour les
-- exercices. L'index trigramme est écrit à la main : Drizzle ne génère pas
-- les index GIN avec classe d'opérateurs.
CREATE INDEX IF NOT EXISTS "foods_search_trgm_idx" ON "foods" USING gin ("search_text" gin_trgm_ops);
