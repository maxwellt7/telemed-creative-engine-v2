import { db, personaReviews, pipelineRuns, copyAssets, creativeAssets, funnelPages, assetRevisionState } from '../db/index.js'
import { log } from '../pipeline/logger.js'
import { eq, and, desc } from 'drizzle-orm'
import { anthropic, callClaude, parseClaudeJson } from '../lib/anthropic.js'
import { callGeminiText, isGeminiConfigured } from '../lib/gemini.js'
import { generateStaticAd } from '../lib/fal.js'
import { uploadImage } from '../lib/storage.js'

export const TARGET_THRESHOLD = Number(process.env.TARGET_SCORE_THRESHOLD ?? 7.5)
export const FLOOR_THRESHOLD = Number(process.env.FLOOR_SCORE_THRESHOLD ?? 7.0)

export interface AssetScoreSummary {
  assetId: string
  assetType: string
  avgScore: number
  topObjections: string[]
  topSuggestedEdits: string[]
  requiresRevision: boolean
}

function avg(scores: number[]): number {
  if (scores.length === 0) return 0
  return scores.reduce((s, x) => s + x, 0) / scores.length
}

export async function computeScoreSummaries(runId: string, passNumber?: number): Promise<AssetScoreSummary[]> {
  const allReviews = await db.select().from(personaReviews).where(eq(personaReviews.runId, runId))
  const reviews = passNumber != null
    ? allReviews.filter((r) => (r.passNumber ?? 1) === passNumber)
    : allReviews

  const byAsset = new Map<string, typeof reviews>()
  for (const r of reviews) {
    if (!byAsset.has(r.assetId)) byAsset.set(r.assetId, [])
    byAsset.get(r.assetId)!.push(r)
  }

  return Array.from(byAsset.entries()).map(([assetId, assetReviews]) => {
    const avgScore = avg(assetReviews.map((r) => r.score ?? 0))
    const worst5 = [...assetReviews].sort((a, b) => (a.score ?? 0) - (b.score ?? 0)).slice(0, 5)
    return {
      assetId,
      assetType: assetReviews[0].assetType,
      avgScore,
      topObjections: worst5.map((r) => r.objection).filter(Boolean) as string[],
      topSuggestedEdits: worst5.map((r) => r.suggestedEdit).filter(Boolean) as string[],
      requiresRevision: avgScore < TARGET_THRESHOLD,
    }
  })
}

export async function evaluateAsset(runId: string, assetId: string, passNumber: number): Promise<{
  avgScore: number
  requiresRevision: boolean
  targetObjections: string[]
  targetSuggestedEdits: string[]
}> {
  const reviews = await db.select().from(personaReviews)
    .where(and(eq(personaReviews.runId, runId), eq(personaReviews.assetId, assetId)))
  const passReviews = reviews.filter((r) => (r.passNumber ?? 1) === passNumber)
  const source = passReviews.length > 0 ? passReviews : reviews

  const scoreAvg = avg(source.map((r) => r.score ?? 0))
  const requiresRevision = scoreAvg < TARGET_THRESHOLD
  const worst5 = [...source].sort((a, b) => (a.score ?? 0) - (b.score ?? 0)).slice(0, 5)

  return {
    avgScore: scoreAvg,
    requiresRevision,
    targetObjections: worst5.map((r) => r.objection).filter(Boolean) as string[],
    targetSuggestedEdits: worst5.map((r) => r.suggestedEdit).filter(Boolean) as string[],
  }
}

export async function reviseAsset(
  runId: string,
  assetId: string,
  assetType: string,
  feedback: { objections: string[]; suggestedEdits: string[] },
): Promise<void> {
  switch (assetType) {
    case 'advertorial': return reviseAdvertorial(runId, assetId, feedback)
    case 'ad_script': return reviseAdScripts(runId, assetId, feedback)
    case 'static_ad': return reviseStaticAd(runId, assetId, feedback)
    case 'video_draft': return reviseVideoDraft(runId, assetId, feedback)
    case 'video_final': return reviseVideoFinal(runId, assetId, feedback)
    case 'funnel_page': return reviseFunnelPage(runId, assetId, feedback)
    default: throw new Error(`No reviser for asset type: ${assetType}`)
  }
}

async function reviseAdvertorial(
  runId: string,
  assetId: string,
  feedback: { objections: string[]; suggestedEdits: string[] },
): Promise<void> {
  const [asset] = await db.select().from(copyAssets).where(eq(copyAssets.id, assetId))
  if (!asset) throw new Error(`Advertorial asset ${assetId} not found`)

  const revisionPrompt = `You are revising a telemedicine advertorial based on persona feedback.
Preserve the overall structure, voice, and elements that scored well.
Focus edits specifically on the objections listed.

TOP OBJECTIONS:
${feedback.objections.join('\n')}

SUGGESTED FIXES:
${feedback.suggestedEdits.join('\n')}

ORIGINAL ADVERTORIAL:
${asset.content}

Return the complete revised advertorial. If the original is HTML, return HTML. If markdown, return markdown.`

  let revised: string
  if (isGeminiConfigured() && asset.content.trimStart().startsWith('<article')) {
    try {
      revised = await callGeminiText({
        system: 'You are a direct-response copywriter revising telemedicine content based on persona feedback. Preserve structure and voice while addressing each objection.',
        prompt: revisionPrompt,
        maxOutputTokens: 8192,
        temperature: 0.7,
      })
    } catch {
      revised = await callClaude(anthropic, {
        model: 'claude-opus-4-7',
        system: 'You are a direct-response copywriter revising content based on persona feedback.',
        messages: [{ role: 'user', content: revisionPrompt }],
        maxTokens: 8192,
      })
    }
  } else {
    revised = await callClaude(anthropic, {
      model: 'claude-opus-4-7',
      system: 'You are a direct-response copywriter revising content based on persona feedback.',
      messages: [{ role: 'user', content: revisionPrompt }],
      maxTokens: 8192,
    })
  }

  await db.insert(copyAssets).values({
    runId,
    type: 'advertorial',
    content: revised,
    version: (asset.version ?? 1) + 1,
    status: 'revised',
  })
}

async function reviseAdScripts(
  runId: string,
  assetId: string,
  feedback: { objections: string[]; suggestedEdits: string[] },
): Promise<void> {
  const [asset] = await db.select().from(copyAssets).where(eq(copyAssets.id, assetId))
  if (!asset) throw new Error(`Ad script asset ${assetId} not found`)

  const revised = await callClaude(anthropic, {
    model: 'claude-sonnet-4-6',
    system: `You are revising telemedicine ad scripts based on persona feedback.
Return ONLY valid JSON — same array structure as the input scripts.`,
    messages: [{
      role: 'user',
      content: `Revise these ad scripts to address the following objections.

TOP OBJECTIONS:
${feedback.objections.join('\n')}

SUGGESTED FIXES:
${feedback.suggestedEdits.join('\n')}

ORIGINAL SCRIPTS:
${asset.content}

Return the complete revised JSON array now.`,
    }],
    maxTokens: 8192,
  })

  await db.insert(copyAssets).values({
    runId,
    type: 'ad_script',
    content: revised,
    version: (asset.version ?? 1) + 1,
    status: 'revised',
  })
}

async function reviseStaticAd(
  runId: string,
  assetId: string,
  feedback: { objections: string[]; suggestedEdits: string[] },
): Promise<void> {
  const [asset] = await db.select().from(creativeAssets).where(eq(creativeAssets.id, assetId))
  if (!asset) throw new Error(`Static ad asset ${assetId} not found`)

  const [scriptAsset] = await db.select().from(copyAssets)
    .where(and(eq(copyAssets.runId, runId), eq(copyAssets.type, 'ad_script')))
  const scripts = scriptAsset ? (parseClaudeJson(scriptAsset.content) as Array<{ imagePrompt?: string }>) : []
  const originalPrompt = scripts[0]?.imagePrompt ?? 'Professional telemedicine advertisement'

  const refinedPrompt = await callClaude(anthropic, {
    model: 'claude-haiku-4-5-20251001',
    system: 'You are refining image generation prompts for telemedicine ads based on feedback. Return only the improved prompt, no explanation.',
    messages: [{
      role: 'user',
      content: `Original prompt: ${originalPrompt}

Objections to address:
${feedback.objections.join('\n')}

Improve the prompt to address these concerns while keeping it suitable for Flux image generation. Return only the revised prompt.`,
    }],
    maxTokens: 512,
  })

  try {
    const format = (asset.format as '1:1' | '4:5' | '9:16') ?? '1:1'
    const result = await generateStaticAd(refinedPrompt, format)
    await db.insert(creativeAssets).values({
      runId,
      type: 'static_ad',
      storageUrl: result.imageUrl,
      format,
      status: 'complete',
    })
  } catch (err) {
    await log(runId, 'REVISION', `Static ad regeneration failed (${(err as Error).message}) — keeping original`, 'warn')
  }
}

async function reviseVideoDraft(
  runId: string,
  assetId: string,
  feedback: { objections: string[]; suggestedEdits: string[] },
): Promise<void> {
  await log(runId, 'REVISION', 'Video draft revision skipped — video regeneration requires premium Fal.ai tier', 'warn')
}

async function reviseVideoFinal(
  runId: string,
  assetId: string,
  feedback: { objections: string[]; suggestedEdits: string[] },
): Promise<void> {
  await log(runId, 'REVISION', 'Video final revision skipped — video regeneration requires premium Fal.ai tier', 'warn')
}

async function reviseFunnelPage(
  runId: string,
  assetId: string,
  feedback: { objections: string[]; suggestedEdits: string[] },
): Promise<void> {
  const [page] = await db.select().from(funnelPages).where(eq(funnelPages.runId, runId))
  if (!page) throw new Error(`Funnel page not found for run ${runId}`)

  const revisionPrompt = `You are revising a telemedicine funnel page based on persona feedback.
Keep the same overall structure. Address each objection specifically.

TOP OBJECTIONS:
${feedback.objections.join('\n')}

SUGGESTED FIXES:
${feedback.suggestedEdits.join('\n')}

ORIGINAL HTML:
${page.htmlContent.slice(0, 12000)}

Return the complete revised HTML starting with <!DOCTYPE html>.`

  let revised: string
  if (isGeminiConfigured()) {
    try {
      revised = await callGeminiText({
        system: 'You are a direct-response web developer revising a telemedicine funnel page. Output only valid HTML.',
        prompt: revisionPrompt,
        maxOutputTokens: 8192,
      })
    } catch {
      revised = await callClaude(anthropic, {
        model: 'claude-sonnet-4-6',
        system: 'You are revising a telemedicine funnel page. Output only valid HTML starting with <!DOCTYPE html>.',
        messages: [{ role: 'user', content: revisionPrompt }],
        maxTokens: 8192,
      })
    }
  } else {
    revised = await callClaude(anthropic, {
      model: 'claude-sonnet-4-6',
      system: 'You are revising a telemedicine funnel page. Output only valid HTML starting with <!DOCTYPE html>.',
      messages: [{ role: 'user', content: revisionPrompt }],
      maxTokens: 8192,
    })
  }

  await db.update(funnelPages).set({ htmlContent: revised, status: 'revised' }).where(eq(funnelPages.runId, runId))
}

export async function runQAFinal(runId: string) {
  await log(runId, 'QA_FINAL', 'Final QA check')

  const revisionStates = await db.select().from(assetRevisionState).where(eq(assetRevisionState.runId, runId))
  const summaries = await computeScoreSummaries(runId)
  const overall = summaries.reduce((s, x) => s + x.avgScore, 0) / (summaries.length || 1)

  const passed = revisionStates.filter((s) => s.status === 'passed').length
  const plateaued = revisionStates.filter((s) => s.status === 'plateaued').length
  const forceDelivered = revisionStates.filter((s) => s.status === 'force_delivered').length
  const total = revisionStates.length || summaries.length

  if (forceDelivered > 0) {
    await log(runId, 'QA_FINAL', `${forceDelivered} asset(s) force-delivered below threshold — human review required`, 'warn')
  }
  if (plateaued > 0) {
    await log(runId, 'QA_FINAL', `${plateaued} asset(s) plateaued before reaching threshold`, 'warn')
  }

  await db.update(pipelineRuns).set({ currentStage: 'DELIVERY' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'QA_FINAL', `QA complete. ${passed}/${total} passed. ${plateaued} plateaued. ${forceDelivered} force-delivered. Overall avg: ${overall.toFixed(2)}/10`, 'info', {
    summaries: summaries.map((s) => ({ assetType: s.assetType, avgScore: s.avgScore })),
    revisionStates: revisionStates.map((s) => ({ assetType: s.assetType, status: s.status, currentPass: s.currentPass, lastAvgScore: s.lastAvgScore })),
  })
}
