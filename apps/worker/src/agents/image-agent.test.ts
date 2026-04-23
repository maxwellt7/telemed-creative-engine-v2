import { describe, it, expect, vi } from 'vitest'
import { runImageAgent } from './image-agent.js'

vi.mock('../lib/fal.js', () => ({
  generateStaticAd: vi.fn()
    .mockResolvedValueOnce({ imageUrl: 'https://fal.ai/img1.jpg', format: '1:1' })
    .mockResolvedValueOnce({ imageUrl: 'https://fal.ai/img2.jpg', format: '4:5' })
    .mockResolvedValueOnce({ imageUrl: 'https://fal.ai/img3.jpg', format: '9:16' }),
}))

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{
          content: JSON.stringify([{ imagePrompt: 'doctor with patient, medical office', concept: 'Real Doctor' }]),
          id: 'script-1',
        }]),
      }),
    }),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
  },
  copyAssets: {},
  creativeAssets: {},
  pipelineRuns: {},
}))

vi.mock('../pipeline/logger.js', () => ({ log: vi.fn() }))

describe('image-agent', () => {
  it('generates static ads in all 3 formats', async () => {
    const { generateStaticAd } = await import('../lib/fal.js')
    const { db } = await import('../db/index.js')
    await runImageAgent('run-abc')
    expect(generateStaticAd).toHaveBeenCalledTimes(3)
    expect(db.insert).toHaveBeenCalled()
  })
})
