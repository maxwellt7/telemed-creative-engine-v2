import { anthropic, callClaude, parseClaudeJson } from '../lib/anthropic.js'
import { db, offerProfiles, pipelineRuns } from '../db/index.js'
import { log } from '../pipeline/logger.js'
import { eq } from 'drizzle-orm'

interface ProductInput { name: string; url: string; brief: string; targetMarket: string }

const SYSTEM_PROMPT = `You are an expert direct-response marketing strategist specializing in telemedicine offers.
Analyze using Todd Brown E5 methodology, WEB Analysis (Wants, Emotions, Beliefs), and the Irresistible Offer Equation.

Respond ONLY with valid JSON in this exact structure:
{
  "offerAnalysis": {
    "core_promise": "string",
    "mechanism": "string — the unique HOW",
    "proof_elements": ["string"],
    "price_anchor": "string",
    "urgency_levers": ["string"],
    "irresistibleEquation": {
      "massivePain": <1-10>,
      "purchasingPower": <1-10>,
      "easyToTarget": <1-10>,
      "growingMarket": <1-10>,
      "promiseSize": <1-10>,
      "perceivedLikelihood": <1-10>,
      "timeDelay": <1-10, where 10=fastest>,
      "effortRequired": <1-10, where 10=most effortless>,
      "equationScore": <(promiseSize * perceivedLikelihood) / (timeDelay * effortRequired)>,
      "weakestDimension": "string — which dimension scores lowest and what copy should compensate for"
    }
  },
  "avatar": {
    "primaryAge": "string",
    "gender": "string",
    "income": "string",
    "topDesire": "string",
    "topFrustration": "string",
    "previousSolutions": ["string"],
    "primaryCurrency": "string — one of: Time/Money/Status/Health/Freedom/Security",
    "empathyMap": {
      "seeing": ["string — 5 items: what they see in their environment"],
      "hearing": ["string — 5 items: what they hear from others"],
      "saying": ["string — 5 items: exact phrases they say out loud about their weight problem"],
      "thinking": ["string — 5 items: what they privately think but don't say"],
      "feeling": ["string — 5 items: emotional states they experience"],
      "doing": ["string — 5 items: actions they take around the problem"],
      "pains": ["string — 5 items: specific pain points"],
      "gains": ["string — 5 items: desired outcomes and gains"]
    },
    "goalsGrid": {
      "painsAndFrustrations": ["string — 5 items: daily frustrations"],
      "fearsAndImplications": ["string — 5 items: deep fears if the problem persists"],
      "goalsAndDesires": ["string — 5 items: immediate goals they want to achieve"],
      "dreamsAndAspirations": ["string — 5 items: ultimate vision of their transformed life"]
    }
  },
  "beliefs": ["string — deeply held beliefs that must be addressed in copy"],
  "beliefCategories": {
    "outcome": ["string — 2 beliefs about whether the outcome is real and attainable"],
    "identity": ["string — 2 beliefs about whether someone like them can do this"],
    "problem": ["string — 2 beliefs about the problem cause and urgency"],
    "solution": ["string — 2 beliefs about whether this approach/mechanism works"],
    "product": ["string — 2 beliefs about this specific telemedicine offer"],
    "credibility": ["string — 2 beliefs about whether they trust telemedicine providers"]
  },
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
}

IMPORTANT: Each empathyMap array must contain exactly 5 specific, concrete items. No generic placeholders.`

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
    manifoldJson: { ...parsed.manifold, beliefCategories: parsed.beliefCategories },
    launchDocJson: parsed.launchDoc,
  })

  await db.update(pipelineRuns).set({ currentStage: 'AVATAR_BUILD' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'OFFER_PROFILE', 'Offer profile complete', 'info', { headline: parsed.launchDoc.headline })
}
