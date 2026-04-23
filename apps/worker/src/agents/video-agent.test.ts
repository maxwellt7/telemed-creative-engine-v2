import { describe, it, expect, vi } from 'vitest'
import { runVideoDraft, runVideoFinal } from './video-agent.js'

vi.mock('../lib/fal.js', () => ({
  generateVideoDraft: vi.fn().mockResolvedValue('https://fal.ai/draft.mp4'),
  generateVideoFinal: vi.fn().mockResolvedValue('https://fal.ai/final.mp4'),
  generateVoiceover: vi.fn().mockResolvedValue('https://fal.ai/vo.mp3'),
}))

vi.mock('../db/index.js', () => {
  const mockScripts = JSON.stringify([{
    concept: 'Real Doctor',
    script30s: 'OPEN: Doctor at desk.\nVO: Are you tired of waiting rooms?\nSUPER: Board-certified doctors online.\nVO: Get a prescription today.\nCTA: Start now.',
  }])
  return {
    db: {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([{ content: mockScripts, id: 'script-1' }]) }),
      }),
      insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
      update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
    },
    copyAssets: {},
    creativeAssets: {},
    pipelineRuns: {},
  }
})

vi.mock('../pipeline/logger.js', () => ({ log: vi.fn() }))

describe('video-agent', () => {
  it('generates voiceover and draft video', async () => {
    const { generateVoiceover, generateVideoDraft } = await import('../lib/fal.js')
    await runVideoDraft('run-abc')
    expect(generateVoiceover).toHaveBeenCalled()
    expect(generateVideoDraft).toHaveBeenCalled()
  })

  it('generates final video via Kling 2.0', async () => {
    const { generateVideoFinal } = await import('../lib/fal.js')
    await runVideoFinal('run-abc')
    expect(generateVideoFinal).toHaveBeenCalled()
  })
})
