import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'
import { fileURLToPath } from 'url'
import { join, dirname } from 'path'
import { readdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))

const sql = postgres(process.env.DATABASE_URL!, { max: 1 })
const db = drizzle(sql)

const migrationsFolder = join(__dirname, '../../drizzle')

// Verify the migrations folder exists and list contents
try {
  const files = readdirSync(migrationsFolder)
  console.log('[migrate] Migrations folder:', migrationsFolder)
  console.log('[migrate] Contents:', files.join(', '))
} catch (err) {
  console.error('[migrate] Cannot read migrations folder:', migrationsFolder, err)
}

// Step 1: Try Drizzle's built-in migrator
console.log('[migrate] Running Drizzle migrations...')
try {
  await migrate(db, { migrationsFolder })
  console.log('[migrate] Drizzle migrations complete')
} catch (err) {
  console.error('[migrate] Drizzle migrate() threw — will use safety block:', (err as Error).message)
}

// Step 2: Safety block — ensure all required tables and columns exist
// Each statement is idempotent (IF NOT EXISTS / IF EXISTS) and wrapped individually
const safetyStatements: Array<{ label: string; ddl: string }> = [
  {
    label: 'CREATE advertorial_designs',
    ddl: `CREATE TABLE IF NOT EXISTS "advertorial_designs" (
      "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
      "run_id" uuid NOT NULL,
      "plan_json" jsonb NOT NULL,
      "assets_json" jsonb NOT NULL,
      "color_palette_json" jsonb,
      "typography_pairing" text,
      "created_at" timestamp DEFAULT now(),
      CONSTRAINT "advertorial_designs_run_id_unique" UNIQUE("run_id")
    )`,
  },
  {
    label: 'CREATE asset_revision_state',
    ddl: `CREATE TABLE IF NOT EXISTS "asset_revision_state" (
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
    label: 'persona_reviews.pass_number',
    ddl: `ALTER TABLE "persona_reviews" ADD COLUMN IF NOT EXISTS "pass_number" integer NOT NULL DEFAULT 1`,
  },
  {
    label: 'persona_reviews.created_at',
    ddl: `ALTER TABLE "persona_reviews" ADD COLUMN IF NOT EXISTS "created_at" timestamp DEFAULT now()`,
  },
  {
    label: 'FK advertorial_designs -> pipeline_runs',
    ddl: `DO $$ BEGIN
      ALTER TABLE "advertorial_designs" ADD CONSTRAINT "advertorial_designs_run_id_pipeline_runs_id_fk"
        FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE no action ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$`,
  },
  {
    label: 'FK asset_revision_state -> pipeline_runs',
    ddl: `DO $$ BEGIN
      ALTER TABLE "asset_revision_state" ADD CONSTRAINT "asset_revision_state_run_id_pipeline_runs_id_fk"
        FOREIGN KEY ("run_id") REFERENCES "public"."pipeline_runs"("id") ON DELETE no action ON UPDATE no action;
    EXCEPTION WHEN duplicate_object THEN null;
    END $$`,
  },
  {
    label: 'IDX advertorial_designs_run_id_idx',
    ddl: `CREATE INDEX IF NOT EXISTS "advertorial_designs_run_id_idx" ON "advertorial_designs" ("run_id")`,
  },
  {
    label: 'IDX asset_revision_state_run_asset_idx',
    ddl: `CREATE INDEX IF NOT EXISTS "asset_revision_state_run_asset_idx" ON "asset_revision_state" ("run_id", "asset_id")`,
  },
]

let safetyOk = 0
let safetyFail = 0
for (const stmt of safetyStatements) {
  try {
    await sql.unsafe(stmt.ddl)
    safetyOk++
    console.log('[migrate] OK:', stmt.label)
  } catch (err) {
    safetyFail++
    console.error('[migrate] FAIL:', stmt.label, '—', (err as Error).message)
  }
}

console.log(`[migrate] Safety block complete: ${safetyOk} OK, ${safetyFail} failed`)

// Step 3: Verify critical tables exist
const verifyTables = ['advertorial_designs', 'asset_revision_state', 'pipeline_runs', 'copy_assets', 'creative_assets']
for (const table of verifyTables) {
  try {
    await sql.unsafe(`SELECT 1 FROM "${table}" LIMIT 0`)
    console.log(`[migrate] VERIFY OK: ${table}`)
  } catch (err) {
    console.error(`[migrate] VERIFY FAIL: ${table} — ${(err as Error).message}`)
  }
}

await sql.end()
console.log('[migrate] Done')
