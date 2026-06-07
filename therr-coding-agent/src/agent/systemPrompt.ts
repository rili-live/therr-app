import type { ToolSchema } from '../providers/types.js';

export interface SystemPromptParams {
  cwd: string;
  projectContext: string;
  tools: ToolSchema[];
}

const BASE_PERSONA = `You are a precise, autonomous coding agent operating in a terminal.

Guidelines:
- Use the provided tools to inspect and modify the codebase rather than guessing.
- Read files before editing them. Prefer small, targeted edits.
- When you run commands, explain briefly what you are doing only if it is non-obvious.
- Match the conventions of the surrounding code.
- When the task is complete, give a short summary of what changed. Do not narrate routine steps.`;

/** Compose the system prompt from persona, environment, tools, and project context. */
export function buildSystemPrompt(params: SystemPromptParams): string {
  const toolList = params.tools.map((t) => `- ${t.name}: ${t.description}`).join('\n');

  const sections = [
    BASE_PERSONA,
    `Working directory: ${params.cwd}`,
    `Available tools:\n${toolList}`,
  ];

  if (params.projectContext.trim().length > 0) {
    sections.push(
      `Project-specific instructions (from the project's context file):\n\n${params.projectContext.trim()}`,
    );
  }

  return sections.join('\n\n');
}
