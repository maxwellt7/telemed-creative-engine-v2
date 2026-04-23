import { describe, it, expect, vi } from 'vitest'
import { runClickUpPublisher } from './clickup-publisher.js'

const mockRun = { id: 'run-1', productId: 'prod-1', status: 'running', currentStage: 'DELIVERY' as const, revisionPass: 0, startedAt: new Date(), completedAt: null, createdBy: 'system' }
const mockProduct = { id: 'prod-1', name: 'Hims', url: 'https://hims.com', brief: 'ED', targetMarket: 'US men', vertical: 'telemedicine' as const, createdBy: 'system', createdAt: new Date() }
const mockAdvertorial = { id: 'a1', runId: 'run-1', type: 'advertorial' as const, content: 'Lorem ipsum ad copy', version: 1, score: null, status: 'final' as const }
const mockFunnelPage = { id: 'f1', runId: 'run-1', htmlContent: '<html/>', vercelDeploymentId: 'dpl-1', vercelUrl: 'https://preview.vercel.app/run-1', status: 'deployed' as const }

vi.mock('../lib/clickup', () => ({
  createAdvertorialTask: vi.fn().mockResolvedValue({ id: 'cu-1', url: 'https://app.clickup.com/t/cu-1' }),
  createCreativeTask: vi.fn().mockResolvedValue({ id: 'cu-2', url: 'https://app.clickup.com/t/cu-2' }),
}))

vi.mock('../db/index', () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation((table: unknown) => {
        const rowsForTable =
          table === 'pipeline_runs_table' ? [mockRun] :
          table === 'products_table' ? [mockProduct] :
          table === 'copy_assets_table' ? [mockAdvertorial] :
          table === 'funnel_pages_table' ? [mockFunnelPage] :
          []
        // Returns an object that is thenable AND exposes orderBy/limit for chained queries
        const chainable: Record<string, unknown> = {}
        chainable['where'] = vi.fn().mockImplementation(() => {
          const whereResult: Record<string, unknown> = {}
          whereResult['then'] = (resolve: (v: unknown[]) => void) => Promise.resolve(rowsForTable).then(resolve)
          whereResult['catch'] = (reject: (e: unknown) => void) => Promise.resolve(rowsForTable).catch(reject)
          whereResult['orderBy'] = vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(rowsForTable),
          })
          return whereResult
        })
        return chainable
      }),
    })),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
  },
  pipelineRuns: 'pipeline_runs_table',
  products: 'products_table',
  copyAssets: 'copy_assets_table',
  creativeAssets: 'creative_assets_table',
  funnelPages: 'funnel_pages_table',
  clickupDeliverables: 'clickup_deliverables_table',
  personaReviews: 'persona_reviews_table',
}))

vi.mock('../pipeline/logger', () => ({ log: vi.fn() }))

describe('clickup-publisher', () => {
  it('exports runClickUpPublisher function', () => {
    expect(typeof runClickUpPublisher).toBe('function')
  })

  it('calls createAdvertorialTask when advertorial and funnel URL exist', async () => {
    const { createAdvertorialTask } = await import('../lib/clickup.js')
    await runClickUpPublisher('run-1')
    expect(createAdvertorialTask).toHaveBeenCalledWith(expect.objectContaining({
      productName: 'Hims',
      advertorialUrl: 'https://preview.vercel.app/run-1',
    }))
  })
})
