CREATE TABLE IF NOT EXISTS "clickup_deliverables" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"list" text NOT NULL,
	"task_id" text NOT NULL,
	"task_url" text NOT NULL,
	"delivered_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "copy_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"type" text NOT NULL,
	"content" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"score" real,
	"status" text DEFAULT 'draft' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "creative_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"type" text NOT NULL,
	"fal_job_id" text,
	"storage_url" text,
	"format" text,
	"score" real,
	"status" text DEFAULT 'generating' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "funnel_pages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"html_content" text NOT NULL,
	"vercel_deployment_id" text,
	"vercel_url" text,
	"status" text DEFAULT 'pending' NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "offer_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"offer_analysis_json" jsonb NOT NULL,
	"avatar_json" jsonb NOT NULL,
	"beliefs_json" jsonb NOT NULL,
	"manifold_json" jsonb NOT NULL,
	"launch_doc_json" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "persona_reviews" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"persona_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"asset_type" text NOT NULL,
	"score" real NOT NULL,
	"sentiment" text NOT NULL,
	"objection" text NOT NULL,
	"suggested_edit" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "personas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"archetype" text NOT NULL,
	"demographics_json" jsonb NOT NULL,
	"psychographics_json" jsonb NOT NULL,
	"primary_fear" text NOT NULL,
	"primary_currency" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "pipeline_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"current_stage" text DEFAULT 'INTAKE' NOT NULL,
	"revision_pass" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"created_by" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"target_market" text NOT NULL,
	"brief" text NOT NULL,
	"vertical" text DEFAULT 'telemedicine' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "research_artifacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"type" text NOT NULL,
	"url" text NOT NULL,
	"title" text NOT NULL,
	"traffic_score" real,
	"raw_content" text,
	"analysis_json" jsonb
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "reverse_briefs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"source_url" text NOT NULL,
	"line_analysis_json" jsonb NOT NULL,
	"brief_json" jsonb NOT NULL,
	"concepts_json" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "stage_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"stage" text NOT NULL,
	"level" text DEFAULT 'info' NOT NULL,
	"message" text NOT NULL,
	"metadata_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "clickup_deliverables" ADD CONSTRAINT "clickup_deliverables_run_id_pipeline_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "copy_assets" ADD CONSTRAINT "copy_assets_run_id_pipeline_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "creative_assets" ADD CONSTRAINT "creative_assets_run_id_pipeline_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "funnel_pages" ADD CONSTRAINT "funnel_pages_run_id_pipeline_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "offer_profiles" ADD CONSTRAINT "offer_profiles_run_id_pipeline_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "persona_reviews" ADD CONSTRAINT "persona_reviews_run_id_pipeline_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "persona_reviews" ADD CONSTRAINT "persona_reviews_persona_id_personas_id_fk" FOREIGN KEY ("persona_id") REFERENCES "public"."personas"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "pipeline_runs" ADD CONSTRAINT "pipeline_runs_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "research_artifacts" ADD CONSTRAINT "research_artifacts_run_id_pipeline_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "reverse_briefs" ADD CONSTRAINT "reverse_briefs_run_id_pipeline_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "stage_logs" ADD CONSTRAINT "stage_logs_run_id_pipeline_runs_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "copy_assets_run_id_idx" ON "copy_assets" ("run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "creative_assets_run_id_idx" ON "creative_assets" ("run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "persona_reviews_run_id_idx" ON "persona_reviews" ("run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "persona_reviews_asset_id_idx" ON "persona_reviews" ("asset_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "pipeline_runs_product_id_idx" ON "pipeline_runs" ("product_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "research_artifacts_run_id_idx" ON "research_artifacts" ("run_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "stage_logs_run_id_idx" ON "stage_logs" ("run_id");