import { describe, it, expect, vi, beforeEach } from 'vitest'
import { runManifoldAgent } from './manifold-agent.js'

const mockProfile = {
  id: 'profile-1',
  runId: 'run-1',
  offerAnalysisJson: { core_promise: 'lose weight fast', mechanism: 'GLP-1 medication' },
  avatarJson: [{
    personaName: 'Desperate Dieter',
    topDesire: 'fit in old jeans',
    topFrustration: 'nothing works',
    previousSolutions: ['keto', 'gym'],
    empathyMap: { saying: ['I give up'], feeling: ['ashamed'], thinking: ['why bother'], doing: ['binge eating'] },
    goalsGrid: { fearsAndImplications: ['diabetes forever'] }
  }],
  beliefsJson: ['doctors dont care', 'I have bad genetics'],
  manifoldJson: {
    topFear: 'failure again',
    topHope: 'finally working',
    identity: 'someone who tried everything',
    beliefCategories: {
      outcome: ['this wont work either'],
      identity: ['not the type who succeeds'],
      problem: ['its genetic'],
      solution: ['too good to be true'],
      product: ['just another pill'],
      credibility: ['doctors just want money']
    }
  },
  manifoldDeepJson: null,
}

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => Promise.resolve([mockProfile])) })) })),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(() => Promise.resolve()) })) })),
  },
  offerProfiles: {},
  pipelineRuns: {},
}))

vi.mock('../lib/anthropic.js', () => ({
  anthropic: {},
  callClaude: vi.fn().mockResolvedValue('{"coreWound":"deep shame","coreWoundOneLiner":"test","identityThreat":"test"}'),
  parseClaudeJson: vi.fn((s: string) => JSON.parse(s)),
}))

vi.mock('../pipeline/logger.js', () => ({ log: vi.fn() }))

describe('manifold-agent', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('runs 5 nodes and updates manifoldDeepJson', async () => {
    const { callClaude } = await import('../lib/anthropic.js')
    const { db } = await import('../db/index.js')

    await runManifoldAgent('run-1')

    expect(callClaude).toHaveBeenCalledTimes(5)
    expect(db.update).toHaveBeenCalled()
  })
})
