import { db, pipelineRuns } from '../db/index.js'
import { eq } from 'drizzle-orm'
import { log } from './logger.js'

export async function runPipeline(runId: string) {
  await db.update(pipelineRuns)
    .set({ status: 'running', currentStage: 'INTAKE' })
    .where(eq(pipelineRuns.id, runId))
  await log(runId, 'INTAKE', 'Pipeline started — stages wired in Task 18')
}
