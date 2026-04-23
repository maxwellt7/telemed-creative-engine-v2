import { scrapeUrl } from '../lib/firecrawl.js'
import { anthropic, callClaude } from '../lib/anthropic.js'
import { db, researchArtifacts, pipelineRuns } from '../db/index.js'
import { log } from '../pipeline/logger.js'
import { eq, and } from 'drizzle-orm'

export async function runAdvertorialFetch(runId: string) {
  await log(runId, 'ADVERTORIAL_FETCH', 'Fetching full advertorial content via Firecrawl')

  const artifacts = await db.select().from(researchArtifacts)
    .where(and(eq(researchArtifacts.runId, runId), eq(researchArtifacts.type, 'advertorial')))

  for (const artifact of artifacts.slice(0, 3)) {
    try {
      const fullContent = await scrapeUrl(artifact.url)
      await db.update(researchArtifacts)
        .set({ rawContent: fullContent })
        .where(eq(researchArtifacts.id, artifact.id))
      await log(runId, 'ADVERTORIAL_FETCH', `Fetched ${artifact.url} (${fullContent.length} chars)`)
    } catch (err) {
      await log(runId, 'ADVERTORIAL_FETCH', `Failed: ${artifact.url} — ${String(err)}`, 'warn')
    }
  }

  await db.update(pipelineRuns).set({ currentStage: 'REVERSE_ENGINEER' }).where(eq(pipelineRuns.id, runId))
}

const REVERSE_ENGINEER_SYSTEM = `You are a direct-response copywriting analyst. Reverse engineer this advertorial line by line.

Respond ONLY with valid JSON:
{
  "hookStructure": "string",
  "beliefBridges": ["string"],
  "ctaMechanics": "string",
  "voice": "string",
  "emotionalArc": ["string"],
  "keyPhrases": ["string — phrases with highest conversion weight"],
  "pacing": "string",
  "socialProofTypes": ["string"],
  "objectionHandling": ["string — implicit objections the copy addresses"]
}`

export async function runReverseEngineer(runId: string) {
  await log(runId, 'REVERSE_ENGINEER', 'Reverse engineering top advertorial')

  const artifacts = await db.select().from(researchArtifacts)
    .where(and(eq(researchArtifacts.runId, runId), eq(researchArtifacts.type, 'advertorial')))

  if (artifacts.length === 0) {
    await log(runId, 'REVERSE_ENGINEER', 'No advertorials found — skipping', 'warn')
    await db.update(pipelineRuns).set({ currentStage: 'REVERSE_BRIEF' }).where(eq(pipelineRuns.id, runId))
    return
  }

  const top = artifacts.sort((a, b) => (b.trafficScore ?? 0) - (a.trafficScore ?? 0))[0]

  const analysis = await callClaude(anthropic, {
    model: 'claude-opus-4-7',
    system: REVERSE_ENGINEER_SYSTEM,
    messages: [{
      role: 'user',
      content: `Reverse engineer this advertorial:\n\nURL: ${top.url}\n\n---\n\n${top.rawContent?.slice(0, 12000) ?? ''}`,
    }],
    maxTokens: 4096,
    thinkingBudget: 2000,
  })

  await db.update(researchArtifacts)
    .set({ analysisJson: JSON.parse(analysis) })
    .where(eq(researchArtifacts.id, top.id))

  await db.update(pipelineRuns).set({ currentStage: 'REVERSE_BRIEF' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'REVERSE_ENGINEER', 'Reverse engineering complete')
}
