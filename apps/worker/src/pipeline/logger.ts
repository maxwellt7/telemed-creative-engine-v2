import { db, stageLogs } from '../db/index.js'
import type { PipelineStage, LogLevel } from '@telemed/shared'

export async function log(
  runId: string,
  stage: PipelineStage,
  message: string,
  level: LogLevel = 'info',
  metadata?: Record<string, unknown>
) {
  await db.insert(stageLogs).values({
    runId,
    stage,
    level,
    message,
    metadataJson: metadata ?? null,
  })
}
