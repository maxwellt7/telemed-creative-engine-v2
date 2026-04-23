import { createAdvertorialTask, createCreativeTask } from '../lib/clickup.js'
import { db, pipelineRuns, products, copyAssets, creativeAssets, funnelPages, clickupDeliverables, personaReviews } from '../db/index.js'
import { log } from '../pipeline/logger.js'
import { eq, and, desc } from 'drizzle-orm'

export async function runClickUpPublisher(runId: string) {
  await log(runId, 'DELIVERY', 'Publishing to ClickUp')

  const [run] = await db.select().from(pipelineRuns).where(eq(pipelineRuns.id, runId))
  if (!run) throw new Error(`Run ${runId} not found`)

  const [product] = await db.select().from(products).where(eq(products.id, run.productId))
  if (!product) throw new Error(`Product not found for run ${runId}`)

  const [advertorial] = await db.select().from(copyAssets)
    .where(and(eq(copyAssets.runId, runId), eq(copyAssets.type, 'advertorial')))
    .orderBy(desc(copyAssets.version))
    .limit(1)

  const [funnelPage] = await db.select().from(funnelPages).where(eq(funnelPages.runId, runId))

  const reviews = await db.select().from(personaReviews).where(eq(personaReviews.runId, runId))
  const avgScore = reviews.length > 0
    ? reviews.reduce((s, r) => s + (r.score ?? 0), 0) / reviews.length
    : 0

  if (advertorial && funnelPage?.vercelUrl) {
    const task = await createAdvertorialTask({
      productName: product.name,
      advertorialUrl: funnelPage.vercelUrl,
      copyDocContent: advertorial.content.slice(0, 5000),
      avgPersonaScore: avgScore,
    })
    await db.insert(clickupDeliverables).values({
      runId, list: 'advertorial', taskId: task.id, taskUrl: task.url,
    })
    await log(runId, 'DELIVERY', `Advertorial task: ${task.url}`)
  }

  const staticAds = await db.select().from(creativeAssets)
    .where(and(eq(creativeAssets.runId, runId), eq(creativeAssets.type, 'static_ad')))
  const videoFinals = await db.select().from(creativeAssets)
    .where(and(eq(creativeAssets.runId, runId), eq(creativeAssets.type, 'video_final')))

  for (const asset of [...staticAds, ...videoFinals]) {
    if (!asset.storageUrl) continue
    const task = await createCreativeTask({
      productName: product.name,
      assetType: asset.type === 'static_ad' ? 'Static Ad' : 'Video',
      storageUrl: asset.storageUrl,
      format: asset.format ?? undefined,
    })
    await db.insert(clickupDeliverables).values({
      runId, list: 'creative', taskId: task.id, taskUrl: task.url,
    })
  }

  await db.update(pipelineRuns)
    .set({ status: 'complete', currentStage: 'DELIVERY', completedAt: new Date() })
    .where(eq(pipelineRuns.id, runId))

  const advertorialCount = (advertorial && funnelPage?.vercelUrl) ? 1 : 0
  const totalTasks = advertorialCount + staticAds.length + videoFinals.length
  await log(runId, 'DELIVERY', `Pipeline complete — ${totalTasks} tasks created in ClickUp`)
}
