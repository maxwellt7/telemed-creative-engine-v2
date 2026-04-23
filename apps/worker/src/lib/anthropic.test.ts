import { describe, it, expect, vi } from 'vitest'
import { createAnthropicClient, callClaude } from './anthropic.js'

vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: 'text', text: '{"result": "ok"}' }],
      }),
    },
  })),
}))

describe('anthropic client', () => {
  it('callClaude returns text content', async () => {
    const client = createAnthropicClient()
    const result = await callClaude(client, {
      model: 'claude-sonnet-4-6',
      system: 'You are helpful.',
      messages: [{ role: 'user', content: 'hello' }],
    })
    expect(result).toBe('{"result": "ok"}')
  })
})
