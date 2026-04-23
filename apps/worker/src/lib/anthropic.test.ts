import { describe, it, expect, vi } from 'vitest'
import { callClaude, callClaudeJSON } from './anthropic.js'

describe('callClaude', () => {
  it('returns text content', async () => {
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: '{"result": "ok"}' }],
        }),
      },
    } as any
    const result = await callClaude(client, {
      model: 'claude-sonnet-4-6',
      system: 'You are helpful.',
      messages: [{ role: 'user', content: 'hello' }],
    })
    expect(result).toBe('{"result": "ok"}')
  })
})

describe('callClaudeJSON', () => {
  const schema = {
    type: 'object',
    properties: { answer: { type: 'string' } },
    required: ['answer'],
  }

  it('returns tool_use input as typed object', async () => {
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          stop_reason: 'tool_use',
          content: [
            { type: 'tool_use', name: 'return_result', input: { answer: 'hello' } },
          ],
        }),
      },
    } as any
    const result = await callClaudeJSON<{ answer: string }>(client, {
      model: 'claude-sonnet-4-6',
      system: 'sys',
      messages: [{ role: 'user', content: 'q' }],
      tool: {
        name: 'return_result',
        description: 'return the result',
        input_schema: schema,
      },
    })
    expect(result).toEqual({ answer: 'hello' })
  })

  it('passes tool and forces tool_choice in API call', async () => {
    const create = vi.fn().mockResolvedValue({
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', name: 'return_result', input: { answer: 'ok' } }],
    })
    const client = { messages: { create } } as any
    await callClaudeJSON(client, {
      model: 'claude-sonnet-4-6',
      system: 'sys',
      messages: [{ role: 'user', content: 'q' }],
      tool: { name: 'return_result', description: 'd', input_schema: schema },
    })
    const params = create.mock.calls[0][0]
    expect(params.tools).toEqual([
      { name: 'return_result', description: 'd', input_schema: schema },
    ])
    expect(params.tool_choice).toEqual({ type: 'tool', name: 'return_result' })
  })

  it('uses tool_choice=auto when thinking is enabled (thinking forbids forced tools)', async () => {
    const create = vi.fn().mockResolvedValue({
      stop_reason: 'tool_use',
      content: [{ type: 'tool_use', name: 'return_result', input: { answer: 'ok' } }],
    })
    const client = { messages: { create } } as any
    await callClaudeJSON(client, {
      model: 'claude-opus-4-7',
      system: 'sys',
      messages: [{ role: 'user', content: 'q' }],
      thinkingBudget: 1024,
      tool: { name: 'return_result', description: 'd', input_schema: schema },
    })
    const params = create.mock.calls[0][0]
    expect(params.tool_choice).toEqual({ type: 'auto' })
    expect(params.thinking).toEqual({ type: 'enabled', budget_tokens: 1024 })
  })

  it('throws on max_tokens stop_reason with a clear message', async () => {
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          stop_reason: 'max_tokens',
          content: [],
        }),
      },
    } as any
    await expect(
      callClaudeJSON(client, {
        model: 'claude-sonnet-4-6',
        system: 'sys',
        messages: [{ role: 'user', content: 'q' }],
        maxTokens: 100,
        tool: { name: 'return_result', description: 'd', input_schema: schema },
      }),
    ).rejects.toThrow(/max_tokens/)
  })

  it('throws when no tool_use block is present', async () => {
    const client = {
      messages: {
        create: vi.fn().mockResolvedValue({
          stop_reason: 'end_turn',
          content: [{ type: 'text', text: 'I refuse to use the tool' }],
        }),
      },
    } as any
    await expect(
      callClaudeJSON(client, {
        model: 'claude-sonnet-4-6',
        system: 'sys',
        messages: [{ role: 'user', content: 'q' }],
        tool: { name: 'return_result', description: 'd', input_schema: schema },
      }),
    ).rejects.toThrow(/tool_use/)
  })
})
