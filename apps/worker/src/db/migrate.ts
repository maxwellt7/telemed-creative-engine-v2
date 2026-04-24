import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

const sql = postgres(process.env.DATABASE_URL!, { max: 1 })
const db = drizzle(sql)

const migrationsFolder = join(__dirname, '../../drizzle')

console.log('[migrate] Starting Drizzle migrations from:', migrationsFolder)
try {
  await migrate(db, { migrationsFolder })
  console.log('[migrate] Drizzle migrations complete')
} catch (err) {
  console.error('[migrate] Drizzle migrate() threw — continuing anyway:', err)
}

// Safety block: ensure schema additions are always present.
// Each statement wrapped individually so one failure does not block the rest.
const safetyStatements: Array<{ label: string; sql: string }> = [
  {
    label: 'persona_reviews.pass_number',
    sql: `ALTER TABLE "persona_reviews" ADD COLUMN IF NOT EXISTS "pass_number" integer NOT NULL DEFAULT 1`,
  },
  {
    label: 'persona_reviews.created_at',
    sql: `ALTER TABLE "persona_reviews" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now()`,
  },
  {
    label: 'CREATE advertorial_designs',
    sql: `CREATE TABLE IF NOT EXISTS "advertorial_designs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "run_id" uuid NOT NULL,
      "plan_json" jsonb NOT NULL,
      "assets_json" jsonb NOT NULL,
      "color_palette_json" jsonb,
      "typography_pairing" text,
      "created_at" timestamp DEFAULT now()
    )`,
  },
  {
    label: 'CREATE asset_revision_state',
    sql: `CREATE TABLE IF NOT EXISTS "asset_revision_state" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "run_id" uuid NOT NULL,
      "asset_id" uuid NOT NULL,
      "asset_type" text NOT NULL,
      "current_pass" integer NOT NULL DEFAULT 1,
      "last_avg_score" real,
      "status" text NOT NULL DEFAULT 'reviewing',
      "passed_at" timestamp,
      "history" jsonb NOT NULL DEFAULT '[]'::jsonb
    )`,
  },
  {
    label: 'FK advertorial_designs -> pipeline_runs',
    sql: `DO $b$ BEGIN
      ALTER TABLE "advertorial_designs" ADD CONSTRAINT "ad_designs_run_fk"
        FOREIGN KEY ("run_id") REFERENCES "pipeline_runs"("id");
    EXCEPTION WHEN duplicate_object THEN null;
    END $b$`,
  },
  {
    label: 'FK asset_revision_state -> pipeline_runs',
    sql: `DO $b$ BEGIN
      ALTER TABLE "asset_revision_state" ADD CONSTRAINT "asset_rev_run_fk"
        FOREIGN KEY ("run_id") REFERENCES "pipeline_runs"("id");
    EXCEPTION WHEN duplicate_object THEN null;
    END $b$`,
  },
  {
    label: 'UNIQUE advertorial_designs.run_id',
    sql: `DO $b$ BEGIN
      ALTER TABLE "advertorial_designs" ADD CONSTRAINT "ad_designs_run_id_unique" UNIQUE ("run_id");
    EXCEPTION WHEN duplicate_object THEN null;
    END $b$`,
  },
]

for (const stmt of safetyStatements) {
  try {
    await sql.unsafe(stmt.sql)
    console.log('[migrate] OK:', stmt.label)
  } catch (err) {
    console.error('[migrate] WARN:', stmt.label, '—', (err as Error).message)
  }
}

console.log('[migrate] Schema safety block complete')
await sql.end()
