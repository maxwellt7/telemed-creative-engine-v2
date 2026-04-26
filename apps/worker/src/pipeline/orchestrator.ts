import { db, pipelineRuns, products } from '../db/index.js'
import { eq } from 'drizzle-orm'
import type { PipelineStage } from '@telemed/shared'
import { log } from './logger.js'
import { runOfferProfiler } from '../agents/offer-profiler.js'
import { runAvatarAgent } from '../agents/avatar-agent.js'
import { runManifoldAgent } from '../agents/manifold-agent.js'
import { runCompetitorDiscover, runAdvertorialDiscover } from '../agents/research-agent.js'
import { runAdvertorialFetch, runReverseEngineer } from '../agents/analyst-agent.js'
import { runReverseBrief, runCopyConcepts } from '../agents/brief-writer.js'
import { runAdvertorialDesign } from '../agents/advertorial-designer.js'
import { runCopyChief } from '../agents/copy-chief.js'
import { runCreativeDirection, runAdScripts } from '../agents/creative-director.js'
import { runFunnelBuilder } from '../agents/funnel-builder.js'
import { runImageAgent } from '../agents/image-agent.js'
import { runVideoDraft, runVideoFinal } from '../agents/video-agent.js'
import { runPersonaTest } from '../agents/persona-agents.js'
import { runRevisionLoop } from '../agents/revision-loop.js'
import { runQAFinal } from '../agents/qa-agent.js'
import { runClickUpPublisher } from '../agents/clickup-publisher.js'

export async function runPipeline(runId: string) {
  const [run] = await db.select().from(pipelineRuns).where(eq(pipelineRuns.id, runId))
  if (!run) throw new Error(`Run ${runId} not found`)

  const [product] = await db.select().from(products).where(eq(products.id, run.productId))
  if (!product) throw new Error(`Product not found for run ${runId}`)

  await db.update(pipelineRuns).set({ status: 'running', currentStage: 'INTAKE' }).where(eq(pipelineRuns.id, runId))

  const p = { name: product.name, url: product.url, brief: product.brief, targetMarket: product.targetMarket }

  try {
    await log(runId, 'INTAKE', `Pipeline started for ${product.name}`)

    await runOfferProfiler(runId, p)          // Stage 2
    await runAvatarAgent(runId)               // Stage 3
    await runManifoldAgent(runId)             // Stage 3b
    await runCompetitorDiscover(runId, p)     // Stage 4
    await runAdvertorialDiscover(runId, p)    // Stage 5
    await runAdvertorialFetch(runId)          // Stage 6
    await runReverseEngineer(runId)           // Stage 7
    await runReverseBrief(runId)              // Stage 8
    await runCopyConcepts(runId)              // Stage 9
    await runAdvertorialDesign(runId)         // Stage 10 NEW
    await runCopyChief(runId)                 // Stage 11
    await runCreativeDirection(runId)         // Stage 12
    await runAdScripts(runId)                 // Stage 13
    await runFunnelBuilder(runId)             // Stage 14
    await runImageAgent(runId)                // Stage 15
    await runVideoDraft(runId)                // Stage 16
    await runVideoFinal(runId)                // Stage 17

    await runPersonaTest(runId)               // Stage 18 — initial review of all assets
    await runRevisionLoop(runId)              // Stages 19–20 — per-asset iterative revision

    await runQAFinal(runId)                   // Stage 21
    await runClickUpPublisher(runId)          // Stage 22

  } catch (err) {
    const [failedRun] = await db.select().from(pipelineRuns).where(eq(pipelineRuns.id, runId)).catch(() => [null])
    await db.update(pipelineRuns).set({ status: 'failed' }).where(eq(pipelineRuns.id, runId))
    await log(runId, (failedRun?.currentStage ?? 'INTAKE') as PipelineStage, `Pipeline failed: ${String(err)}`, 'error')
    throw err
  }
}
