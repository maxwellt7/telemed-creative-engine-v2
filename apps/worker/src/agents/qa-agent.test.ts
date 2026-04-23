import { describe, it, expect, vi } from 'vitest'
import { shouldRevise, computeScoreSummaries, runQAFinal } from './qa-agent'

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
})
