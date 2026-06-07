import { describe, it, expect, vi } from 'vitest';
import type { ProviderEvent } from '../../src/providers/types.js';

const hoisted = vi.hoisted(() => ({ captured: undefined as unknown }));

vi.mock('@anthropic-ai/sdk', () => {
  function makeStream() {
    const events = [
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'Hi ' } },
      { type: 'content_block_delta', delta: { type: 'text_delta', text: 'there' } },
      { type: 'message_delta', delta: {} },
    ];
    const final = {
      content: [{ type: 'tool_use', id: 'tu1', name: 'ls', input: { path: '.' } }],
      usage: { input_tokens: 5, output_tokens: 7 },
      stop_reason: 'tool_use',
    };
    return {
      async *[Symbol.asyncIterator]() {
        for (const e of events) yield e;
      },
      async finalMessage() {
        return final;
      },
    };
  }

  class FakeAnthropic {
    messages = {
      stream: (params: unknown) => {
        hoisted.captured = params;
        return makeStream();
      },
    };
  }
  return { default: FakeAnthropic };
});

const { AnthropicProvider } = await import('../../src/providers/anthropic.js');

describe('AnthropicProvider.send', () => {
  it('maps a vendor stream into text, tool_call, and done events', async () => {
    const provider = new AnthropicProvider({ apiKey: 'x', model: 'claude-opus-4-8' });
    const events: ProviderEvent[] = [];
    for await (const e of provider.send({
      system: 's',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'go' }] }],
      tools: [{ name: 'ls', description: 'list', jsonSchema: { type: 'object' } }],
    })) {
      events.push(e);
    }

    const text = events.filter((e) => e.type === 'text').map((e) => (e as { delta: string }).delta);
    expect(text.join('')).toBe('Hi there');

    const call = events.find((e) => e.type === 'tool_call');
    expect(call).toMatchObject({ type: 'tool_call', name: 'ls', id: 'tu1', input: { path: '.' } });

    const done = events.find((e) => e.type === 'done');
    expect(done).toMatchObject({
      type: 'done',
      stopReason: 'tool_use',
      usage: { inputTokens: 5, outputTokens: 7 },
    });
  });

  it('sends tools with input_schema derived from the ToolSchema', async () => {
    const provider = new AnthropicProvider({ apiKey: 'x', model: 'm', thinking: false });
    // drain the generator so the request is actually built
     
    for await (const _ of provider.send({
      system: 's',
      messages: [],
      tools: [{ name: 'ls', description: 'list', jsonSchema: { type: 'object' } }],
    })) {
      // no-op
    }
    const params = hoisted.captured as { tools: Array<{ name: string; input_schema: unknown }> };
    expect(params.tools[0]).toMatchObject({ name: 'ls', input_schema: { type: 'object' } });
  });
});
