import { anthropic, callClaude, parseClaudeJson } from '../lib/anthropic.js'
import { db, personas, copyAssets, creativeAssets, personaReviews, pipelineRuns } from '../db/index.js'
import { log } from '../pipeline/logger.js'
import { eq, and, desc } from 'drizzle-orm'

interface PersonaRow {
  id: string
  name: string
  archetype: string
  primaryFear: string
  primaryCurrency: string
  demographicsJson: unknown
  psychographicsJson: unknown
}

function buildPersonaSystem(persona: PersonaRow): string {
  return `You are ${persona.name}, a real person (${persona.archetype}).

Demographics: ${JSON.stringify(persona.demographicsJson)}
Psychographics: ${JSON.stringify(persona.psychographicsJson)}
Your primary fear: "${persona.primaryFear}"
What you value most: ${persona.primaryCurrency}

You are reviewing a telemedicine advertisement. Be brutally honest. Score 1-10 based on how likely YOU would click/buy.

Respond ONLY with valid JSON:
{
  "score": number,
  "sentiment": "positive" | "neutral" | "negative",
  "objection": "string — your specific concern",
  "suggestedEdit": "string — one concrete change that would move you"
}`
}

async function reviewAsset(
  persona: PersonaRow,
  assetContent: string,
  assetType: string
): Promise<{ score: number; sentiment: string; objection: string; suggestedEdit: string }> {
  try {
    const text = await callClaude(anthropic, {
      model: 'claude-sonnet-4-6',
      system: buildPersonaSystem(persona),
      messages: [{ role: 'user', content: `Review this ${assetType}:\n\n${assetContent.slice(0, 5000)}` }],
      maxTokens: 512,
    })
    return parseClaudeJson(text)
  } catch {
    return { score: 5, sentiment: 'neutral', objection: 'Review failed', suggestedEdit: 'N/A' }
  }
}

export async function runPersonaTest(runId: string) {
  await log(runId, 'PERSONA_TEST', 'Running 15-persona review panel')

  const allPersonas = await db.select().from(personas)
  if (allPersonas.length === 0) throw new Error('No personas seeded — run seed-personas.ts first')

  const assets: Array<{ id: string; type: string; content: string }> = []

  const [advertorial] = await db.select().from(copyAssets)
    .where(and(eq(copyAssets.runId, runId), eq(copyAssets.type, 'advertorial')))
    .orderBy(desc(copyAssets.version))
    .limit(1)
  if (advertorial) assets.push({ id: advertorial.id, type: 'advertorial', content: advertorial.content })

  const [adScript] = await db.select().from(copyAssets)
    .where(and(eq(copyAssets.runId, runId), eq(copyAssets.type, 'ad_script')))
  if (adScript) assets.push({ id: adScript.id, type: 'ad_script', content: adScript.content })

  const staticAds = await db.select().from(creativeAssets)
    .where(and(eq(creativeAssets.runId, runId), eq(creativeAssets.type, 'static_ad')))
  for (const ad of staticAds) {
    if (ad.storageUrl) assets.push({ id: ad.id, type: 'static_ad', content: `Static ad (${ad.format}): ${ad.storageUrl}` })
  }

  let totalReviews = 0

  for (const asset of assets) {
    const reviews = await Promise.all(
      allPersonas.map(async (persona) => {
        const result = await reviewAsset(persona, asset.content, asset.type)
        return {
          runId,
          personaId: persona.id,
          assetId: asset.id,
          assetType: asset.type,
          score: result.score,
          sentiment: result.sentiment,
          objection: result.objection,
          suggestedEdit: result.suggestedEdit,
        }
      })
    )
    await db.insert(personaReviews).values(reviews)
    totalReviews += reviews.length
  }

  await db.update(pipelineRuns).set({ currentStage: 'FEEDBACK_AGGREGATE' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'PERSONA_TEST', `Completed ${totalReviews} reviews across ${assets.length} assets`)
}
