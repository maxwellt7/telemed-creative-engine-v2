import { anthropic, callClaudeJSON } from '../lib/anthropic.js'
import { db, offerProfiles, pipelineRuns } from '../db/index.js'
import { log } from '../pipeline/logger.js'
import { eq } from 'drizzle-orm'

interface ProductInput { name: string; url: string; brief: string; targetMarket: string }

interface OfferProfileResult {
  offerAnalysis: {
    core_promise: string
    mechanism: string
    proof_elements: string[]
    price_anchor: string
    urgency_levers: string[]
  }
  avatar: {
    primaryAge: string
    gender: string
    income: string
    topDesire: string
    topFrustration: string
    previousSolutions: string[]
  }
  beliefs: string[]
  manifold: {
    topFear: string
    topHope: string
    identity: string
  }
  launchDoc: {
    headline: string
    hook: string
    positioning: string
  }
}

const SYSTEM_PROMPT = `You are an expert direct-response marketing strategist specializing in telemedicine offers.
Analyze using Todd Brown E5 methodology and WEB Analysis (Wants, Emotions, Beliefs).

Return your analysis by calling the submit_offer_profile tool.`

const OFFER_PROFILE_SCHEMA = {
  type: 'object',
  properties: {
    offerAnalysis: {
      type: 'object',
      properties: {
        core_promise: { type: 'string' },
        mechanism: { type: 'string', description: 'the unique HOW' },
        proof_elements: { type: 'array', items: { type: 'string' } },
        price_anchor: { type: 'string' },
        urgency_levers: { type: 'array', items: { type: 'string' } },
      },
      required: ['core_promise', 'mechanism', 'proof_elements', 'price_anchor', 'urgency_levers'],
    },
    avatar: {
      type: 'object',
      properties: {
        primaryAge: { type: 'string' },
        gender: { type: 'string' },
        income: { type: 'string' },
        topDesire: { type: 'string' },
        topFrustration: { type: 'string' },
        previousSolutions: { type: 'array', items: { type: 'string' } },
      },
      required: ['primaryAge', 'gender', 'income', 'topDesire', 'topFrustration', 'previousSolutions'],
    },
    beliefs: {
      type: 'array',
      items: { type: 'string' },
      description: 'deeply held beliefs that must be addressed',
    },
    manifold: {
      type: 'object',
      properties: {
        topFear: { type: 'string' },
        topHope: { type: 'string' },
        identity: { type: 'string' },
      },
      required: ['topFear', 'topHope', 'identity'],
    },
    launchDoc: {
      type: 'object',
      properties: {
        headline: { type: 'string' },
        hook: { type: 'string', description: 'opening hook sentence' },
        positioning: { type: 'string', description: 'vs competitors' },
      },
      required: ['headline', 'hook', 'positioning'],
    },
  },
  required: ['offerAnalysis', 'avatar', 'beliefs', 'manifold', 'launchDoc'],
}

export async function runOfferProfiler(runId: string, product: ProductInput) {
  await log(runId, 'OFFER_PROFILE', `Profiling offer: ${product.name}`)

  const parsed = await callClaudeJSON<OfferProfileResult>(anthropic, {
    model: 'claude-opus-4-7',
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: `Analyze this telemedicine product:\n\nProduct: ${product.name}\nURL: ${product.url}\nTarget Market: ${product.targetMarket}\nBrief: ${product.brief}`,
    }],
    maxTokens: 4096,
    thinkingBudget: 2048,
    tool: {
      name: 'submit_offer_profile',
      description: 'Submit the full offer profile analysis',
      input_schema: OFFER_PROFILE_SCHEMA,
    },
  })

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
