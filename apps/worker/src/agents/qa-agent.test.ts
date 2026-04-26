import { describe, it, expect, vi } from 'vitest'
import { computeScoreSummaries, evaluateAsset, TARGET_THRESHOLD, runQAFinal } from './qa-agent.js'

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([]),
          limit: vi.fn().mockResolvedValue([]),
        }),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
  },
  personaReviews: {},
  pipelineRuns: {},
  copyAssets: {},
  creativeAssets: {},
  funnelPages: {},
  assetRevisionState: {},
}))

vi.mock('../pipeline/logger.js', () => ({ log: vi.fn() }))
vi.mock('../lib/anthropic.js', () => ({ anthropic: {}, callClaude: vi.fn(), parseClaudeJson: vi.fn() }))
vi.mock('../lib/gemini.js', () => ({ callGeminiText: vi.fn(), isGeminiConfigured: vi.fn().mockReturnValue(false) }))
vi.mock('../lib/fal.js', () => ({ generateStaticAd: vi.fn() }))
vi.mock('../lib/storage.js', () => ({ uploadImage: vi.fn() }))

describe('qa-agent', () => {
  it('TARGET_THRESHOLD is 7.5 by default', () => {
    expect(TARGET_THRESHOLD).toBe(7.5)
  })

  it('exports computeScoreSummaries, evaluateAsset, runQAFinal', () => {
    expect(typeof computeScoreSummaries).toBe('function')
    expect(typeof evaluateAsset).toBe('function')
    expect(typeof runQAFinal).toBe('function')
  })

  it('computeScoreSummaries flags assets below TARGET_THRESHOLD', async () => {
    const { db } = await import('../db/index.js')
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { assetId: 'a1', assetType: 'advertorial', score: 6.0, objection: 'Too vague', suggestedEdit: 'Add specifics', passNumber: 1 },
          { assetId: 'a1', assetType: 'advertorial', score: 7.5, objection: 'No proof', suggestedEdit: 'Add testimonials', passNumber: 1 },
          { assetId: 'a2', assetType: 'ad_script', score: 9.8, objection: 'None', suggestedEdit: 'None', passNumber: 1 },
        ]),
      }),
    } as any)
    const summaries = await computeScoreSummaries('run-1')
    const advertorial = summaries.find((s) => s.assetType === 'advertorial')
    const adScript = summaries.find((s) => s.assetType === 'ad_script')
    expect(advertorial?.requiresRevision).toBe(true)
    expect(adScript?.requiresRevision).toBe(false)
  })
})
