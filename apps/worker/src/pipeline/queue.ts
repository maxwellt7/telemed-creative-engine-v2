import { Queue, Worker as BullWorker } from 'bullmq'
import { Redis as IORedis } from 'ioredis'

export const connection = new IORedis(process.env.REDIS_URL!, {
  maxRetriesPerRequest: null,
})

export const pipelineQueue = new Queue('pipeline', { connection })

export function createPipelineWorker(processor: (runId: string) => Promise<void>) {
  return new BullWorker(
    'pipeline',
    async (job) => processor(job.data.runId as string),
    { connection, concurrency: 2 }
  )
}
