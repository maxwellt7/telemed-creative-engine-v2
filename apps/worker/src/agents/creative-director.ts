import { anthropic, callClaude } from '../lib/anthropic.js'
import { db, copyAssets, pipelineRuns } from '../db/index.js'
import { log } from '../pipeline/logger.js'
import { eq, and } from 'drizzle-orm'

const CREATIVE_DIRECTION_SYSTEM = `You are a telemedicine creative director. Analyze the advertorial and generate 3 distinct video ad concepts.

Respond ONLY with valid JSON — array of exactly 3:
[
  {
    "concept": "string",
    "visual": "string — opening shot description",
    "emotion": "string — primary emotion driven",
    "format": "testimonial | demo | problem-solution | authority | before-after",
    "targetPersona": "string — persona from the 15 archetypes",
    "hook": "string — opening 5 seconds description",
    "valueProposition": "string"
  }
]`

const AD_SCRIPTS_SYSTEM = `You are a telemedicine video ad scriptwriter. Write full scripts for each creative concept.

Respond ONLY with valid JSON — array matching input concepts:
[
  {
    "concept": "string — same name as input",
    "script30s": "string — full shooting script with visual cues, VO: lines, and SUPER: text",
    "script60s": "string — extended 60s version",
    "staticAdHeadline": "string",
    "staticAdBody": "string — 2-3 sentences",
    "imagePrompt": "string — Flux image generation prompt for the hero static ad image"
  }
]`

export async function runCreativeDirection(runId: string) {
  await log(runId, 'CREATIVE_DIRECTION', 'Generating creative concepts')

  const [advertorial] = await db.select().from(copyAssets)
    .where(and(eq(copyAssets.runId, runId), eq(copyAssets.type, 'advertorial')))

  if (!advertorial) throw new Error(`No advertorial for run ${runId}`)

  const concepts = await callClaude(anthropic, {
    model: 'claude-opus-4-7',
    system: CREATIVE_DIRECTION_SYSTEM,
    messages: [{
      role: 'user',
      content: `Generate 3 video ad concepts from this advertorial:\n\n${advertorial.content.slice(0, 8000)}`,
    }],
    maxTokens: 4096,
    thinkingBudget: 2000,
  })

  const parsed = JSON.parse(concepts)
  await db.insert(copyAssets).values({
    runId, type: 'concept_brief', content: JSON.stringify(parsed), version: 1, status: 'draft',
  })

  await db.update(pipelineRuns).set({ currentStage: 'AD_SCRIPTS' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'CREATIVE_DIRECTION', `Generated ${parsed.length} creative concepts`)
}

export async function runAdScripts(runId: string) {
  await log(runId, 'AD_SCRIPTS', 'Writing ad scripts')

  const [conceptBrief] = await db.select().from(copyAssets)
    .where(and(eq(copyAssets.runId, runId), eq(copyAssets.type, 'concept_brief')))

  if (!conceptBrief) throw new Error(`No concept brief for run ${runId}`)

  const scripts = await callClaude(anthropic, {
    model: 'claude-sonnet-4-6',
    system: AD_SCRIPTS_SYSTEM,
    messages: [{
      role: 'user',
      content: `Write full ad scripts for these concepts:\n\n${conceptBrief.content}`,
    }],
    maxTokens: 8192,
  })

  const parsed = JSON.parse(scripts)
  await db.insert(copyAssets).values({
    runId, type: 'ad_script', content: JSON.stringify(parsed), version: 1, status: 'draft',
  })

  await db.update(pipelineRuns).set({ currentStage: 'FUNNEL_BUILD' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'AD_SCRIPTS', `Wrote scripts for ${parsed.length} concepts`)
}
