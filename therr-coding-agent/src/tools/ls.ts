import { z } from 'zod';
import { readdir } from 'node:fs/promises';
import { defineTool } from './types.js';
import { resolvePath } from '../util/paths.js';

export const lsTool = defineTool({
  name: 'ls',
  description: 'List the entries of a directory. Directories are suffixed with "/".',
  mutating: false,
  schema: z.object({
    path: z
      .string()
      .optional()
      .describe('Directory path (default: the working directory).'),
  }),
  async execute(input, ctx) {
    const full = resolvePath(ctx.cwd, input.path ?? '.');
    let entries;
    try {
      entries = await readdir(full, { withFileTypes: true });
    } catch (err) {
      return { output: `Could not list ${input.path ?? '.'}: ${(err as Error).message}`, isError: true };
    }
    const names = entries
      .map((e) => (e.isDirectory() ? `${e.name}/` : e.name))
      .sort((a, b) => a.localeCompare(b));
    return {
      output: names.length > 0 ? names.join('\n') : '(empty directory)',
      summary: `${input.path ?? '.'} (${names.length})`,
    };
  },
});
