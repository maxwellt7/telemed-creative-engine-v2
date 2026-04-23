import { anthropic, callClaude } from '../lib/anthropic.js'
import { db, researchArtifacts, reverseBriefs, offerProfiles, pipelineRuns } from '../db/index.js'
import { log } from '../pipeline/logger.js'
import { eq, and, desc } from 'drizzle-orm'

const REVERSE_BRIEF_SYSTEM = `You are a senior direct-response copywriter. Explain WHY this advertorial converts based on the reverse engineering analysis.

Respond ONLY with valid JSON:
{
  "whyItConverts": "string — the core psychological mechanism",
  "toneAnalysis": "string — precise description of voice and tone",
  "structureMap": ["string — each section in order"],
  "copywriterBrief": "string — 200-400 words a copywriter can follow",
  "doNotCopy": ["string — elements to avoid"],
  "powerElements": ["string — top 3-5 conversion drivers"]
}`

const COPY_CONCEPTS_SYSTEM = `You are a direct-response copy strategist for telemedicine. Generate 3 distinct advertorial concepts with unique psychological angles.

Respond ONLY with valid JSON — array of exactly 3:
[
  {
    "concept": "string",
    "angle": "string — unique psychological angle",
    "hook": "string — opening sentence",
    "headline": "string — H1",
    "subheadline": "string",
    "emotionalCore": "string — primary emotion driven",
    "targetPersona": "string — which of the 15 personas this hits hardest",
    "uniqueMechanism": "string — the differentiating claim"
  }
]`

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

  const brief = await callClaude(anthropic, {
    model: 'claude-opus-4-7',
    system: REVERSE_BRIEF_SYSTEM,
    messages: [{
      role: 'user',
      content: `Write a reverse brief for:\n\nURL: ${top.url}\n\nAnalysis:\n${JSON.stringify(top.analysisJson, null, 2)}\n\nContent excerpt:\n${top.rawContent?.slice(0, 6000) ?? ''}`,
    }],
    maxTokens: 4096,
  })

  const parsed = JSON.parse(brief)
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

  const concepts = await callClaude(anthropic, {
    model: 'claude-sonnet-4-6',
    system: COPY_CONCEPTS_SYSTEM,
    messages: [{
      role: 'user',
      content: `Generate 3 concepts for this telemedicine product.\n\nOffer Profile:\n${JSON.stringify(profile?.offerAnalysisJson, null, 2)}\n\nReverse Brief:\n${JSON.stringify(brief?.briefJson, null, 2)}`,
    }],
    maxTokens: 4096,
  })

  const parsed = JSON.parse(concepts)

  if (brief) {
    await db.update(reverseBriefs).set({ conceptsJson: parsed }).where(eq(reverseBriefs.runId, runId))
  }

  await db.update(pipelineRuns).set({ currentStage: 'ADVERTORIAL_COPY' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'COPY_CONCEPTS', `Generated ${parsed.length} copy concepts`)
}
