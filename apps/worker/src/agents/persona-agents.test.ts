import { describe, it, expect, vi } from 'vitest'
import { runPersonaTest } from './persona-agents.js'

vi.mock('../lib/anthropic', () => ({
  anthropic: {},
  callClaude: vi.fn().mockResolvedValue(JSON.stringify({
    score: 7.5,
    sentiment: 'positive',
    objection: 'Concerned about data privacy',
    suggestedEdit: 'Add a clear HIPAA badge near the CTA',
  })),
}))

const mockPersonas = Array.from({ length: 15 }, (_, i) => ({
  id: `persona-${i}`,
  name: `Persona${i}`,
  archetype: 'Test Archetype',
  primaryFear: 'a fear',
  primaryCurrency: 'money',
  demographicsJson: { ageRange: '40-50', gender: 'F' },
  psychographicsJson: { trustLevel: 'low' },
}))

vi.mock('../db/index', () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation((table: unknown) => {
        if (table === 'personas_table') {
          return Promise.resolve(mockPersonas)
        }
        return {
          where: vi.fn().mockImplementation(() => Promise.resolve([])),
        }
      }),
    })),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
  },
  personas: 'personas_table',
  copyAssets: 'copy_assets_table',
  creativeAssets: 'creative_assets_table',
  personaReviews: 'persona_reviews_table',
  pipelineRuns: 'pipeline_runs_table',
}))

vi.mock('../pipeline/logger', () => ({ log: vi.fn() }))

describe('persona-agents', () => {
  it('exports runPersonaTest function', () => {
    expect(typeof runPersonaTest).toBe('function')
  })

  it('runPersonaTest calls reviewAsset and inserts reviews when assets exist', async () => {
    const { db } = await import('../db/index.js')
    vi.mocked(db.select).mockImplementation(() => ({
      from: vi.fn().mockImplementation((table: unknown) => {
        if (table === 'personas_table') return Promise.resolve(mockPersonas)
        return {
          where: vi.fn().mockImplementation(() =>
            Promise.resolve([{ id: 'asset-1', type: 'advertorial', content: 'Advertorial copy here', runId: 'run-1' }])
          ),
        }
      }),
    } as any))

    await runPersonaTest('run-1')

    expect(vi.mocked(db.insert)).toHaveBeenCalled()
    expect(vi.mocked(db.update)).toHaveBeenCalled()
  })
})
