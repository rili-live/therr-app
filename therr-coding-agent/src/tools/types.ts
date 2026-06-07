import type { z } from 'zod';

export interface ToolContext {
  /** Absolute path the tool should treat as the working directory root. */
  cwd: string;
}

export interface ToolResult {
  /** Text returned to the model as the tool result. */
  output: string;
  /** When true, the result is reported to the model as an error. */
  isError?: boolean;
  /** Optional short summary for the UI (e.g. "+3 -1", "12 matches"). */
  summary?: string;
}

/**
 * A tool is fully described by a zod schema: it yields the runtime validator,
 * the inferred TypeScript type for {@link Tool.execute}, and (via the registry)
 * the JSON Schema sent to the model. One source of truth, no drift.
 */
export interface Tool<S extends z.ZodTypeAny = z.ZodTypeAny> {
  name: string;
  description: string;
  schema: S;
  /** Mutating tools pass through the permission gate before executing. */
  mutating: boolean;
  execute(input: z.infer<S>, ctx: ToolContext): Promise<ToolResult>;
}

/**
 * Identity helper that preserves the schema's generic so `execute`'s `input`
 * is fully typed at the definition site. Without it, annotating a tool as
 * `Tool` would erase the schema to `ZodTypeAny` and `input` would be `any`.
 */
export function defineTool<S extends z.ZodTypeAny>(tool: Tool<S>): Tool<S> {
  return tool;
}
