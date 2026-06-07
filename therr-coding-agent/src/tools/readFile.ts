import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { defineTool } from './types.js';
import { resolvePath } from '../util/paths.js';

export const readFileTool = defineTool({
  name: 'read_file',
  description:
    'Read a UTF-8 text file from disk. Returns the content with 1-based line numbers prefixed.',
  mutating: false,
  schema: z.object({
    path: z.string().describe('File path, relative to the working directory or absolute.'),
    offset: z.number().int().min(1).optional().describe('1-based line number to start reading at.'),
    limit: z.number().int().min(1).optional().describe('Maximum number of lines to read.'),
  }),
  async execute(input, ctx) {
    const full = resolvePath(ctx.cwd, input.path);
    let content: string;
    try {
      content = await readFile(full, 'utf8');
    } catch (err) {
      return { output: `Could not read ${input.path}: ${(err as Error).message}`, isError: true };
    }

    const lines = content.split('\n');
    const start = (input.offset ?? 1) - 1;
    const end = input.limit !== undefined ? start + input.limit : lines.length;
    const slice = lines.slice(start, end);

    const numbered = slice
      .map((line, idx) => `${String(start + idx + 1).padStart(5)}\t${line}`)
      .join('\n');

    return {
      output: numbered || '(empty file)',
      summary: `${input.path} (${slice.length} lines)`,
    };
  },
});
