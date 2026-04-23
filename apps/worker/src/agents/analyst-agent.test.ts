import { describe, it, expect, vi } from 'vitest'
import { runAdvertorialFetch, runReverseEngineer } from './analyst-agent.js'

vi.mock('../lib/firecrawl.js', () => ({
  scrapeUrl: vi.fn().mockResolvedValue('# Big health discovery\n\nSponsored: This telemedicine company changed everything...'),
}))

vi.mock('../lib/anthropic.js', () => ({
  anthropic: {},
  callClaude: vi.fn().mockResolvedValue(JSON.stringify({
    hookStructure: 'problem-agitate-solve',
    beliefBridges: ['telemedicine is real medicine'],
    ctaMechanics: 'urgency + scarcity',
    voice: 'conversational-authoritative',
    emotionalArc: ['fear', 'hope', 'trust', 'action'],
    keyPhrases: ['without leaving home', 'board-certified doctors'],
    pacing: 'fast opening, slows at proof section',
    socialProofTypes: ['testimonials', 'doctor credentials'],
    objectionHandling: ['is it real medicine?', 'is it private?'],
  })),
}))

vi.mock('../db/index.js', () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ id: 'a1', url: 'https://example.com/ad', rawContent: 'test', type: 'advertorial', trafficScore: 0.9 }]),
      }),
    }),
    update: vi.fn().mockReturnValue({ set: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }) }),
  },
  researchArtifacts: {},
  pipelineRuns: {},
}))

vi.mock('../pipeline/logger.js', () => ({ log: vi.fn() }))

describe('analyst-agent', () => {
  it('fetches content via Firecrawl', async () => {
    const { scrapeUrl } = await import('../lib/firecrawl.js')
    await runAdvertorialFetch('run-abc')
    expect(scrapeUrl).toHaveBeenCalled()
  })

  it('reverse engineers with Claude', async () => {
    const { callClaude } = await import('../lib/anthropic.js')
    await runReverseEngineer('run-abc')
    expect(callClaude).toHaveBeenCalled()
  })
})
