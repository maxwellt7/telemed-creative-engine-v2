import { describe, it, expect, vi } from 'vitest'
import { runOfferProfiler } from './offer-profiler.js'

vi.mock('../lib/anthropic.js', () => ({
  anthropic: {},
  parseClaudeJson: vi.fn().mockImplementation((text: string) => JSON.parse(text)),
  callClaude: vi.fn().mockResolvedValue(JSON.stringify({
    offerAnalysis: {
      core_promise: 'Lose weight without surgery',
      mechanism: 'GLP-1 prescription',
      proof_elements: ['clinical trials'],
      price_anchor: '$297/month',
      urgency_levers: ['limited spots'],
      irresistibleEquation: {
        massivePain: 9, purchasingPower: 7, easyToTarget: 8, growingMarket: 9,
        promiseSize: 8, perceivedLikelihood: 6, timeDelay: 7, effortRequired: 8,
        equationScore: 0.857,
        weakestDimension: 'perceivedLikelihood — copy must emphasize clinical proof',
      },
    },
    avatar: {
      primaryAge: '40-55', gender: 'F', topDesire: 'feel healthy',
      topFrustration: 'failed diets', income: '$60k-$100k',
      previousSolutions: ['keto', 'gym memberships'],
      primaryCurrency: 'Health',
      empathyMap: {
        seeing: ['a1', 'a2', 'a3', 'a4', 'a5'],
        hearing: ['b1', 'b2', 'b3', 'b4', 'b5'],
        saying: ['c1', 'c2', 'c3', 'c4', 'c5'],
        thinking: ['d1', 'd2', 'd3', 'd4', 'd5'],
        feeling: ['e1', 'e2', 'e3', 'e4', 'e5'],
        doing: ['f1', 'f2', 'f3', 'f4', 'f5'],
        pains: ['g1', 'g2', 'g3', 'g4', 'g5'],
        gains: ['h1', 'h2', 'h3', 'h4', 'h5'],
      },
      goalsGrid: {
        painsAndFrustrations: ['p1', 'p2', 'p3', 'p4', 'p5'],
        fearsAndImplications: ['f1', 'f2', 'f3', 'f4', 'f5'],
        goalsAndDesires: ['g1', 'g2', 'g3', 'g4', 'g5'],
        dreamsAndAspirations: ['d1', 'd2', 'd3', 'd4', 'd5'],
      },
    },
    beliefs: ['doctors are too expensive', 'telemedicine is legitimate'],
    beliefCategories: {
      outcome: ['outcome1', 'outcome2'],
      identity: ['identity1', 'identity2'],
      problem: ['problem1', 'problem2'],
      solution: ['solution1', 'solution2'],
      product: ['product1', 'product2'],
      credibility: ['credibility1', 'credibility2'],
    },
    manifold: { topFear: 'failure again', topHope: 'finally lose the weight', identity: 'someone who failed' },
    launchDoc: { headline: 'Finally, a doctor who listens', hook: "If you've tried everything...", positioning: 'vs diet pills' },
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

    const valuesMock = (db.insert as ReturnType<typeof vi.fn>).mock.results[0].value.values
    const insertedRow = (valuesMock as ReturnType<typeof vi.fn>).mock.calls[0][0]
    expect(insertedRow.manifoldJson).toHaveProperty('topFear', 'failure again')
    expect(insertedRow.manifoldJson).toHaveProperty('beliefCategories')
    expect(insertedRow.manifoldJson.beliefCategories).toHaveProperty('outcome')
  })
})
