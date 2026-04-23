import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import { db, products, pipelineRuns, stageLogs, copyAssets, creativeAssets, funnelPages } from './db/index.js'
import { pipelineQueue } from './pipeline/queue.js'
import { StartRunInputSchema } from '@telemed/shared'
import { eq, desc } from 'drizzle-orm'

const t = initTRPC.create()

export const appRouter = t.router({
  runs: t.router({
    start: t.procedure
      .input(StartRunInputSchema)
      .mutation(async ({ input }) => {
        const [product] = await db.insert(products).values({
          name: input.productName,
          url: input.productUrl,
          targetMarket: input.targetMarket,
          brief: input.brief,
          createdBy: 'system',
        }).returning()
        const [run] = await db.insert(pipelineRuns).values({
          productId: product.id,
          createdBy: 'system',
        }).returning()
        await pipelineQueue.add('run', { runId: run.id })
        return { runId: run.id }
      }),

    list: t.procedure.query(async () =>
      db.select().from(pipelineRuns).orderBy(desc(pipelineRuns.startedAt)).limit(50)
    ),

    get: t.procedure
      .input(z.object({ runId: z.string().uuid() }))
      .query(async ({ input }) => {
        const [run] = await db.select().from(pipelineRuns).where(eq(pipelineRuns.id, input.runId))
        if (!run) throw new Error('Run not found')
        return run
      }),

    logs: t.procedure
      .input(z.object({ runId: z.string().uuid() }))
      .query(async ({ input }) =>
        db.select().from(stageLogs).where(eq(stageLogs.runId, input.runId)).orderBy(stageLogs.createdAt)
      ),

    assets: t.procedure
      .input(z.object({ runId: z.string().uuid() }))
      .query(async ({ input }) => {
        const [copy, creative, funnel] = await Promise.all([
          db.select().from(copyAssets).where(eq(copyAssets.runId, input.runId)),
          db.select().from(creativeAssets).where(eq(creativeAssets.runId, input.runId)),
          db.select().from(funnelPages).where(eq(funnelPages.runId, input.runId)),
        ])
        return { copy, creative, funnel }
      }),
  }),
})

export type AppRouter = typeof appRouter
