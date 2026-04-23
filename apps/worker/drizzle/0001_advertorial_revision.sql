ALTER TABLE "persona_reviews" ADD COLUMN IF NOT EXISTS "pass_number" integer NOT NULL DEFAULT 1;--> statement-breakpoint
ALTER TABLE "persona_reviews" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now();--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "advertorial_designs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL UNIQUE,
	"plan_json" jsonb NOT NULL,
	"assets_json" jsonb NOT NULL,
	"color_palette_json" jsonb,
	"typography_pairing" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "asset_revision_state" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"asset_type" text NOT NULL,
	"current_pass" integer NOT NULL DEFAULT 1,
	"last_avg_score" real,
	"status" text NOT NULL DEFAULT 'reviewing',
	"passed_at" timestamp,
	"history" jsonb NOT NULL DEFAULT '[]'
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "advertorial_designs" ADD CONSTRAINT "advertorial_designs_run_id_pipeline_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "asset_revision_state" ADD CONSTRAINT "asset_revision_state_run_id_pipeline_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "advertorial_designs_run_id_idx" ON "advertorial_designs" ("run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "asset_revision_state_run_asset_idx" ON "asset_revision_state" ("run_id", "asset_id");
