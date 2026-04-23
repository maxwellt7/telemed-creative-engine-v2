import { parseClaudeJson } from '../lib/anthropic.js'
import { generateStaticAd } from '../lib/fal.js'
import { db, copyAssets, creativeAssets, pipelineRuns } from '../db/index.js'
import { log } from '../pipeline/logger.js'
import { eq, and } from 'drizzle-orm'

const FORMATS = ['1:1', '4:5', '9:16'] as const

export async function runImageAgent(runId: string) {
  await log(runId, 'STATIC_ADS', 'Generating static ads via Fal.ai Flux 1.1 Pro')

  const [scriptAsset] = await db.select().from(copyAssets)
    .where(and(eq(copyAssets.runId, runId), eq(copyAssets.type, 'ad_script')))

  if (!scriptAsset) throw new Error(`No ad scripts for run ${runId}`)

  const scripts = parseClaudeJson(scriptAsset.content) as Array<{ imagePrompt?: string; concept: string }>
  const primary = scripts[0]

  if (!primary?.imagePrompt) {
    await log(runId, 'STATIC_ADS', 'No image prompt found — skipping', 'warn')
    await db.update(pipelineRuns).set({ currentStage: 'VIDEO_DRAFT' }).where(eq(pipelineRuns.id, runId))
    return
  }

  const prompt = `${primary.imagePrompt}, professional medical photography, clean background, high resolution, telemedicine advertising quality`

  for (const format of FORMATS) {
    try {
      const result = await generateStaticAd(prompt, format)
      await db.insert(creativeAssets).values({
        runId, type: 'static_ad', storageUrl: result.imageUrl, format, status: 'complete',
      })
      await log(runId, 'STATIC_ADS', `Generated ${format}: ${result.imageUrl}`)
    } catch (err) {
      await log(runId, 'STATIC_ADS', `Failed ${format}: ${String(err)}`, 'warn')
    }
  }

  await db.update(pipelineRuns).set({ currentStage: 'VIDEO_DRAFT' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'STATIC_ADS', 'Static ads complete')
}
