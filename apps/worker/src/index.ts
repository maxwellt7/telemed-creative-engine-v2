import express from 'express'
import cors from 'cors'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import { appRouter } from './router.js'
import { createPipelineWorker } from './pipeline/queue.js'
import { runPipeline } from './pipeline/orchestrator.js'
import { seedPersonas } from './db/seed-personas.js'

const app = express()
app.use(cors())
app.use(express.json())
// Auth guard: only enforced when API_SECRET is set (allows local dev without the env var).
// Note: client component calls (runs.start mutation) bypass auth — acceptable for MVP.
app.use('/trpc', (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const secret = process.env.API_SECRET
  if (secret && req.headers['x-api-secret'] !== secret) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }
  next()
}, createExpressMiddleware({ router: appRouter }))
app.get('/health', (_req, res) => res.json({ ok: true }))

const _worker = createPipelineWorker(runPipeline)

const PORT = process.env.PORT ?? 3001

async function start() {
  await seedPersonas()
  app.listen(PORT, () => console.log(`Worker listening on ${PORT}`))
}

start().catch(console.error)
