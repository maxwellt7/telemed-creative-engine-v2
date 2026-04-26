import { anthropic, callClaude, parseClaudeJson } from '../lib/anthropic.js'
import { db, personas, copyAssets, creativeAssets, funnelPages, personaReviews, pipelineRuns, offerProfiles } from '../db/index.js'
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

function stripHtml(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function buildPersonaSystem(persona: PersonaRow, manifoldContext?: string): string {
  return `You are ${persona.name}, a real person (${persona.archetype}).

Demographics: ${JSON.stringify(persona.demographicsJson)}
Psychographics: ${JSON.stringify(persona.psychographicsJson)}
Your primary fear: "${persona.primaryFear}"
What you value most: ${persona.primaryCurrency}
${manifoldContext ?? ''}
You are a direct-response marketing critic evaluating how EFFECTIVELY this advertisement does its job.
Score based on copy craft — NOT whether you personally would buy, but how well the copy:
1. Identifies and speaks to your specific pain points and fears
2. Presents a believable mechanism or solution
3. Builds credibility with evidence, specificity, and real trust signals
4. Creates emotional desire and urgency appropriate to the offer

Score calibration:
10 = Exceptional — directly addresses my exact concerns with compelling, specific evidence
7-9 = Strong — speaks to me clearly, mostly credible, minor gaps
5-6 = Adequate — relevant but vague, missing key proof elements
3-4 = Weak — doesn't speak to my pain, generic claims, low trust
1-2 = Ineffective — wrong audience, empty promises, zero credibility

Your OBJECTION must be the single most important specific gap — name exactly what's missing or wrong.
Your SUGGESTED EDIT must be one concrete change with example wording, not general advice.
Your WHAT WORKED must name the single strongest element the copy already does well (be specific).

Respond ONLY with valid JSON:
{
  "score": number,
  "sentiment": "positive" | "neutral" | "negative",
  "objection": "string — the single most important gap (be specific, not generic)",
  "suggestedEdit": "string — one concrete change with example text",
  "whatWorked": "string — the single strongest element already working well"
}`
}

async function reviewAsset(
  persona: PersonaRow,
  assetContent: string,
  assetType: string,
  manifoldContext?: string,
): Promise<{ score: number; sentiment: string; objection: string; suggestedEdit: string; whatWorked: string }> {
  try {
    const text = await callClaude(anthropic, {
      model: 'claude-sonnet-4-6',
      system: buildPersonaSystem(persona, manifoldContext),
      messages: [{ role: 'user', content: `Review this ${assetType}:\n\n${assetContent.slice(0, 25000)}` }],
      maxTokens: 512,
    })
    const parsed = parseClaudeJson(text)
    return { whatWorked: '', ...parsed }
  } catch {
    return { score: 5, sentiment: 'neutral', objection: 'Review failed', suggestedEdit: 'N/A', whatWorked: '' }
  }
}

async function loadAllAssets(runId: string): Promise<Array<{ id: string; type: string; content: string }>> {
  const assets: Array<{ id: string; type: string; content: string }> = []

  const [advertorial] = await db.select().from(copyAssets)
    .where(and(eq(copyAssets.runId, runId), eq(copyAssets.type, 'advertorial')))
    .orderBy(desc(copyAssets.version))
    .limit(1)
  if (advertorial) assets.push({ id: advertorial.id, type: 'advertorial', content: advertorial.content })

  const [adScript] = await db.select().from(copyAssets)
    .where(and(eq(copyAssets.runId, runId), eq(copyAssets.type, 'ad_script')))
    .orderBy(desc(copyAssets.version))
    .limit(1)
  if (adScript) assets.push({ id: adScript.id, type: 'ad_script', content: adScript.content })

  const [funnel] = await db.select().from(funnelPages).where(eq(funnelPages.runId, runId))
  if (funnel) {
    const textContent = stripHtml(funnel.htmlContent)
    assets.push({ id: funnel.id, type: 'funnel_page', content: textContent })
  }

  return assets
}

async function loadAssetById(runId: string, assetId: string, assetType: string): Promise<{ id: string; type: string; content: string } | null> {
  if (assetType === 'advertorial' || assetType === 'ad_script') {
    const [asset] = await db.select().from(copyAssets)
      .where(and(eq(copyAssets.runId, runId), eq(copyAssets.id, assetId)))
    if (!asset) return null
    return { id: asset.id, type: asset.type, content: asset.content }
  }
  if (assetType === 'static_ad' || assetType === 'video_draft' || assetType === 'video_final') {
    const [asset] = await db.select().from(creativeAssets)
      .where(and(eq(creativeAssets.runId, runId), eq(creativeAssets.id, assetId)))
    if (!asset?.storageUrl) return null
    return { id: asset.id, type: asset.type, content: `${asset.type} (${asset.format}): ${asset.storageUrl}` }
  }
  if (assetType === 'funnel_page') {
    const [page] = await db.select().from(funnelPages).where(eq(funnelPages.runId, runId))
    if (!page) return null
    const textContent = stripHtml(page.htmlContent)
    return { id: page.id, type: 'funnel_page', content: textContent }
  }
  return null
}

function buildManifoldContext(manifoldDeep: any): string {
  if (!manifoldDeep) return ''
  const triggers = (manifoldDeep.ejectionTriggers ?? []).slice(0, 5)
    .map((t: any) => `- NEVER: "${t.trigger}" — ${t.whyItEjects}`)
    .join('\n')
  const resonant = (manifoldDeep.languagePatterns?.exactPhrases ?? []).slice(0, 4).join(' | ')
  const avoid = (manifoldDeep.languagePatterns?.wordsToAvoid ?? []).slice(0, 6).join(', ')
  return `
## PRODUCT-SPECIFIC CALIBRATION (use these to score accurately)
EJECTION TRIGGERS — penalize heavily if the copy does any of these:
${triggers}
RESONANT LANGUAGE — reward copy that uses phrases like: ${resonant}
WORDS THAT LOSE THIS AUDIENCE — penalize if you see: ${avoid}
`
}

export async function runPersonaTest(runId: string) {
  await log(runId, 'PERSONA_TEST', 'Running 15-persona review panel')

  const allPersonas = await db.select().from(personas)
  if (allPersonas.length === 0) throw new Error('No personas seeded — run seed-personas.ts first')

  const [profile] = await db.select().from(offerProfiles).where(eq(offerProfiles.runId, runId))
  const manifoldContext = buildManifoldContext(profile?.manifoldDeepJson as any)

  const assets = await loadAllAssets(runId)
  let totalReviews = 0

  for (const asset of assets) {
    const reviews = await Promise.all(
      allPersonas.map(async (persona) => {
        const result = await reviewAsset(persona, asset.content, asset.type, manifoldContext)
        return {
          runId,
          personaId: persona.id,
          assetId: asset.id,
          assetType: asset.type,
          score: result.score,
          sentiment: result.sentiment,
          objection: result.objection,
          suggestedEdit: result.suggestedEdit,
          passNumber: 1,
        }
      })
    )
    await db.insert(personaReviews).values(reviews)
    totalReviews += reviews.length
  }

  await db.update(pipelineRuns).set({ currentStage: 'FEEDBACK_AGGREGATE' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'PERSONA_TEST', `Completed ${totalReviews} reviews across ${assets.length} assets`)
}

export async function runPersonaTestForAsset(runId: string, assetId: string, assetType: string, passNumber: number): Promise<void> {
  await log(runId, 'PERSONA_TEST', `Reviewing ${assetType} (pass ${passNumber})`)

  const allPersonas = await db.select().from(personas)
  if (allPersonas.length === 0) throw new Error('No personas seeded')

  const [profile] = await db.select().from(offerProfiles).where(eq(offerProfiles.runId, runId))
  const manifoldContext = buildManifoldContext(profile?.manifoldDeepJson as any)

  const asset = await loadAssetById(runId, assetId, assetType)
  if (!asset) {
    await log(runId, 'PERSONA_TEST', `Asset ${assetId} not found for re-review — skipping`, 'warn')
    return
  }

  const reviews = await Promise.all(
    allPersonas.map(async (persona) => {
      const result = await reviewAsset(persona, asset.content, asset.type, manifoldContext)
      return {
        runId,
        personaId: persona.id,
        assetId: asset.id,
        assetType: asset.type,
        score: result.score,
        sentiment: result.sentiment,
        objection: result.objection,
        suggestedEdit: result.suggestedEdit,
        passNumber,
      }
    })
  )

  await db.insert(personaReviews).values(reviews)
  await log(runId, 'PERSONA_TEST', `Completed ${reviews.length} reviews for ${assetType} pass ${passNumber}`)
}
