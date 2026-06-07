import { describe, it, expect, vi } from 'vitest';
import type { ProviderEvent } from '../../src/providers/types.js';

const hoisted = vi.hoisted(() => ({ captured: undefined as unknown }));

vi.mock('@google/genai', () => {
  class FakeGenAI {
    models = {
      generateContentStream: async (params: unknown) => {
        hoisted.captured = params;
        const chunks = [
          { text: 'Hello', functionCalls: undefined, usageMetadata: undefined },
          {
            text: undefined,
            functionCalls: [{ name: 'ls', args: { path: '.' } }],
            usageMetadata: { promptTokenCount: 3, candidatesTokenCount: 4 },
          },
        ];
        return {
          async *[Symbol.asyncIterator]() {
            for (const c of chunks) yield c;
          },
        };
      },
    };
  }
  return { GoogleGenAI: FakeGenAI };
});

const { GeminiProvider } = await import('../../src/providers/gemini.js');

describe('GeminiProvider.send', () => {
  it('maps streamed chunks into text, tool_call, and done events', async () => {
    const provider = new GeminiProvider({ apiKey: 'x', model: 'gemini-2.5-pro' });
    const events: ProviderEvent[] = [];
    for await (const e of provider.send({
      system: 's',
      messages: [{ role: 'user', content: [{ type: 'text', text: 'go' }] }],
      tools: [{ name: 'ls', description: 'list', jsonSchema: { type: 'object' } }],
    })) {
      events.push(e);
    }

    const text = events.filter((e) => e.type === 'text').map((e) => (e as { delta: string }).delta);
    expect(text.join('')).toBe('Hello');

    const call = events.find((e) => e.type === 'tool_call');
    expect(call).toMatchObject({ type: 'tool_call', name: 'ls', input: { path: '.' } });

    const done = events.find((e) => e.type === 'done');
    expect(done).toMatchObject({
      type: 'done',
      stopReason: 'tool_use',
      usage: { inputTokens: 3, outputTokens: 4 },
    });
  });

  it('passes tools as functionDeclarations with a JSON schema', async () => {
    const provider = new GeminiProvider({ apiKey: 'x', model: 'm' });
     
    for await (const _ of provider.send({
      system: 's',
      messages: [],
      tools: [{ name: 'ls', description: 'list', jsonSchema: { type: 'object' } }],
    })) {
      // no-op
    }
    const params = hoisted.captured as {
      config: { tools: Array<{ functionDeclarations: Array<{ name: string }> }> };
    };
    expect(params.config.tools[0]!.functionDeclarations[0]).toMatchObject({ name: 'ls' });
  });
});
