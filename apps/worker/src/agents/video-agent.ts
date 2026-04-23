import { parseClaudeJson } from '../lib/anthropic.js'
import { generateVideoDraft, generateVideoFinal, generateVoiceover } from '../lib/fal.js'
import { db, copyAssets, creativeAssets, pipelineRuns } from '../db/index.js'
import { log } from '../pipeline/logger.js'
import { eq, and } from 'drizzle-orm'

function extractVO(script: string): string {
  return script.split('\n')
    .filter((l) => /^VO:/i.test(l.trim()))
    .map((l) => l.replace(/^VO:/i, '').trim())
    .join(' ') || script.slice(0, 400)
}

function scriptToVideoPrompt(script: string): string {
  return script.split('\n')
    .filter((l) => /^OPEN:|^CUT:|^SCENE:/i.test(l.trim()))
    .map((l) => l.replace(/^(OPEN:|CUT:|SCENE:)/i, '').trim())
    .slice(0, 4)
    .join('. ')
    .concat('. Cinematic, professional medical ad, telemedicine brand, 4K quality.')
    || 'Professional telemedicine doctor commercial. Cinematic lighting, high quality.'
}

export async function runVideoDraft(runId: string) {
  await log(runId, 'VIDEO_DRAFT', 'Generating draft video via Fal.ai Minimax')

  const [scriptAsset] = await db.select().from(copyAssets)
    .where(and(eq(copyAssets.runId, runId), eq(copyAssets.type, 'ad_script')))
  if (!scriptAsset) throw new Error(`No ad scripts for run ${runId}`)

  const scripts = parseClaudeJson(scriptAsset.content) as Array<{ script30s: string; concept: string }>
  const primary = scripts[0]
  if (!primary) throw new Error('No primary script')

  const voScript = extractVO(primary.script30s)
  const videoPrompt = scriptToVideoPrompt(primary.script30s)

  const audioUrl = await generateVoiceover(voScript)
  const draftUrl = await generateVideoDraft(videoPrompt, audioUrl)

  await db.insert(creativeAssets).values({
    runId, type: 'video_draft', storageUrl: draftUrl, status: 'complete',
  })

  await db.update(pipelineRuns).set({ currentStage: 'VIDEO_FINAL' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'VIDEO_DRAFT', `Draft video: ${draftUrl}`)
}

export async function runVideoFinal(runId: string) {
  await log(runId, 'VIDEO_FINAL', 'Generating final video via Fal.ai Kling 2.0')

  const [scriptAsset] = await db.select().from(copyAssets)
    .where(and(eq(copyAssets.runId, runId), eq(copyAssets.type, 'ad_script')))
  if (!scriptAsset) throw new Error(`No ad scripts for run ${runId}`)

  const scripts = parseClaudeJson(scriptAsset.content) as Array<{ script30s: string }>
  const primary = scripts[0]
  if (!primary) throw new Error('No primary script')

  const videoPrompt = scriptToVideoPrompt(primary.script30s) + ' High production value, master quality.'
  const finalUrl = await generateVideoFinal(videoPrompt)

  await db.insert(creativeAssets).values({
    runId, type: 'video_final', storageUrl: finalUrl, status: 'complete',
  })

  await db.update(pipelineRuns).set({ currentStage: 'PERSONA_TEST' }).where(eq(pipelineRuns.id, runId))
  await log(runId, 'VIDEO_FINAL', `Final video: ${finalUrl}`)
}
