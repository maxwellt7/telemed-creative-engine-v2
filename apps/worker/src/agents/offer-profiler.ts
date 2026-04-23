import { anthropic, callClaude, parseClaudeJson } from '../lib/anthropic.js'
import { db, offerProfiles, pipelineRuns } from '../db/index.js'
import { log } from '../pipeline/logger.js'
import { eq } from 'drizzle-orm'

interface ProductInput { name: string; url: string; brief: string; targetMarket: string }

const SYSTEM_PROMPT = `You are an expert direct-response marketing strategist specializing in telemedicine offers.
Analyze using Todd Brown E5 methodology and WEB Analysis (Wants, Emotions, Beliefs).

Respond ONLY with valid JSON in this exact structure:
{
  "offerAnalysis": {
    "core_promise": "string",
    "mechanism": "string — the unique HOW",
    "proof_elements": ["string"],
    "price_anchor": "string",
    "urgency_levers": ["string"]
  },
  "avatar": {
    "primaryAge": "string",
    "gender": "string",
    "income": "string",
    "topDesire": "string",
    "topFrustration": "string",
    "previousSolutions": ["string"]
  },
  "beliefs": ["string — deeply held beliefs that must be addressed"],
  "manifold": {
    "topFear": "string",
    "topHope": "string",
    "identity": "string"
  },
  "launchDoc": {
    "headline": "string",
    "hook": "string — opening hook sentence",
    "positioning": "string — vs competitors"
  }
}`

export async function runOfferProfiler(runId: string, product: ProductInput) {
  await log(runId, 'OFFER_PROFILE', `Profiling offer: ${product.name}`)

  const text = await callClaude(anthropic, {
    model: 'claude-opus-4-7',
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Analyze this telemedicine product:\n\nProduct: ${product.name}\nURL: ${product.url}\nTarget Market: ${product.targetMarket}\nBrief: ${product.brief}`,
    }],
    maxTokens: 4096,
    thinkingBudget: 2048,
  })

  const parsed = parseClaudeJson(text)

  await db.insert(offerProfiles).values({
    runId,
    offerAnalysisJson: parsed.offerAnalysis,
    avatarJson: parsed.avatar,
    beliefsJson: parsed.beliefs,
    manifoldJson: parsed.manifold,
    launchDocJson: parsed.launchDoc,
  })

  await db.update(pipelineRuns).set({ currentStage: 'AVATAR_BUILD' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'OFFER_PROFILE', 'Offer profile complete', 'info', { headline: parsed.launchDoc.headline })
}
