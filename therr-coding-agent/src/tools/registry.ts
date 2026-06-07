import type { z } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';
import type { Tool } from './types.js';
import type { ToolSchema } from '../providers/types.js';
import { readFileTool } from './readFile.js';
import { writeFileTool } from './writeFile.js';
import { editFileTool } from './editFile.js';
import { bashTool } from './bash.js';
import { lsTool } from './ls.js';
import { globTool } from './glob.js';
import { grepTool } from './grep.js';

/** The MVP tool set. Order is the order presented to the model. */
export const ALL_TOOLS: Tool[] = [
  readFileTool,
  writeFileTool,
  editFileTool,
  bashTool,
  lsTool,
  globTool,
  grepTool,
];

/** Convert a zod schema into a clean, self-contained JSON Schema object. */
export function toJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const js = zodToJsonSchema(schema, { target: 'jsonSchema7', $refStrategy: 'none' }) as Record<
    string,
    unknown
  >;
  // Drop the meta `$schema` key — providers want a bare object schema.
  const { $schema: _drop, ...rest } = js;
  return rest;
}

export interface ToolRegistry {
  list(): Tool[];
  get(name: string): Tool | undefined;
  toSchemas(): ToolSchema[];
}

export function createRegistry(tools: Tool[] = ALL_TOOLS): ToolRegistry {
  const byName = new Map(tools.map((t) => [t.name, t]));
  return {
    list: () => tools,
    get: (name) => byName.get(name),
    toSchemas: () =>
      tools.map((t) => ({
        name: t.name,
        description: t.description,
        jsonSchema: toJsonSchema(t.schema),
      })),
  };
}
