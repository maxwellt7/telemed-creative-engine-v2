import { db, copyAssets, creativeAssets, funnelPages, assetRevisionState, pipelineRuns } from '../db/index.js'
import { log } from '../pipeline/logger.js'
import { eq, and, desc } from 'drizzle-orm'
import { evaluateAsset, reviseAsset, TARGET_THRESHOLD } from './qa-agent.js'
import { runPersonaTestForAsset } from './persona-agents.js'

const MAX_PASSES = Number(process.env.MAX_REVISION_PASSES ?? 8)
const PLATEAU_EPSILON = Number(process.env.PLATEAU_EPSILON ?? 0.3)

interface AssetRef {
  assetId: string
  assetType: string
}

async function collectAssetsInScope(runId: string): Promise<AssetRef[]> {
  const assets: AssetRef[] = []

  const [advertorial] = await db.select().from(copyAssets)
    .where(and(eq(copyAssets.runId, runId), eq(copyAssets.type, 'advertorial')))
    .orderBy(desc(copyAssets.version))
    .limit(1)
  if (advertorial) assets.push({ assetId: advertorial.id, assetType: 'advertorial' })

  const [adScript] = await db.select().from(copyAssets)
    .where(and(eq(copyAssets.runId, runId), eq(copyAssets.type, 'ad_script')))
    .orderBy(desc(copyAssets.version))
    .limit(1)
  if (adScript) assets.push({ assetId: adScript.id, assetType: 'ad_script' })

  const [funnel] = await db.select().from(funnelPages).where(eq(funnelPages.runId, runId))
  if (funnel) assets.push({ assetId: funnel.id, assetType: 'funnel_page' })

  // static_ad, video_draft, video_final are URL-only assets — text personas cannot evaluate images
  // or video, so including them in the revision loop produces meaningless scores and wastes credits.

  return assets
}

async function upsertRevisionState(
  runId: string,
  asset: AssetRef,
  updates: { currentPass: number; lastAvgScore: number; status?: string; history?: any[] },
): Promise<void> {
  const existing = await db.select().from(assetRevisionState)
    .where(and(eq(assetRevisionState.runId, runId), eq(assetRevisionState.assetId, asset.assetId)))
    .limit(1)

  if (existing.length === 0) {
    await db.insert(assetRevisionState).values({
      runId,
      assetId: asset.assetId,
      assetType: asset.assetType,
      currentPass: updates.currentPass,
      lastAvgScore: updates.lastAvgScore,
      status: updates.status ?? 'reviewing',
      history: (updates.history ?? []) as any,
    })
  } else {
    const prev = existing[0]
    const history = ((prev.history ?? []) as any[]).concat({
      pass: updates.currentPass,
      avgScore: updates.lastAvgScore,
    })
    await db.update(assetRevisionState)
      .set({
        currentPass: updates.currentPass,
        lastAvgScore: updates.lastAvgScore,
        status: updates.status ?? prev.status,
        history: history as any,
        ...(updates.status === 'passed' ? { passedAt: new Date() } : {}),
      })
      .where(and(eq(assetRevisionState.runId, runId), eq(assetRevisionState.assetId, asset.assetId)))
  }
}

async function loopUntilPassing(runId: string, asset: AssetRef): Promise<void> {
  let pass = 1
  let previousScore: number | null = null

  while (true) {
    const { avgScore, requiresRevision, targetObjections, targetSuggestedEdits } =
      await evaluateAsset(runId, asset.assetId, pass)

    await upsertRevisionState(runId, asset, { currentPass: pass, lastAvgScore: avgScore })

    await log(runId, 'FEEDBACK_AGGREGATE',
      `[${asset.assetType}] pass ${pass}: avg ${avgScore.toFixed(2)}/10 (target ≥ ${TARGET_THRESHOLD})`)

    if (!requiresRevision) {
      await upsertRevisionState(runId, asset, { currentPass: pass, lastAvgScore: avgScore, status: 'passed' })
      await log(runId, 'REVISION', `[${asset.assetType}] passed at ${avgScore.toFixed(2)}/10 on pass ${pass}`)
      return
    }

    if (previousScore !== null && avgScore - previousScore < PLATEAU_EPSILON) {
      await upsertRevisionState(runId, asset, { currentPass: pass, lastAvgScore: avgScore, status: 'plateaued' })
      await log(runId, 'REVISION',
        `[${asset.assetType}] plateaued at ${avgScore.toFixed(2)}/10 (improvement < ${PLATEAU_EPSILON}) — stopping`, 'warn')
      return
    }

    if (pass >= MAX_PASSES) {
      await upsertRevisionState(runId, asset, { currentPass: pass, lastAvgScore: avgScore, status: 'force_delivered' })
      await log(runId, 'REVISION',
        `[${asset.assetType}] hit max ${MAX_PASSES} passes at ${avgScore.toFixed(2)}/10 — force-delivering`, 'warn')
      return
    }

    previousScore = avgScore
    pass++
    await log(runId, 'REVISION', `[${asset.assetType}] revising (pass ${pass}): ${targetObjections.length} objections`)

    await reviseAsset(runId, asset.assetId, asset.assetType, {
      objections: targetObjections,
      suggestedEdits: targetSuggestedEdits,
    })

    // Re-test just this asset at the new pass number
    const updatedAssetId = await getLatestAssetId(runId, asset.assetType, asset.assetId)
    await runPersonaTestForAsset(runId, updatedAssetId, asset.assetType, pass)
    // Update assetId reference for next evaluate call
    asset = { ...asset, assetId: updatedAssetId }
  }
}

async function getLatestAssetId(runId: string, assetType: string, originalId: string): Promise<string> {
  if (assetType === 'advertorial' || assetType === 'ad_script') {
    const [latest] = await db.select().from(copyAssets)
      .where(and(eq(copyAssets.runId, runId), eq(copyAssets.type, assetType)))
      .orderBy(desc(copyAssets.version))
      .limit(1)
    return latest?.id ?? originalId
  }
  if (assetType === 'static_ad' || assetType === 'video_draft' || assetType === 'video_final') {
    const rows = await db.select().from(creativeAssets)
      .where(and(eq(creativeAssets.runId, runId), eq(creativeAssets.type, assetType)))
    return rows.at(-1)?.id ?? originalId
  }
  if (assetType === 'funnel_page') {
    const [page] = await db.select().from(funnelPages).where(eq(funnelPages.runId, runId))
    return page?.id ?? originalId
  }
  return originalId
}

export async function runRevisionLoop(runId: string): Promise<void> {
  await log(runId, 'FEEDBACK_AGGREGATE', 'Starting per-asset revision loop')

  const assets = await collectAssetsInScope(runId)
  await log(runId, 'FEEDBACK_AGGREGATE', `${assets.length} assets in revision scope`)

  for (const asset of assets) {
    await loopUntilPassing(runId, asset)
  }

  await log(runId, 'FEEDBACK_AGGREGATE', 'All assets settled — proceeding to QA_FINAL')
}
