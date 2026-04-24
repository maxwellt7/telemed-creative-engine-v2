import { anthropic, callClaude, parseClaudeJson } from '../lib/anthropic.js'
import { db, researchArtifacts, reverseBriefs, offerProfiles, pipelineRuns } from '../db/index.js'
import { log } from '../pipeline/logger.js'
import { eq, and, desc } from 'drizzle-orm'

const REVERSE_BRIEF_SYSTEM = `You are a senior direct-response copywriter analyzing a high-converting health advertorial. Your job is to extract the EXACT psychological and structural mechanics that make it work so a copywriter can replicate the conversion power — not the content — for a different product.

Focus on:
- The "hidden truth reframe" — what belief does this page shatter and replace? (e.g., "your fatigue isn't age — it's collagen loss")
- The named protagonist structure — how is the proxy character used?
- The authority-stacking sequence — institutional, expert, data, customer proof in what order?
- CTA positioning — where do CTAs appear relative to emotional peaks?
- Urgency architecture — external scarcity + internal (health cost of inaction) combined how?
- Voice calibration — conversational-authoritative "knowledgeable friend" vs clinical vs other?

Respond ONLY with valid JSON:
{
  "hiddenTruthReframe": "string — the core belief reframe (the intellectual hook that makes the reader feel they learned something they can't unknow)",
  "protagonistStructure": "string — how the named character is introduced and used throughout",
  "whyItConverts": "string — the core psychological mechanism in 2-3 sentences",
  "toneAnalysis": "string — precise voice description: who is speaking, to whom, in what register",
  "structureMap": ["string — each named section in order with its conversion purpose"],
  "authorityStack": ["string — each credibility layer in sequence: institutional → expert → data → customer"],
  "urgencyMechanics": "string — external scarcity + internal (health cost of delay) tactics used",
  "ctaPositioning": "string — exactly where CTAs appear and what triggers them",
  "copywriterBrief": "string — 300-500 words of precise copywriter direction: voice, arc, reframe to use, proof types, CTA cadence",
  "doNotCopy": ["string — specific elements to avoid (claims, phrasing, tropes)"],
  "powerElements": ["string — top 5 conversion drivers in rank order"]
}`

const COPY_CONCEPTS_SYSTEM = `You are a direct-response copy strategist for telemedicine. Generate 3 distinct advertorial concepts, each built around a sharp "hidden truth reframe" — the single insight that makes a reader feel they've learned something they can't unknow and that explains why nothing else has worked.

Each concept must have:
- A DIFFERENT reframe (not just angle variations on the same idea)
- A named protagonist archetype (not generic "many people" — a specific persona)
- A mechanism name (the named science/discovery that makes this product uniquely effective)
- An agitation moment (the specific daily cost of inaction for this persona)

The best reframes expose a hidden cause the reader has never heard explained this way:
- "Your GLP-1 resistance isn't a discipline problem — it's a gut microbiome problem"
- "You're not losing weight slowly because of metabolism — you're losing it slowly because your body is actively blocking absorption"
- "The reason your appetite returns after ozempic is a specific receptor the drug doesn't address"

Respond ONLY with valid JSON — array of exactly 3:
[
  {
    "concept": "string — concept name",
    "angle": "string — unique psychological angle",
    "hiddenTruthReframe": "string — the ONE sharp belief-shattering insight that is the intellectual core of this piece",
    "mechanismName": "string — the named mechanism that explains why this product works (e.g. 'GLP-1 Receptor Potentiation', 'Metabolic Reset Protocol')",
    "protagonist": { "name": "string", "age": "string", "situation": "string — 1-2 sentences that make a reader self-identify" },
    "hook": "string — opening 2 sentences of the advertorial itself",
    "headline": "string — H1 (fear + specificity OR curiosity gap format)",
    "subheadline": "string — explains the reframe in one line",
    "agitationMoment": "string — the specific daily emotional cost this persona faces that will be agitated mid-page",
    "emotionalCore": "string — primary emotion driven (curiosity/fear/hope/shame/relief)",
    "targetPersona": "string — which of the 15 telemedicine personas this hits hardest",
    "uniqueMechanism": "string — the differentiating scientific or clinical claim"
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

  const parsed = parseClaudeJson(brief)
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

  const parsed = parseClaudeJson(concepts)

  if (brief) {
    await db.update(reverseBriefs).set({ conceptsJson: parsed }).where(eq(reverseBriefs.runId, runId))
  }

  await db.update(pipelineRuns).set({ currentStage: 'ADVERTORIAL_COPY' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'COPY_CONCEPTS', `Generated ${parsed.length} copy concepts`)
}
