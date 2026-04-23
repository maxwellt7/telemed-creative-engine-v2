import { describe, it, expect, vi } from 'vitest'
import { runCopyChief } from './copy-chief.js'

vi.mock('../lib/anthropic.js', () => ({
  anthropic: {},
  callClaude: vi.fn().mockResolvedValue(`# The Doctor Who Finally Listened\n\nIt started with a simple Google search...\n\n[2000 words of advertorial copy]\n\n**Click here to see if you qualify →**`),
}))

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{
          id: 'brief-1',
          briefJson: { copywriterBrief: 'Match empathetic voice' },
          conceptsJson: [{ concept: 'The Real Diagnosis', hook: 'Most people never know...', angle: 'insight', headline: 'What Your Doctor Never Told You' }],
          sourceUrl: 'https://example.com',
        }]),
      }),
    }),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([{ id: 'copy-1' }]) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
  },
  reverseBriefs: {},
  copyAssets: {},
  pipelineRuns: {},
}))

vi.mock('../pipeline/logger.js', () => ({ log: vi.fn() }))

describe('copy-chief', () => {
  it('writes full advertorial and saves to copy_assets', async () => {
    const { callClaude } = await import('../lib/anthropic.js')
    const { db } = await import('../db/index.js')
    await runCopyChief('run-abc')
    expect(callClaude).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ model: 'claude-opus-4-7', thinkingBudget: expect.any(Number) })
    )
    expect(db.insert).toHaveBeenCalled()
  })
})
