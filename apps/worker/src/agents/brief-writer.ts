import { anthropic, callClaudeJSON } from '../lib/anthropic.js'
import { db, researchArtifacts, reverseBriefs, offerProfiles, pipelineRuns } from '../db/index.js'
import { log } from '../pipeline/logger.js'
import { eq, and, desc } from 'drizzle-orm'

interface ReverseBrief {
  whyItConverts: string
  toneAnalysis: string
  structureMap: string[]
  copywriterBrief: string
  doNotCopy: string[]
  powerElements: string[]
}

interface CopyConcept {
  concept: string
  angle: string
  hook: string
  headline: string
  subheadline: string
  emotionalCore: string
  targetPersona: string
  uniqueMechanism: string
}

const REVERSE_BRIEF_SYSTEM = `You are a senior direct-response copywriter. Explain WHY this advertorial converts based on the reverse engineering analysis.

Return your brief by calling the submit_reverse_brief tool.`

const REVERSE_BRIEF_SCHEMA = {
  type: 'object',
  properties: {
    whyItConverts: { type: 'string', description: 'the core psychological mechanism' },
    toneAnalysis: { type: 'string', description: 'precise description of voice and tone' },
    structureMap: { type: 'array', items: { type: 'string' }, description: 'each section in order' },
    copywriterBrief: { type: 'string', description: '200-400 words a copywriter can follow' },
    doNotCopy: { type: 'array', items: { type: 'string' }, description: 'elements to avoid' },
    powerElements: { type: 'array', items: { type: 'string' }, description: 'top 3-5 conversion drivers' },
  },
  required: ['whyItConverts', 'toneAnalysis', 'structureMap', 'copywriterBrief', 'doNotCopy', 'powerElements'],
}

const COPY_CONCEPTS_SYSTEM = `You are a direct-response copy strategist for telemedicine. Generate 3 distinct advertorial concepts with unique psychological angles.

Return your concepts by calling the submit_copy_concepts tool with exactly 3 concepts.`

const COPY_CONCEPTS_SCHEMA = {
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
          angle: { type: 'string', description: 'unique psychological angle' },
          hook: { type: 'string', description: 'opening sentence' },
          headline: { type: 'string', description: 'H1' },
          subheadline: { type: 'string' },
          emotionalCore: { type: 'string', description: 'primary emotion driven' },
          targetPersona: { type: 'string', description: 'which of the 15 personas this hits hardest' },
          uniqueMechanism: { type: 'string', description: 'the differentiating claim' },
        },
        required: ['concept', 'angle', 'hook', 'headline', 'subheadline', 'emotionalCore', 'targetPersona', 'uniqueMechanism'],
      },
    },
  },
  required: ['concepts'],
}

export async function runReverseBrief(runId: string) {
  await log(runId, 'REVERSE_BRIEF', 'Writing reverse brief from analysis')

  const artifacts = await db.select().from(researchArtifacts)
    .where(and(eq(researchArtifacts.runId, runId), eq(researchArtifacts.type, 'advertorial')))
    .orderBy(desc(researchArtifacts.trafficScore))
    .limit(1)

  const top = artifacts[0]
  if (!top) {
    await log(runId, 'REVERSE_BRIEF', 'No advertorial found — skipping', 'warn')
    await db.update(pipelineRuns).set({ currentStage: 'COPY_CONCEPTS' }).where(eq(pipelineRuns.id, runId))
    return
  }

  const parsed = await callClaudeJSON<ReverseBrief>(anthropic, {
    model: 'claude-opus-4-7',
    system: REVERSE_BRIEF_SYSTEM,
    messages: [{
      role: 'user',
      content: `Write a reverse brief for:\n\nURL: ${top.url}\n\nAnalysis:\n${JSON.stringify(top.analysisJson, null, 2)}\n\nContent excerpt:\n${top.rawContent?.slice(0, 6000) ?? ''}`,
    }],
    maxTokens: 4096,
    tool: {
      name: 'submit_reverse_brief',
      description: 'Submit the reverse brief explaining why the advertorial converts',
      input_schema: REVERSE_BRIEF_SCHEMA,
    },
  })

  await db.insert(reverseBriefs).values({
    runId,
    sourceUrl: top.url,
    lineAnalysisJson: top.analysisJson ?? {},
    briefJson: parsed,
    conceptsJson: [],
  })

  await db.update(pipelineRuns).set({ currentStage: 'COPY_CONCEPTS' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'REVERSE_BRIEF', 'Reverse brief complete')
}

export async function runCopyConcepts(runId: string) {
  await log(runId, 'COPY_CONCEPTS', 'Generating 3 advertorial concepts')

  const [profile] = await db.select().from(offerProfiles).where(eq(offerProfiles.runId, runId))
  const [brief] = await db.select().from(reverseBriefs).where(eq(reverseBriefs.runId, runId))

  const { concepts } = await callClaudeJSON<{ concepts: CopyConcept[] }>(anthropic, {
    model: 'claude-sonnet-4-6',
    system: COPY_CONCEPTS_SYSTEM,
    messages: [{
      role: 'user',
      content: `Generate 3 concepts for this telemedicine product.\n\nOffer Profile:\n${JSON.stringify(profile?.offerAnalysisJson, null, 2)}\n\nReverse Brief:\n${JSON.stringify(brief?.briefJson, null, 2)}`,
    }],
    maxTokens: 4096,
    tool: {
      name: 'submit_copy_concepts',
      description: 'Submit the 3 distinct advertorial concepts',
      input_schema: COPY_CONCEPTS_SCHEMA,
    },
  })

  if (brief) {
    await db.update(reverseBriefs).set({ conceptsJson: concepts }).where(eq(reverseBriefs.runId, runId))
  }

  await db.update(pipelineRuns).set({ currentStage: 'ADVERTORIAL_COPY' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'COPY_CONCEPTS', `Generated ${concepts.length} copy concepts`)
}
