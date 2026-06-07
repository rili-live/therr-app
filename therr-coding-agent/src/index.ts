/**
 * Public programmatic API. The CLI is the primary surface, but these exports
 * let you embed the agent loop, register custom tools, or swap providers.
 */
export type { Message, ContentBlock, TextBlock, ToolUseBlock, ToolResultBlock, Role } from './agent/types.js';
export { AgentLoop } from './agent/loop.js';
export type { AgentUI, AgentLoopOptions } from './agent/loop.js';
export { buildSystemPrompt } from './agent/systemPrompt.js';
export type { SystemPromptParams } from './agent/systemPrompt.js';

export { createProvider, AnthropicProvider, GeminiProvider } from './providers/index.js';
export type { ModelProvider, ProviderEvent, SendRequest, ToolSchema, Usage } from './providers/types.js';

export { ALL_TOOLS, createRegistry, toJsonSchema } from './tools/registry.js';
export type { ToolRegistry } from './tools/registry.js';
export { defineTool } from './tools/types.js';
export type { Tool, ToolContext, ToolResult } from './tools/types.js';

export { PermissionGate } from './permissions/gate.js';
export type { PermissionPrompt, PermissionRequest, PermissionChoice } from './permissions/gate.js';

export { loadConfig } from './config/load.js';
export type { ResolvedConfig, CliOverrides, Provider, Effort, AllowRules } from './config/load.js';
export { loadProjectContext } from './config/context.js';

export { loadCommands, renderCommand } from './commands/loader.js';
export type { Command } from './commands/types.js';
