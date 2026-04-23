import { anthropic, callClaudeJSON } from '../lib/anthropic.js'
import { db, copyAssets, pipelineRuns } from '../db/index.js'
import { log } from '../pipeline/logger.js'
import { eq, and } from 'drizzle-orm'

interface CreativeConcept {
  concept: string
  visual: string
  emotion: string
  format: 'testimonial' | 'demo' | 'problem-solution' | 'authority' | 'before-after'
  targetPersona: string
  hook: string
  valueProposition: string
}

interface AdScript {
  concept: string
  script30s: string
  script60s: string
  staticAdHeadline: string
  staticAdBody: string
  imagePrompt: string
}

const CREATIVE_DIRECTION_SYSTEM = `You are a telemedicine creative director. Analyze the advertorial and generate 3 distinct video ad concepts.

Return your concepts by calling the submit_creative_concepts tool with exactly 3 concepts.`

const CREATIVE_CONCEPTS_SCHEMA = {
  type: 'object',
  properties: {
    concepts: {
      type: 'array',
      minItems: 3,
      maxItems: 3,
      items: {
        type: 'object',
        properties: {
          concept: { type: 'string' },
          visual: { type: 'string', description: 'opening shot description' },
          emotion: { type: 'string', description: 'primary emotion driven' },
          format: { type: 'string', enum: ['testimonial', 'demo', 'problem-solution', 'authority', 'before-after'] },
          targetPersona: { type: 'string', description: 'persona from the 15 archetypes' },
          hook: { type: 'string', description: 'opening 5 seconds description' },
          valueProposition: { type: 'string' },
        },
        required: ['concept', 'visual', 'emotion', 'format', 'targetPersona', 'hook', 'valueProposition'],
      },
    },
  },
  required: ['concepts'],
}

const AD_SCRIPTS_SYSTEM = `You are a telemedicine video ad scriptwriter. Write full scripts for each creative concept.

For each input concept, write a complete 30-second script and 60-second script including visual cues, VO: lines, and SUPER: text. Also produce static ad headline, body copy, and a Flux image generation prompt for the hero image.

Return your scripts by calling the submit_ad_scripts tool, with one script object per input concept.`

const AD_SCRIPTS_SCHEMA = {
  type: 'object',
  properties: {
    scripts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          concept: { type: 'string', description: 'same name as input concept' },
          script30s: { type: 'string', description: 'full shooting script with visual cues, VO: lines, and SUPER: text' },
          script60s: { type: 'string', description: 'extended 60s version' },
          staticAdHeadline: { type: 'string' },
          staticAdBody: { type: 'string', description: '2-3 sentences' },
          imagePrompt: { type: 'string', description: 'Flux image generation prompt for the hero static ad image' },
        },
        required: ['concept', 'script30s', 'script60s', 'staticAdHeadline', 'staticAdBody', 'imagePrompt'],
      },
    },
  },
  required: ['scripts'],
}

export async function runCreativeDirection(runId: string) {
  await log(runId, 'CREATIVE_DIRECTION', 'Generating creative concepts')

  const [advertorial] = await db.select().from(copyAssets)
    .where(and(eq(copyAssets.runId, runId), eq(copyAssets.type, 'advertorial')))

  if (!advertorial) throw new Error(`No advertorial for run ${runId}`)

  const { concepts } = await callClaudeJSON<{ concepts: CreativeConcept[] }>(anthropic, {
    model: 'claude-opus-4-7',
    system: CREATIVE_DIRECTION_SYSTEM,
    messages: [{
      role: 'user',
      content: `Generate 3 video ad concepts from this advertorial:\n\n${advertorial.content.slice(0, 8000)}`,
    }],
    maxTokens: 4096,
    thinkingBudget: 2000,
    tool: {
      name: 'submit_creative_concepts',
      description: 'Submit the 3 distinct video ad concepts',
      input_schema: CREATIVE_CONCEPTS_SCHEMA,
    },
  })

  await db.insert(copyAssets).values({
    runId, type: 'concept_brief', content: JSON.stringify(concepts), version: 1, status: 'draft',
  })

  await db.update(pipelineRuns).set({ currentStage: 'AD_SCRIPTS' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'CREATIVE_DIRECTION', `Generated ${concepts.length} creative concepts`)
}

export async function runAdScripts(runId: string) {
  await log(runId, 'AD_SCRIPTS', 'Writing ad scripts')

  const [conceptBrief] = await db.select().from(copyAssets)
    .where(and(eq(copyAssets.runId, runId), eq(copyAssets.type, 'concept_brief')))

  if (!conceptBrief) throw new Error(`No concept brief for run ${runId}`)

  const { scripts } = await callClaudeJSON<{ scripts: AdScript[] }>(anthropic, {
    model: 'claude-sonnet-4-6',
    system: AD_SCRIPTS_SYSTEM,
    messages: [{
      role: 'user',
      content: `Write full ad scripts for these concepts:\n\n${conceptBrief.content}`,
    }],
    maxTokens: 16384,
    tool: {
      name: 'submit_ad_scripts',
      description: 'Submit the full video ad scripts, one per input concept',
      input_schema: AD_SCRIPTS_SCHEMA,
    },
  })

  await db.insert(copyAssets).values({
    runId, type: 'ad_script', content: JSON.stringify(scripts), version: 1, status: 'draft',
  })

  await db.update(pipelineRuns).set({ currentStage: 'FUNNEL_BUILD' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'AD_SCRIPTS', `Wrote scripts for ${scripts.length} concepts`)
}
