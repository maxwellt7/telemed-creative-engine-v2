import { describe, it, expect, vi } from 'vitest'
import { runCompetitorDiscover } from './research-agent.js'

vi.mock('../lib/exa.js', () => ({
  searchExa: vi.fn().mockResolvedValue([
    { url: 'https://roman.com', title: 'Roman', text: 'ED telemedicine', score: 0.95 },
    { url: 'https://hers.com', title: 'Hers', text: 'Womens health telemedicine', score: 0.91 },
  ]),
}))

vi.mock('../db/index.js', () => ({
  db: {
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ offerAnalysisJson: { core_promise: 'cure ED' } }]) }),
    }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
  },
  researchArtifacts: {},
  offerProfiles: {},
  pipelineRuns: {},
}))

vi.mock('../pipeline/logger.js', () => ({ log: vi.fn() }))

describe('research-agent', () => {
  it('calls Exa and inserts competitor artifacts', async () => {
    const { searchExa } = await import('../lib/exa.js')
    const { db } = await import('../db/index.js')
    await runCompetitorDiscover('run-abc', { name: 'Hims', url: 'https://hims.com', targetMarket: 'US men' })
    expect(searchExa).toHaveBeenCalled()
    expect(db.insert).toHaveBeenCalled()
  })
})
