import { describe, it, expect } from 'vitest';
import { toAnthropicMessages } from '../../src/providers/anthropic.js';
import { toGeminiContents } from '../../src/providers/gemini.js';
import type { Message } from '../../src/agent/types.js';

const conversation: Message[] = [
  { role: 'user', content: [{ type: 'text', text: 'list files' }] },
  {
    role: 'assistant',
    content: [
      { type: 'text', text: 'Listing.' },
      { type: 'tool_use', id: 'call-1', name: 'ls', input: { path: '.' } },
    ],
  },
  {
    role: 'user',
    content: [{ type: 'tool_result', toolUseId: 'call-1', content: 'a.txt', isError: false }],
  },
];

describe('toAnthropicMessages', () => {
  it('maps text, tool_use, and tool_result blocks', () => {
    const out = toAnthropicMessages(conversation);
    expect(out).toHaveLength(3);

    const assistant = out[1]!;
    expect(assistant.role).toBe('assistant');
    const blocks = assistant.content as Array<{ type: string; id?: string; name?: string }>;
    expect(blocks[1]!.type).toBe('tool_use');
    expect(blocks[1]!.id).toBe('call-1');

    const result = (out[2]!.content as Array<{ type: string; tool_use_id?: string }>)[0]!;
    expect(result.type).toBe('tool_result');
    expect(result.tool_use_id).toBe('call-1');
  });
});

describe('toGeminiContents', () => {
  it('maps roles, function calls, and resolves function-response names', () => {
    const out = toGeminiContents(conversation);

    expect(out[1]!.role).toBe('model');
    const call = out[1]!.parts.find((p) => p.functionCall);
    expect(call?.functionCall?.name).toBe('ls');

    const resp = out[2]!.parts[0]!;
    // Gemini correlates by name, resolved from the earlier tool_use block.
    expect(resp.functionResponse?.name).toBe('ls');
    expect(resp.functionResponse?.response).toEqual({ output: 'a.txt' });
  });

  it('wraps error results under an error key', () => {
    const out = toGeminiContents([
      {
        role: 'assistant',
        content: [{ type: 'tool_use', id: 'c1', name: 'bash', input: {} }],
      },
      {
        role: 'user',
        content: [{ type: 'tool_result', toolUseId: 'c1', content: 'boom', isError: true }],
      },
    ]);
    expect(out[1]!.parts[0]!.functionResponse?.response).toEqual({ error: 'boom' });
  });

  it('drops empty text parts', () => {
    const out = toGeminiContents([{ role: 'assistant', content: [{ type: 'text', text: '' }] }]);
    expect(out[0]!.parts).toHaveLength(0);
  });
});
