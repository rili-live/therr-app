import { GoogleGenAI } from '@google/genai';
import type { Message } from '../agent/types.js';
import type { ModelProvider, ProviderEvent, SendRequest } from './types.js';

export interface GeminiProviderOptions {
  apiKey: string;
  model: string;
}

export interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

export interface GeminiContent {
  role: 'user' | 'model';
  parts: GeminiPart[];
}

/**
 * Translate internal messages into Gemini `contents`. Gemini correlates
 * function responses to calls by *name* (not id), so we resolve each
 * tool_result's name from the earlier tool_use block that produced it.
 */
export function toGeminiContents(messages: Message[]): GeminiContent[] {
  const idToName = new Map<string, string>();
  for (const m of messages) {
    for (const b of m.content) {
      if (b.type === 'tool_use') idToName.set(b.id, b.name);
    }
  }

  return messages.map((m) => {
    const parts: GeminiPart[] = [];
    for (const b of m.content) {
      switch (b.type) {
        case 'text':
          if (b.text.length > 0) parts.push({ text: b.text });
          break;
        case 'tool_use':
          parts.push({
            functionCall: { name: b.name, args: (b.input ?? {}) as Record<string, unknown> },
          });
          break;
        case 'tool_result':
          parts.push({
            functionResponse: {
              name: idToName.get(b.toolUseId) ?? 'unknown',
              response: b.isError ? { error: b.content } : { output: b.content },
            },
          });
          break;
      }
    }
    return { role: m.role === 'assistant' ? 'model' : 'user', parts };
  });
}

export class GeminiProvider implements ModelProvider {
  readonly name = 'gemini' as const;
  readonly model: string;
  private readonly client: GoogleGenAI;

  constructor(opts: GeminiProviderOptions) {
    this.client = new GoogleGenAI({ apiKey: opts.apiKey });
    this.model = opts.model;
  }

  async *send(req: SendRequest): AsyncIterable<ProviderEvent> {
    const config = {
      systemInstruction: req.system,
      tools: [
        {
          functionDeclarations: req.tools.map((t) => ({
            name: t.name,
            description: t.description,
            parametersJsonSchema: t.jsonSchema,
          })),
        },
      ],
    };

    const stream = await this.client.models.generateContentStream({
      model: this.model,
      contents: toGeminiContents(req.messages) as never,
      config: config as never,
    });

    const calls: { name: string; args: Record<string, unknown> }[] = [];
    let usage = { inputTokens: 0, outputTokens: 0 };

    for await (const chunk of stream) {
      const text = chunk.text;
      if (text) yield { type: 'text', delta: text };

      const fnCalls = chunk.functionCalls;
      if (fnCalls) {
        for (const c of fnCalls) {
          if (c.name) calls.push({ name: c.name, args: (c.args ?? {}) as Record<string, unknown> });
        }
      }

      if (chunk.usageMetadata) {
        usage = {
          inputTokens: chunk.usageMetadata.promptTokenCount ?? 0,
          outputTokens: chunk.usageMetadata.candidatesTokenCount ?? 0,
        };
      }
    }

    // Gemini has no native call id; synthesize a stable one for the loop.
    // It is never sent back to Gemini (responses correlate by name).
    for (let i = 0; i < calls.length; i += 1) {
      const c = calls[i] as { name: string; args: Record<string, unknown> };
      yield { type: 'tool_call', id: `gemini-call-${i}`, name: c.name, input: c.args };
    }

    yield {
      type: 'done',
      usage,
      stopReason: calls.length > 0 ? 'tool_use' : 'end_turn',
    };
  }
}
