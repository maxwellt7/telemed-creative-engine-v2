import {
  pgTable, uuid, text, timestamp, integer, jsonb, real, index, boolean,
} from 'drizzle-orm/pg-core'

export const products = pgTable('products', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  url: text('url').notNull(),
  targetMarket: text('target_market').notNull(),
  brief: text('brief').notNull(),
  vertical: text('vertical').notNull().default('telemedicine'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const pipelineRuns = pgTable('pipeline_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  productId: uuid('product_id').references(() => products.id).notNull(),
  status: text('status').notNull().default('pending'),
  currentStage: text('current_stage').notNull().default('INTAKE'),
  revisionPass: integer('revision_pass').notNull().default(0),
  startedAt: timestamp('started_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
  createdBy: text('created_by').notNull(),
}, (t) => ({ pipeline_runs_product_id_idx: index('pipeline_runs_product_id_idx').on(t.productId) }))

export const stageLogs = pgTable('stage_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').references(() => pipelineRuns.id).notNull(),
  stage: text('stage').notNull(),
  level: text('level').notNull().default('info'),
  message: text('message').notNull(),
  metadataJson: jsonb('metadata_json'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({ stage_logs_run_id_idx: index('stage_logs_run_id_idx').on(t.runId) }))

export const offerProfiles = pgTable('offer_profiles', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').references(() => pipelineRuns.id).notNull(),
  offerAnalysisJson: jsonb('offer_analysis_json').notNull(),
  avatarJson: jsonb('avatar_json').notNull(),
  beliefsJson: jsonb('beliefs_json').notNull(),
  manifoldJson: jsonb('manifold_json').notNull(),
  launchDocJson: jsonb('launch_doc_json').notNull(),
})

export const researchArtifacts = pgTable('research_artifacts', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').references(() => pipelineRuns.id).notNull(),
  type: text('type').notNull(),
  url: text('url').notNull(),
  title: text('title').notNull(),
  trafficScore: real('traffic_score'),
  rawContent: text('raw_content'),
  analysisJson: jsonb('analysis_json'),
}, (t) => ({ research_artifacts_run_id_idx: index('research_artifacts_run_id_idx').on(t.runId) }))

export const reverseBriefs = pgTable('reverse_briefs', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').references(() => pipelineRuns.id).notNull(),
  sourceUrl: text('source_url').notNull(),
  lineAnalysisJson: jsonb('line_analysis_json').notNull(),
  briefJson: jsonb('brief_json').notNull(),
  conceptsJson: jsonb('concepts_json').notNull(),
})

export const copyAssets = pgTable('copy_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').references(() => pipelineRuns.id).notNull(),
  type: text('type').notNull(),
  content: text('content').notNull(),
  version: integer('version').notNull().default(1),
  score: real('score'),
  status: text('status').notNull().default('draft'),
}, (t) => ({ copy_assets_run_id_idx: index('copy_assets_run_id_idx').on(t.runId) }))

export const creativeAssets = pgTable('creative_assets', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').references(() => pipelineRuns.id).notNull(),
  type: text('type').notNull(),
  falJobId: text('fal_job_id'),
  storageUrl: text('storage_url'),
  format: text('format'),
  score: real('score'),
  status: text('status').notNull().default('generating'),
}, (t) => ({ creative_assets_run_id_idx: index('creative_assets_run_id_idx').on(t.runId) }))

export const funnelPages = pgTable('funnel_pages', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').references(() => pipelineRuns.id).notNull(),
  htmlContent: text('html_content').notNull(),
  vercelDeploymentId: text('vercel_deployment_id'),
  vercelUrl: text('vercel_url'),
  status: text('status').notNull().default('pending'),
})

export const personas = pgTable('personas', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  archetype: text('archetype').notNull(),
  demographicsJson: jsonb('demographics_json').notNull(),
  psychographicsJson: jsonb('psychographics_json').notNull(),
  primaryFear: text('primary_fear').notNull(),
  primaryCurrency: text('primary_currency').notNull(),
})

export const personaReviews = pgTable('persona_reviews', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').references(() => pipelineRuns.id).notNull(),
  personaId: uuid('persona_id').references(() => personas.id).notNull(),
  assetId: uuid('asset_id').notNull(),
  assetType: text('asset_type').notNull(),
  score: real('score').notNull(),
  sentiment: text('sentiment').notNull(),
  objection: text('objection').notNull(),
  suggestedEdit: text('suggested_edit').notNull(),
  passNumber: integer('pass_number').notNull().default(1),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  persona_reviews_run_id_idx: index('persona_reviews_run_id_idx').on(t.runId),
  persona_reviews_asset_id_idx: index('persona_reviews_asset_id_idx').on(t.assetId),
}))

export const advertorialDesigns = pgTable('advertorial_designs', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').references(() => pipelineRuns.id).notNull().unique(),
  planJson: jsonb('plan_json').notNull(),
  assetsJson: jsonb('assets_json').notNull(),
  colorPaletteJson: jsonb('color_palette_json'),
  typographyPairing: text('typography_pairing'),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  advertorial_designs_run_id_idx: index('advertorial_designs_run_id_idx').on(t.runId),
}))

export const assetRevisionState = pgTable('asset_revision_state', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').references(() => pipelineRuns.id).notNull(),
  assetId: uuid('asset_id').notNull(),
  assetType: text('asset_type').notNull(),
  currentPass: integer('current_pass').notNull().default(1),
  lastAvgScore: real('last_avg_score'),
  status: text('status').notNull().default('reviewing'),
  passedAt: timestamp('passed_at'),
  history: jsonb('history').notNull().default('[]'),
}, (t) => ({
  asset_revision_state_run_asset_idx: index('asset_revision_state_run_asset_idx').on(t.runId, t.assetId),
}))

export const clickupDeliverables = pgTable('clickup_deliverables', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: uuid('run_id').references(() => pipelineRuns.id).notNull(),
  list: text('list').notNull(),
  taskId: text('task_id').notNull(),
  taskUrl: text('task_url').notNull(),
  deliveredAt: timestamp('delivered_at').defaultNow().notNull(),
})
