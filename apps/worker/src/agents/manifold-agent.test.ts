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
  callClaude: vi.fn()
    .mockResolvedValueOnce('{"coreWound":"deep shame","coreWoundOneLiner":"test","identityThreat":"test"}')
    .mockResolvedValueOnce('{"exactPhrases":["phrase1"],"painLanguage":["pain1"],"transformationLanguage":["trans1"],"wordsToAvoid":["avoid1"]}')
    .mockResolvedValueOnce('{"triggers":[{"trigger":"never say this","whyItEjects":"reason","doInstead":"say that"}]}')
    .mockResolvedValueOnce('{"dissolutions":[{"category":"outcome","blockingBelief":"test","reframe":"test","evidence":"test","newStory":"test","epiphanySeed":"test"}]}')
    .mockResolvedValueOnce('{"hooks":[{"hook":"opener","openerType":"secret","whyItWorks":"creates gap"}]}'),
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

    const updateCall = (db.update as ReturnType<typeof vi.fn>).mock.results[0].value.set.mock.calls[0][0]
    expect(Array.isArray(updateCall.manifoldDeepJson.ejectionTriggers)).toBe(true)
    expect(Array.isArray(updateCall.manifoldDeepJson.dissolutions)).toBe(true)
    expect(Array.isArray(updateCall.manifoldDeepJson.hooks)).toBe(true)
  })
})
