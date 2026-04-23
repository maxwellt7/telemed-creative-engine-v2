import { describe, it, expect, vi } from 'vitest'
import { runCopyChief } from './copy-chief.js'

vi.mock('../lib/anthropic.js', () => ({
  anthropic: {},
  callClaude: vi.fn().mockResolvedValue(`# The Doctor Who Finally Listened\n\nIt started with a simple Google search...\n\n[2000 words]\n\n**Click here →**`),
}))

vi.mock('../lib/gemini.js', () => ({
  callGeminiText: vi.fn().mockResolvedValue('<article><h1>Test Advertorial</h1><p>Content here.</p></article>'),
  isGeminiConfigured: vi.fn().mockReturnValue(false),
}))

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          then: (fn: (v: any[]) => any) => Promise.resolve([{
            id: 'brief-1',
            briefJson: { copywriterBrief: 'Match empathetic voice' },
            conceptsJson: [{ concept: 'The Real Diagnosis', hook: 'Most people never know...', angle: 'insight', headline: 'What Your Doctor Never Told You' }],
            sourceUrl: 'https://example.com',
          }]).then(fn),
          catch: (fn: any) => Promise.resolve([]).catch(fn),
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([{ id: 'copy-1' }]) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
  },
  reverseBriefs: {},
  copyAssets: {},
  creativeAssets: {},
  advertorialDesigns: {},
  pipelineRuns: {},
}))

vi.mock('../pipeline/logger.js', () => ({ log: vi.fn() }))

describe('copy-chief', () => {
  it('writes full advertorial and saves to copy_assets', async () => {
    const { callClaude } = await import('../lib/anthropic.js')
    const { db } = await import('../db/index.js')
    await runCopyChief('run-abc')
    expect(db.insert).toHaveBeenCalled()
  })
})
