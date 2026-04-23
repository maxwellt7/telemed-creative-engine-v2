import Anthropic from '@anthropic-ai/sdk'

export function createAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
}

export const anthropic = createAnthropicClient()

export interface CallClaudeOptions {
  model: string
  system: string
  messages: Anthropic.MessageParam[]
  maxTokens?: number
  thinkingBudget?: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseClaudeJson(text: string): any {
  const stripped = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
  return JSON.parse(stripped)
}

export async function callClaude(client: Anthropic, opts: CallClaudeOptions): Promise<string> {
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: opts.model,
    max_tokens: opts.maxTokens ?? 8192,
    system: [
      {
        type: 'text',
        text: opts.system,
        cache_control: { type: 'ephemeral' },
      } as any,
    ],
    messages: opts.messages,
  }

  if (opts.thinkingBudget) {
    (params as any).thinking = { type: 'adaptive' }
    ;(params as any).output_config = { effort: opts.thinkingBudget >= 4000 ? 'high' : 'medium' }
  }

  const response = await client.messages.create(params)
  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text in Claude response')
  return textBlock.text
}
