import type { Message } from '../agent/types.js';

/** A tool definition normalized for any provider. */
export interface ToolSchema {
  name: string;
  description: string;
  /** JSON Schema describing the tool's input object. */
  jsonSchema: Record<string, unknown>;
}

export interface Usage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * The normalized event stream emitted by every provider adapter. The agent
 * loop consumes only these events — it never sees a vendor-specific shape.
 */
export type ProviderEvent =
  | { type: 'text'; delta: string }
  | { type: 'tool_call'; id: string; name: string; input: unknown }
  | { type: 'done'; usage: Usage; stopReason: string };

export interface SendRequest {
  system: string;
  messages: Message[];
  tools: ToolSchema[];
}

/**
 * The single abstraction that makes models interchangeable. Implementations
 * adapt their SDK's request/response shapes to {@link SendRequest} and
 * {@link ProviderEvent}.
 */
export interface ModelProvider {
  readonly name: 'anthropic' | 'gemini';
  readonly model: string;
  send(req: SendRequest): AsyncIterable<ProviderEvent>;
}
