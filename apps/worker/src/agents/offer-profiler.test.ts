import { describe, it, expect, vi } from 'vitest'
import { runOfferProfiler } from './offer-profiler.js'

vi.mock('../lib/anthropic.js', () => ({
  anthropic: {},
  parseClaudeJson: vi.fn().mockImplementation((text: string) => JSON.parse(text)),
  callClaude: vi.fn().mockResolvedValue(JSON.stringify({
    offerAnalysis: { core_promise: 'Lose weight without surgery', mechanism: 'GLP-1 prescription' },
    avatar: { primaryAge: '40-55', gender: 'F', topDesire: 'feel healthy' },
    beliefs: ['doctors are too expensive', 'telemedicine is legitimate'],
    manifold: { topFear: 'failure again', topHope: 'finally lose the weight' },
    launchDoc: { headline: 'Finally, a doctor who listens', hook: "If you've tried everything..." },
  })),
}))

vi.mock('../db/index.js', () => ({
  db: {
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([{ id: 'profile-1' }]) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
  },
  offerProfiles: {},
  pipelineRuns: {},
}))

vi.mock('../pipeline/logger.js', () => ({ log: vi.fn() }))

describe('offer-profiler', () => {
  it('calls Claude and inserts offer profile', async () => {
    const { callClaude } = await import('../lib/anthropic.js')
    const { db } = await import('../db/index.js')
    await runOfferProfiler('run-abc', {
      name: 'Hims', url: 'https://hims.com', brief: 'ED telemedicine', targetMarket: 'US men 35-55',
    })
    expect(callClaude).toHaveBeenCalled()
    expect(db.insert).toHaveBeenCalled()
  })
})
