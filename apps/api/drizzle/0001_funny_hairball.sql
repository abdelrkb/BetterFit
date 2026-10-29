CREATE TABLE "food_prices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid,
	"label" text NOT NULL,
	"store" text DEFAULT '' NOT NULL,
	"price_cents" integer NOT NULL,
	"unit" text DEFAULT '' NOT NULL,
	"source" text DEFAULT 'manual' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meal_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"food_id" uuid,
	"label" text DEFAULT '' NOT NULL,
	"quantity" text DEFAULT '' NOT NULL,
	"quantity_g" real,
	"alternative" text DEFAULT '' NOT NULL,
	"kcal" integer,
	"protein_g" real,
	"carbs_g" real,
	"fat_g" real
);
--> statement-breakpoint
CREATE TABLE "meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"name" text NOT NULL,
	"time" text DEFAULT '' NOT NULL,
	"kcal_override" integer
);
--> statement-breakpoint
CREATE TABLE "nutrition_details" (
	"program_id" uuid PRIMARY KEY NOT NULL,
	"sex" "sex" NOT NULL,
	"age" smallint NOT NULL,
	"weight_kg" real NOT NULL,
	"height_cm" smallint NOT NULL,
	"activity_level" "activity_level" NOT NULL,
	"deficit_kcal" integer DEFAULT 400 NOT NULL,
	"protein_g_per_kg" real DEFAULT 2 NOT NULL,
	"fat_g_per_kg" real DEFAULT 0.9 NOT NULL,
	"fiber_g" smallint DEFAULT 30 NOT NULL,
	"water_liters" real,
	"goal_title" text DEFAULT '' NOT NULL,
	"goal_text" text DEFAULT '' NOT NULL,
	"preferred" text[] DEFAULT '{}' NOT NULL,
	"limited" text[] DEFAULT '{}' NOT NULL,
	"coach_note" text DEFAULT '' NOT NULL,
	"shopping_days" smallint DEFAULT 7 NOT NULL,
	"budget_cents" integer
);
--> statement-breakpoint
CREATE TABLE "program_recipes" (
	"program_id" uuid NOT NULL,
	"recipe_id" uuid NOT NULL,
	"position" smallint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipe_ingredients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"food_id" uuid,
	"label" text DEFAULT '' NOT NULL,
	"quantity" text DEFAULT '' NOT NULL,
	"quantity_g" real
);
--> statement-breakpoint
CREATE TABLE "recipe_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipe_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"text" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recipes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" uuid NOT NULL,
	"title" text NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"prep_minutes" smallint,
	"cook_minutes" smallint,
	"servings" smallint DEFAULT 1 NOT NULL,
	"kcal" integer,
	"protein_g" real,
	"carbs_g" real,
	"fat_g" real,
	"photo_path" text,
	"tip" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_categories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"program_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shopping_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category_id" uuid NOT NULL,
	"position" smallint NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"quantity" text DEFAULT '' NOT NULL,
	"checked" boolean DEFAULT false NOT NULL,
	"price_cents" integer,
	"store" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE "food_prices" ADD CONSTRAINT "food_prices_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_items" ADD CONSTRAINT "meal_items_meal_id_meals_id_fk" FOREIGN KEY ("meal_id") REFERENCES "public"."meals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_details" ADD CONSTRAINT "nutrition_details_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_recipes" ADD CONSTRAINT "program_recipes_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "program_recipes" ADD CONSTRAINT "program_recipes_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_ingredients" ADD CONSTRAINT "recipe_ingredients_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipe_steps" ADD CONSTRAINT "recipe_steps_recipe_id_recipes_id_fk" FOREIGN KEY ("recipe_id") REFERENCES "public"."recipes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recipes" ADD CONSTRAINT "recipes_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_categories" ADD CONSTRAINT "shopping_categories_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shopping_items" ADD CONSTRAINT "shopping_items_category_id_shopping_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."shopping_categories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "food_prices_owner_label_store_unique" ON "food_prices" USING btree ("owner_id","label","store");--> statement-breakpoint
CREATE INDEX "food_prices_label_idx" ON "food_prices" USING btree ("label");--> statement-breakpoint
CREATE INDEX "meal_items_meal_idx" ON "meal_items" USING btree ("meal_id");--> statement-breakpoint
CREATE INDEX "meals_program_idx" ON "meals" USING btree ("program_id");--> statement-breakpoint
CREATE UNIQUE INDEX "program_recipes_unique" ON "program_recipes" USING btree ("program_id","recipe_id");--> statement-breakpoint
CREATE INDEX "program_recipes_program_idx" ON "program_recipes" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "recipe_ingredients_recipe_idx" ON "recipe_ingredients" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipe_steps_recipe_idx" ON "recipe_steps" USING btree ("recipe_id");--> statement-breakpoint
CREATE INDEX "recipes_owner_idx" ON "recipes" USING btree ("owner_id");--> statement-breakpoint
CREATE INDEX "shopping_categories_program_idx" ON "shopping_categories" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "shopping_items_category_idx" ON "shopping_items" USING btree ("category_id");