import { describe, it, expect, vi } from 'vitest'
import { runReverseBrief, runCopyConcepts } from './brief-writer.js'

vi.mock('../lib/anthropic.js', () => ({
  anthropic: {},
  callClaudeJSON: vi.fn()
    .mockResolvedValueOnce({
      whyItConverts: 'Fear-based hook + instant relief promise',
      toneAnalysis: 'Empathetic doctor voice',
      structureMap: ['Hook', 'Problem', 'Agitate', 'Solution', 'Proof', 'CTA'],
      copywriterBrief: 'Match the empathetic doctor framing...',
      doNotCopy: ['specific claims without substantiation'],
      powerElements: ['story hook', 'specific number', 'easy CTA'],
    })
    .mockResolvedValueOnce({
      concepts: [
        { concept: 'The Hidden Cost of Waiting', angle: 'financial pain', hook: 'Every week you wait...', headline: 'What Waiting Is Actually Costing You', subheadline: 'New telemedicine study reveals', emotionalCore: 'regret', targetPersona: 'Marcus', uniqueMechanism: 'GLP-1 compound' },
        { concept: 'Doctor in Your Pocket', angle: 'convenience', hook: 'What if your doctor was always on call?', headline: 'The Doctor Who Never Makes You Wait', subheadline: 'Available in 15 minutes', emotionalCore: 'relief', targetPersona: 'Sarah', uniqueMechanism: 'same-day prescription' },
        { concept: 'The Real Diagnosis', angle: 'insight', hook: 'Most people with this condition never know...', headline: 'What Your Doctor Never Told You', subheadline: 'The truth about getting better', emotionalCore: 'curiosity', targetPersona: 'Emma', uniqueMechanism: 'lab panel included' },
      ],
    }),
}))

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{
              id: 'art-1', url: 'https://ex.com', rawContent: 'advertorial text',
              analysisJson: { hookStructure: 'PAS' }, trafficScore: 0.9,
            }]),
          }),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
  },
  researchArtifacts: {},
  reverseBriefs: {},
  offerProfiles: {},
  pipelineRuns: {},
}))

vi.mock('../pipeline/logger.js', () => ({ log: vi.fn() }))

describe('brief-writer', () => {
  it('writes reverse brief and inserts to DB', async () => {
    const { callClaudeJSON } = await import('../lib/anthropic.js')
    const { db } = await import('../db/index.js')
    await runReverseBrief('run-abc')
    expect(callClaudeJSON).toHaveBeenCalledOnce()
    expect(db.insert).toHaveBeenCalled()
  })
})
