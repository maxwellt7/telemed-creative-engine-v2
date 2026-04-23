import { describe, it, expect, vi } from 'vitest'
import { runCreativeDirection, runAdScripts } from './creative-director.js'

vi.mock('../lib/anthropic.js', () => ({
  anthropic: {},
  parseClaudeJson: vi.fn().mockImplementation((text: string) => JSON.parse(text)),
  callClaude: vi.fn()
    .mockResolvedValueOnce(JSON.stringify([
      { concept: 'Real Doctor Real Results', visual: 'doctor with patient', emotion: 'trust', format: 'testimonial', targetPersona: 'Harold', hook: 'OPEN: Doctor looks at camera', valueProposition: 'Real doctors, real prescriptions' },
      { concept: 'The 3-Minute Consultation', visual: 'phone app', emotion: 'ease', format: 'demo', targetPersona: 'Sarah', hook: 'OPEN: busy mom on phone', valueProposition: 'Faster than a pharmacy trip' },
      { concept: 'Stop Suffering in Silence', visual: 'person alone', emotion: 'empathy', format: 'problem-solution', targetPersona: 'James', hook: 'OPEN: dark room, person at desk', valueProposition: 'Private, discreet, effective' },
    ]))
    .mockResolvedValueOnce(JSON.stringify([
      { concept: 'Real Doctor Real Results', script30s: 'OPEN: Doctor looks at camera.\nVO: Are you tired of waiting rooms?', script60s: 'Extended version...', staticAdHeadline: 'Real Doctors. Real Results.', staticAdBody: 'See a board-certified doctor online.', imagePrompt: 'doctor in white coat at desk, warm lighting, professional medical office' },
    ])),
}))

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ content: 'Full advertorial text here...', id: 'copy-1' }]),
      }),
    }),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
  },
  copyAssets: {},
  pipelineRuns: {},
}))

vi.mock('../pipeline/logger.js', () => ({ log: vi.fn() }))

describe('creative-director', () => {
  it('generates 3 creative concepts', async () => {
    const { callClaude } = await import('../lib/anthropic.js')
    const { db } = await import('../db/index.js')
    await runCreativeDirection('run-abc')
    expect(callClaude).toHaveBeenCalledOnce()
    expect(db.insert).toHaveBeenCalled()
  })
})
