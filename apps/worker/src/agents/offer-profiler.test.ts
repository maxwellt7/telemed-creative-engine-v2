import { describe, it, expect, vi } from 'vitest'
import { runOfferProfiler } from './offer-profiler.js'

vi.mock('../lib/anthropic.js', () => ({
  anthropic: {},
  callClaudeJSON: vi.fn().mockResolvedValue({
    offerAnalysis: { core_promise: 'Lose weight without surgery', mechanism: 'GLP-1 prescription', proof_elements: [], price_anchor: '$99', urgency_levers: [] },
    avatar: { primaryAge: '40-55', gender: 'F', income: '50-100k', topDesire: 'feel healthy', topFrustration: 'tried everything', previousSolutions: [] },
    beliefs: ['doctors are too expensive', 'telemedicine is legitimate'],
    manifold: { topFear: 'failure again', topHope: 'finally lose the weight', identity: 'health-conscious' },
    launchDoc: { headline: 'Finally, a doctor who listens', hook: "If you've tried everything...", positioning: 'vs clinic visits' },
  }),
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
    const { callClaudeJSON } = await import('../lib/anthropic.js')
    const { db } = await import('../db/index.js')
    await runOfferProfiler('run-abc', {
      name: 'Hims', url: 'https://hims.com', brief: 'ED telemedicine', targetMarket: 'US men 35-55',
    })
    expect(callClaudeJSON).toHaveBeenCalled()
    expect(db.insert).toHaveBeenCalled()
  })
})
