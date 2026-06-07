import Anthropic from '@anthropic-ai/sdk';
import type { Message } from '../agent/types.js';
import type { ModelProvider, ProviderEvent, SendRequest } from './types.js';

export interface AnthropicProviderOptions {
  apiKey: string;
  model: string;
  maxTokens?: number;
  /** Enable adaptive thinking + effort (recommended for coding tasks). */
  thinking?: boolean;
  effort?: 'low' | 'medium' | 'high' | 'xhigh' | 'max';
}

/** Translate internal messages into Anthropic's content-block shape. */
export function toAnthropicMessages(messages: Message[]): Anthropic.MessageParam[] {
  return messages.map((m) => ({
    role: m.role,
    content: m.content.map((b) => {
      switch (b.type) {
        case 'text':
          return { type: 'text' as const, text: b.text };
        case 'tool_use':
          return { type: 'tool_use' as const, id: b.id, name: b.name, input: b.input };
        case 'tool_result':
          return {
            type: 'tool_result' as const,
            tool_use_id: b.toolUseId,
            content: b.content,
            is_error: b.isError,
          };
      }
    }),
  })) as Anthropic.MessageParam[];
}

export class AnthropicProvider implements ModelProvider {
  readonly name = 'anthropic' as const;
  readonly model: string;
  private readonly client: Anthropic;
  private readonly maxTokens: number;
  private readonly thinking: boolean;
  private readonly effort: 'low' | 'medium' | 'high' | 'xhigh' | 'max';

  constructor(opts: AnthropicProviderOptions) {
    this.client = new Anthropic({ apiKey: opts.apiKey });
    this.model = opts.model;
    this.maxTokens = opts.maxTokens ?? 16_000;
    this.thinking = opts.thinking ?? true;
    this.effort = opts.effort ?? 'high';
  }

  async *send(req: SendRequest): AsyncIterable<ProviderEvent> {
    const params = {
      model: this.model,
      max_tokens: this.maxTokens,
      system: req.system,
      messages: toAnthropicMessages(req.messages),
      tools: req.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.jsonSchema,
      })),
      ...(this.thinking
        ? { thinking: { type: 'adaptive' }, output_config: { effort: this.effort } }
        : {}),
    } as unknown as Anthropic.MessageStreamParams;

    const stream = this.client.messages.stream(params);

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield { type: 'text', delta: event.delta.text };
      }
    }

    const final = await stream.finalMessage();
    for (const block of final.content) {
      if (block.type === 'tool_use') {
        yield { type: 'tool_call', id: block.id, name: block.name, input: block.input };
      }
    }

    yield {
      type: 'done',
      usage: {
        inputTokens: final.usage.input_tokens,
        outputTokens: final.usage.output_tokens,
      },
      stopReason: final.stop_reason ?? 'end_turn',
    };
  }
}
