/**
 * Internal, provider-agnostic conversation types.
 *
 * Both the Anthropic and Gemini adapters translate to and from these shapes so
 * the agent loop never depends on a vendor SDK. Keep this module free of any
 * `@anthropic-ai/sdk` / `@google/genai` imports.
 */

export type Role = 'user' | 'assistant';

export interface TextBlock {
  type: 'text';
  text: string;
}

export interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: unknown;
}

export interface ToolResultBlock {
  type: 'tool_result';
  toolUseId: string;
  content: string;
  isError: boolean;
}

export type ContentBlock = TextBlock | ToolUseBlock | ToolResultBlock;

export interface Message {
  role: Role;
  content: ContentBlock[];
}
