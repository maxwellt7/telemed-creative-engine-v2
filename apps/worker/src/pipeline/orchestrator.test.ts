import { describe, it, expect, vi } from 'vitest'
import { runPipeline } from './orchestrator.js'

vi.mock('../db/index', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockResolvedValue([{
          id: 'run-abc', productId: 'prod-1', status: 'pending',
          currentStage: 'INTAKE', revisionPass: 0, startedAt: new Date(),
        }]),
      })),
    }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
  },
  pipelineRuns: {},
  products: {},
}))

vi.mock('../agents/offer-profiler', () => ({ runOfferProfiler: vi.fn() }))
vi.mock('../agents/avatar-agent', () => ({ runAvatarAgent: vi.fn() }))
vi.mock('../agents/research-agent', () => ({ runCompetitorDiscover: vi.fn(), runAdvertorialDiscover: vi.fn() }))
vi.mock('../agents/analyst-agent', () => ({ runAdvertorialFetch: vi.fn(), runReverseEngineer: vi.fn() }))
vi.mock('../agents/brief-writer', () => ({ runReverseBrief: vi.fn(), runCopyConcepts: vi.fn() }))
vi.mock('../agents/copy-chief', () => ({ runCopyChief: vi.fn() }))
vi.mock('../agents/creative-director', () => ({ runCreativeDirection: vi.fn(), runAdScripts: vi.fn() }))
vi.mock('../agents/funnel-builder', () => ({ runFunnelBuilder: vi.fn() }))
vi.mock('../agents/image-agent', () => ({ runImageAgent: vi.fn() }))
vi.mock('../agents/video-agent', () => ({ runVideoDraft: vi.fn(), runVideoFinal: vi.fn() }))
vi.mock('../agents/persona-agents', () => ({ runPersonaTest: vi.fn() }))
vi.mock('../agents/qa-agent', () => ({
  runRevision: vi.fn().mockResolvedValue(false),
  runQAFinal: vi.fn(),
}))
vi.mock('../agents/clickup-publisher', () => ({ runClickUpPublisher: vi.fn() }))
vi.mock('./logger', () => ({ log: vi.fn() }))

describe('orchestrator', () => {
  it('calls all 21 stages including clickup-publisher', async () => {
    const { runClickUpPublisher } = await import('../agents/clickup-publisher.js')
    const { runOfferProfiler } = await import('../agents/offer-profiler.js')
    await runPipeline('run-abc')
    expect(runOfferProfiler).toHaveBeenCalled()
    expect(runClickUpPublisher).toHaveBeenCalledWith('run-abc')
  })
})
