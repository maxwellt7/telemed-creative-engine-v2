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
    (params as any).thinking = { type: 'enabled', budget_tokens: opts.thinkingBudget }
  }

  const response = await client.messages.create(params)
  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') throw new Error('No text in Claude response')
  return textBlock.text
}

export interface ClaudeTool {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

export interface CallClaudeJSONOptions extends CallClaudeOptions {
  tool: ClaudeTool
}

export async function callClaudeJSON<T = unknown>(
  client: Anthropic,
  opts: CallClaudeJSONOptions,
): Promise<T> {
  const maxTokens = opts.maxTokens ?? 8192
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model: opts.model,
    max_tokens: maxTokens,
    system: [
      {
        type: 'text',
        text: opts.system,
        cache_control: { type: 'ephemeral' },
      } as any,
    ],
    messages: opts.messages,
    tools: [
      {
        name: opts.tool.name,
        description: opts.tool.description,
        input_schema: opts.tool.input_schema as any,
      },
    ],
    tool_choice: opts.thinkingBudget
      ? ({ type: 'auto' } as any)
      : ({ type: 'tool', name: opts.tool.name } as any),
  }

  if (opts.thinkingBudget) {
    (params as any).thinking = { type: 'enabled', budget_tokens: opts.thinkingBudget }
  }

  const response = await client.messages.create(params)

  if (response.stop_reason === 'max_tokens') {
    throw new Error(
      `Claude response truncated at max_tokens (${maxTokens}) for tool "${opts.tool.name}". Increase maxTokens or reduce output size.`,
    )
  }

  const toolUse = response.content.find((b) => b.type === 'tool_use') as
    | Anthropic.ToolUseBlock
    | undefined
  if (!toolUse) {
    throw new Error(
      `No tool_use block in Claude response for tool "${opts.tool.name}" (stop_reason: ${response.stop_reason})`,
    )
  }
  return toolUse.input as T
}
