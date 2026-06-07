import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { AgentLoop } from '../../src/agent/loop.js';
import type { AgentUI } from '../../src/agent/loop.js';
import { createRegistry } from '../../src/tools/registry.js';
import { defineTool } from '../../src/tools/types.js';
import { PermissionGate } from '../../src/permissions/gate.js';
import type { PermissionChoice } from '../../src/permissions/gate.js';
import type { ModelProvider, ProviderEvent, SendRequest } from '../../src/providers/types.js';

const DONE: ProviderEvent = {
  type: 'done',
  usage: { inputTokens: 0, outputTokens: 0 },
  stopReason: 'end_turn',
};

class ScriptedProvider implements ModelProvider {
  readonly name = 'anthropic' as const;
  readonly model = 'fake';
  readonly sent: SendRequest[] = [];

  constructor(private readonly turns: ProviderEvent[][]) {}

  async *send(req: SendRequest): AsyncIterable<ProviderEvent> {
    this.sent.push(req);
    const turn = this.turns.shift() ?? [DONE];
    for (const ev of turn) yield ev;
  }
}

function recordingUI(): { ui: AgentUI; events: string[] } {
  const events: string[] = [];
  const ui: AgentUI = {
    onText: (d) => events.push(`text:${d}`),
    onToolStart: (n) => events.push(`start:${n}`),
    onToolResult: (n, r) => events.push(`result:${n}:${r.output}:${r.isError ?? false}`),
    onToolDenied: (n) => events.push(`denied:${n}`),
    onUsage: () => events.push('usage'),
    onAssistantEnd: () => events.push('assistantEnd'),
    onMaxIterations: () => events.push('maxIter'),
  };
  return { ui, events };
}

const echoTool = defineTool({
  name: 'echo',
  description: 'echo',
  mutating: false,
  schema: z.object({ text: z.string() }),
  async execute(input) {
    return { output: input.text };
  },
});

const dangerTool = defineTool({
  name: 'danger',
  description: 'mutating',
  mutating: true,
  schema: z.object({}),
  async execute() {
    return { output: 'boom' };
  },
});

const registry = createRegistry([echoTool, dangerTool]);

function gateWith(choice: PermissionChoice): PermissionGate {
  return new PermissionGate({ tools: [], bash: [], write: [] }, async () => choice);
}

function makeLoop(
  provider: ModelProvider,
  ui: AgentUI,
  gate: PermissionGate,
  maxIterations = 50,
): AgentLoop {
  return new AgentLoop({
    provider,
    registry,
    gate,
    ui,
    system: 'sys',
    cwd: process.cwd(),
    maxIterations,
  });
}

describe('AgentLoop', () => {
  it('ends after a text-only response with no tools', async () => {
    const provider = new ScriptedProvider([[{ type: 'text', delta: 'hello' }, DONE]]);
    const { ui, events } = recordingUI();
    await makeLoop(provider, ui, gateWith('yes')).run('hi');

    expect(provider.sent).toHaveLength(1);
    expect(events).toContain('text:hello');
    expect(events).toContain('assistantEnd');
    expect(events).not.toContain('start:echo');
  });

  it('executes a tool call and feeds the result back', async () => {
    const provider = new ScriptedProvider([
      [{ type: 'tool_call', id: 't1', name: 'echo', input: { text: 'hi' } }, DONE],
      [{ type: 'text', delta: 'all done' }, DONE],
    ]);
    const { ui, events } = recordingUI();
    const loop = makeLoop(provider, ui, gateWith('yes'));
    await loop.run('do it');

    expect(events).toContain('start:echo');
    expect(events).toContain('result:echo:hi:false');

    // Second request must carry: user, assistant(tool_use), user(tool_result)
    expect(provider.sent).toHaveLength(2);
    const second = provider.sent[1]!.messages;
    expect(second).toHaveLength(3);
    const last = second[2]!;
    expect(last.role).toBe('user');
    expect(last.content[0]!.type).toBe('tool_result');
  });

  it('returns an error result when permission is denied (without executing)', async () => {
    const provider = new ScriptedProvider([
      [{ type: 'tool_call', id: 't1', name: 'danger', input: {} }, DONE],
      [DONE],
    ]);
    const { ui, events } = recordingUI();
    await makeLoop(provider, ui, gateWith('no')).run('go');

    expect(events).toContain('denied:danger');
    const second = provider.sent[1]!.messages;
    const toolResult = second[2]!.content[0]!;
    expect(toolResult.type).toBe('tool_result');
    if (toolResult.type === 'tool_result') {
      expect(toolResult.isError).toBe(true);
    }
  });

  it('returns an error for invalid tool input and never executes', async () => {
    const provider = new ScriptedProvider([
      [{ type: 'tool_call', id: 't1', name: 'echo', input: { text: 123 } }, DONE],
      [DONE],
    ]);
    const { ui, events } = recordingUI();
    await makeLoop(provider, ui, gateWith('yes')).run('go');

    expect(events).not.toContain('start:echo');
    const result = provider.sent[1]!.messages[2]!.content[0]!;
    if (result.type === 'tool_result') {
      expect(result.isError).toBe(true);
      expect(result.content).toContain('Invalid input');
    }
  });

  it('reports an unknown tool as an error', async () => {
    const provider = new ScriptedProvider([
      [{ type: 'tool_call', id: 't1', name: 'ghost', input: {} }, DONE],
      [DONE],
    ]);
    const { ui } = recordingUI();
    await makeLoop(provider, ui, gateWith('yes')).run('go');

    const result = provider.sent[1]!.messages[2]!.content[0]!;
    if (result.type === 'tool_result') {
      expect(result.content).toContain('Unknown tool');
    }
  });

  it('stops at the iteration guard when tools never stop', async () => {
    const looping: ProviderEvent[][] = [];
    for (let i = 0; i < 10; i += 1) {
      looping.push([{ type: 'tool_call', id: `t${i}`, name: 'echo', input: { text: 'x' } }, DONE]);
    }
    const provider = new ScriptedProvider(looping);
    const { ui, events } = recordingUI();
    await makeLoop(provider, ui, gateWith('yes'), 3).run('loop');

    expect(events).toContain('maxIter');
    expect(provider.sent).toHaveLength(3);
  });
});
