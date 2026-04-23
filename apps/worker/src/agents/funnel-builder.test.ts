import { describe, it, expect, vi } from 'vitest'
import { runFunnelBuilder } from './funnel-builder.js'

vi.mock('../lib/anthropic.js', () => ({
  anthropic: {},
  callClaude: vi.fn().mockResolvedValue('<!DOCTYPE html><html><head><title>Test</title></head><body><h1>The Doctor Who Listened</h1><button>See If You Qualify</button></body></html>'),
}))

vi.mock('../lib/vercel-deploy.js', () => ({
  deployAdvertorial: vi.fn().mockResolvedValue('https://telemed-adv-abc123.vercel.app'),
}))

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ content: 'Full advertorial...', id: 'copy-1' }]),
      }),
    }),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([{ id: 'funnel-1' }]) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
  },
  copyAssets: {},
  funnelPages: {},
  pipelineRuns: {},
}))

vi.mock('../pipeline/logger.js', () => ({ log: vi.fn() }))

describe('funnel-builder', () => {
  it('generates HTML and deploys to Vercel', async () => {
    const { deployAdvertorial } = await import('../lib/vercel-deploy.js')
    const { db } = await import('../db/index.js')
    await runFunnelBuilder('run-abc')
    expect(deployAdvertorial).toHaveBeenCalled()
    expect(db.insert).toHaveBeenCalled()
  })
})
