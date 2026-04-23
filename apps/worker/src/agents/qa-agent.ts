import { db, personaReviews, pipelineRuns, copyAssets } from '../db/index.js'
import { log } from '../pipeline/logger.js'
import { eq, and } from 'drizzle-orm'
import { anthropic, callClaude } from '../lib/anthropic.js'

export interface AssetScoreSummary {
  assetId: string
  assetType: string
  avgScore: number
  topObjections: string[]
  topSuggestedEdits: string[]
  requiresRevision: boolean
}

export function shouldRevise(avgScore: number): boolean {
  return avgScore < 7.0
}

export async function computeScoreSummaries(runId: string): Promise<AssetScoreSummary[]> {
  const reviews = await db.select().from(personaReviews).where(eq(personaReviews.runId, runId))

  const byAsset = new Map<string, typeof reviews>()
  for (const r of reviews) {
    if (!byAsset.has(r.assetId)) byAsset.set(r.assetId, [])
    byAsset.get(r.assetId)!.push(r)
  }

  return Array.from(byAsset.entries()).map(([assetId, assetReviews]) => {
    const avgScore = assetReviews.reduce((s, r) => s + (r.score ?? 0), 0) / assetReviews.length
    const worst5 = [...assetReviews].sort((a, b) => (a.score ?? 0) - (b.score ?? 0)).slice(0, 5)
    return {
      assetId,
      assetType: assetReviews[0].assetType,
      avgScore,
      topObjections: worst5.map((r) => r.objection).filter(Boolean) as string[],
      topSuggestedEdits: worst5.map((r) => r.suggestedEdit).filter(Boolean) as string[],
      requiresRevision: shouldRevise(avgScore),
    }
  })
}

export async function runRevision(runId: string, revisionPass: number): Promise<boolean> {
  await log(runId, 'FEEDBACK_AGGREGATE', `Aggregating scores for revision pass ${revisionPass + 1}`)

  const summaries = await computeScoreSummaries(runId)
  const failing = summaries.filter((s) => s.requiresRevision)
  const overall = summaries.reduce((s, x) => s + x.avgScore, 0) / (summaries.length || 1)

  await log(runId, 'FEEDBACK_AGGREGATE', `Overall avg: ${overall.toFixed(2)}/10 — ${failing.length}/${summaries.length} assets need revision`, 'info', {
    summaries: summaries.map((s) => ({ assetId: s.assetId, avgScore: s.avgScore })),
  })

  if (failing.length === 0) {
    await log(runId, 'REVISION', 'All assets passed — no revision needed')
    return false
  }

  if (revisionPass >= 3) {
    await log(runId, 'REVISION', 'Max 3 revisions reached — delivering with QA note', 'warn')
    return false
  }

  for (const summary of failing) {
    if (summary.assetType === 'advertorial') {
      await log(runId, 'REVISION', `Revising advertorial (avg: ${summary.avgScore.toFixed(1)}/10)`)
      const [asset] = await db.select().from(copyAssets)
        .where(and(eq(copyAssets.id, summary.assetId), eq(copyAssets.runId, runId)))
      if (!asset) continue

      const revised = await callClaude(anthropic, {
        model: 'claude-opus-4-7',
        system: 'You are a direct-response copywriter revising content based on persona feedback. Keep the same structure but address each objection. Output ONLY the revised advertorial.',
        messages: [{
          role: 'user',
          content: `Revise this advertorial.\n\nTop objections:\n${summary.topObjections.join('\n')}\n\nSuggested fixes:\n${summary.topSuggestedEdits.join('\n')}\n\nOriginal:\n${asset.content}`,
        }],
        maxTokens: 8192,
      })

      await db.insert(copyAssets).values({
        runId, type: 'advertorial', content: revised, version: revisionPass + 2, status: 'revised',
      })
    }
  }

  await db.update(pipelineRuns)
    .set({ revisionPass: revisionPass + 1, currentStage: 'PERSONA_TEST' })
    .where(eq(pipelineRuns.id, runId))

  return true
}

export async function runQAFinal(runId: string) {
  await log(runId, 'QA_FINAL', 'Final QA check')

  const summaries = await computeScoreSummaries(runId)
  const overall = summaries.reduce((s, x) => s + x.avgScore, 0) / (summaries.length || 1)
  const passing = summaries.filter((s) => !s.requiresRevision).length

  await db.update(pipelineRuns).set({ currentStage: 'DELIVERY' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'QA_FINAL', `QA complete. ${passing}/${summaries.length} passing. Overall: ${overall.toFixed(2)}/10`, 'info', {
    summaries: summaries.map((s) => ({ assetType: s.assetType, avgScore: s.avgScore })),
  })
}
