import { describe, it, expect, vi } from 'vitest'
import { runClickUpPublisher } from './clickup-publisher.js'

vi.mock('../lib/clickup', () => ({
  createAdvertorialTask: vi.fn().mockResolvedValue({ id: 'cu-1', url: 'https://app.clickup.com/t/cu-1' }),
  createCreativeTask: vi.fn().mockResolvedValue({ id: 'cu-2', url: 'https://app.clickup.com/t/cu-2' }),
}))

vi.mock('../db/index', () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation((cond) => ({
          orderBy: vi.fn().mockReturnValue({ limit: vi.fn().mockResolvedValue([{ content: 'advertorial', id: 'a1', type: 'advertorial', version: 1 }]) }),
          resolves: cond?.toString?.()?.includes('product_id')
            ? [{ id: 'prod-1', name: 'Hims', url: 'https://hims.com', brief: 'ED', targetMarket: 'US men' }]
            : [{ id: 'run-1', productId: 'prod-1', status: 'running', currentStage: 'DELIVERY', revisionPass: 0, startedAt: new Date(), completedAt: null, createdBy: 'system' }],
        })),
      })),
    })),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
  },
  pipelineRuns: {},
  products: {},
  copyAssets: {},
  creativeAssets: {},
  funnelPages: {},
  clickupDeliverables: {},
  personaReviews: {},
}))

vi.mock('../pipeline/logger', () => ({ log: vi.fn() }))

describe('clickup-publisher', () => {
  it('exports runClickUpPublisher function', () => {
    expect(typeof runClickUpPublisher).toBe('function')
  })
})
