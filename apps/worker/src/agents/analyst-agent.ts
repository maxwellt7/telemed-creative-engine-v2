import { scrapeUrl } from '../lib/firecrawl.js'
import { anthropic, callClaude, parseClaudeJson } from '../lib/anthropic.js'
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

const REVERSE_ENGINEER_SYSTEM = `You are a senior direct-response copywriting analyst. Perform a deep structural reverse-engineering of this health advertorial. Your analysis will be used to brief a copywriter writing a NEW advertorial for a DIFFERENT product in the same telemedicine category — so focus on transferable mechanics, not on product-specific content.

Respond ONLY with valid JSON:
{
  "hookStructure": "string — exact formula used in the opening (e.g. fear+statistic, curiosity gap, named protagonist, bold claim)",
  "hiddenTruthReframe": "string — the core belief the copy shatters and replaces (the 'it's not X — it's actually Y' pivot). What does the reader believe before reading, and what do they believe after?",
  "protagonistStructure": "string — how the proxy character is introduced, what details make them relatable, how they're used throughout",
  "authorityStack": ["string — each credibility layer in sequence: institution name, expert name+credential, specific data point, customer proof"],
  "beliefBridges": ["string — each step in the logic chain that moves the reader from skeptic to buyer"],
  "proofAvalanchePattern": "string — how testimonials/reviews are woven into narrative vs siloed (with specific placement relative to emotional peaks)",
  "ctaMechanics": "string — exact placement triggers (after what emotional moment does each CTA appear), wording formula, guarantee proximity",
  "urgencyArchitecture": "string — external scarcity tactic + internal (health cost of delay) tactic, and how they're combined",
  "voice": "string — precise register: who is the narrator, what is their relationship to the reader, what tone signals authority without sounding clinical",
  "emotionalArc": ["string — each emotional state in sequence the reader is moved through"],
  "keyPhrases": ["string — 5-8 phrases with highest conversion weight, with brief note on why each works"],
  "pacing": "string — paragraph length rhythm, how density alternates with visual relief",
  "socialProofTypes": ["string — each proof type used and its placement"],
  "objectionHandling": ["string — each implicit objection the copy pre-empts and how"],
  "scarcityMechanics": "string — specific language used for urgency, whether it feels logical or manufactured",
  "comparisonTactics": "string — how this product is implicitly or explicitly positioned against alternatives"
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
    .set({ analysisJson: parseClaudeJson(analysis) })
    .where(eq(researchArtifacts.id, top.id))

  await db.update(pipelineRuns).set({ currentStage: 'REVERSE_BRIEF' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'REVERSE_ENGINEER', 'Reverse engineering complete')
}
