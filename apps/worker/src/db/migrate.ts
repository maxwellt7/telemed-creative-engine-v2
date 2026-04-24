import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const sql = postgres(process.env.DATABASE_URL!, { max: 1 })
const db = drizzle(sql)

const migrationsFolder = join(__dirname, '../../drizzle')
await migrate(db, { migrationsFolder })
console.log('[migrate] Drizzle migrations complete')

// Safety block: ensure schema additions that may not have applied via Drizzle
// are always present regardless of migration state.
await sql`ALTER TABLE "persona_reviews" ADD COLUMN IF NOT EXISTS "pass_number" integer NOT NULL DEFAULT 1`
await sql`ALTER TABLE "persona_reviews" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now()`

await sql`
  CREATE TABLE IF NOT EXISTS "advertorial_designs" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "run_id" uuid NOT NULL,
    "plan_json" jsonb NOT NULL,
    "assets_json" jsonb NOT NULL,
    "color_palette_json" jsonb,
    "typography_pairing" text,
    "created_at" timestamp DEFAULT now()
  )
`
await sql`
  CREATE TABLE IF NOT EXISTS "asset_revision_state" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "run_id" uuid NOT NULL,
    "asset_id" uuid NOT NULL,
    "asset_type" text NOT NULL,
    "current_pass" integer NOT NULL DEFAULT 1,
    "last_avg_score" real,
    "status" text NOT NULL DEFAULT 'reviewing',
    "passed_at" timestamp,
    "history" jsonb NOT NULL DEFAULT '[]'::jsonb
  )
`

// FK constraints — idempotent via duplicate_object catch
await sql`
  DO $$ BEGIN
    ALTER TABLE "advertorial_designs" ADD CONSTRAINT "advertorial_designs_run_id_fk"
      FOREIGN KEY ("run_id") REFERENCES "pipeline_runs"("id");
  EXCEPTION WHEN duplicate_object THEN null;
  END $$
`
await sql`
  DO $$ BEGIN
    ALTER TABLE "asset_revision_state" ADD CONSTRAINT "asset_revision_state_run_id_fk"
      FOREIGN KEY ("run_id") REFERENCES "pipeline_runs"("id");
  EXCEPTION WHEN duplicate_object THEN null;
  END $$
`

// UNIQUE constraint on advertorial_designs.run_id
await sql`
  DO $$ BEGIN
    ALTER TABLE "advertorial_designs" ADD CONSTRAINT "advertorial_designs_run_id_unique" UNIQUE ("run_id");
  EXCEPTION WHEN duplicate_object THEN null;
  END $$
`

console.log('[migrate] Schema safety block complete')
await sql.end()
