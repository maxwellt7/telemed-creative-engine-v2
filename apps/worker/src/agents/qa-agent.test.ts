import { describe, it, expect, vi } from 'vitest'
import { shouldRevise, computeScoreSummaries, runRevision, runQAFinal } from './qa-agent.js'

vi.mock('../db/index', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { assetId: 'copy-1', assetType: 'advertorial', score: 6.0, objection: 'Too vague', suggestedEdit: 'Add specifics' },
          { assetId: 'copy-1', assetType: 'advertorial', score: 5.5, objection: 'No proof', suggestedEdit: 'Add testimonials' },
          { assetId: 'copy-1', assetType: 'advertorial', score: 7.5, objection: 'Minor trust issue', suggestedEdit: 'Add guarantee' },
        ]),
      }),
    }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
  },
  personaReviews: {},
  pipelineRuns: {},
}))

vi.mock('../pipeline/logger', () => ({ log: vi.fn() }))

describe('qa-agent', () => {
  it('shouldRevise returns true when avg < 7.0', () => {
    expect(shouldRevise(6.33)).toBe(true)
    expect(shouldRevise(6.99)).toBe(true)
  })

  it('shouldRevise returns false when avg >= 7.0', () => {
    expect(shouldRevise(7.0)).toBe(false)
    expect(shouldRevise(8.5)).toBe(false)
  })

  it('exports computeScoreSummaries and runQAFinal', () => {
    expect(typeof computeScoreSummaries).toBe('function')
    expect(typeof runQAFinal).toBe('function')
  })

  it('runRevision returns false when all assets pass (avg >= 7.0)', async () => {
    const { db } = await import('../db/index.js')
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { assetId: 'copy-1', assetType: 'advertorial', score: 8.0, objection: 'None', suggestedEdit: 'None' },
          { assetId: 'copy-1', assetType: 'advertorial', score: 9.0, objection: 'None', suggestedEdit: 'None' },
        ]),
      }),
    } as any)
    const result = await runRevision('run-1', 0)
    expect(result).toBe(false)
  })

  it('runRevision returns false when revisionPass >= 3', async () => {
    const { db } = await import('../db/index.js')
    vi.mocked(db.select).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([
          { assetId: 'copy-1', assetType: 'advertorial', score: 3.0, objection: 'Bad', suggestedEdit: 'Fix it' },
        ]),
      }),
    } as any)
    const result = await runRevision('run-1', 3)
    expect(result).toBe(false)
  })
})
