import { z } from 'zod';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { defineTool } from './types.js';
import { resolvePath } from '../util/paths.js';

export const writeFileTool = defineTool({
  name: 'write_file',
  description:
    'Write a file to disk, overwriting it if it exists. Creates parent directories as needed.',
  mutating: true,
  schema: z.object({
    path: z.string().describe('File path, relative to the working directory or absolute.'),
    content: z.string().describe('Full content to write to the file.'),
  }),
  async execute(input, ctx) {
    const full = resolvePath(ctx.cwd, input.path);
    try {
      await mkdir(dirname(full), { recursive: true });
      await writeFile(full, input.content, 'utf8');
    } catch (err) {
      return { output: `Could not write ${input.path}: ${(err as Error).message}`, isError: true };
    }
    const lineCount = input.content.split('\n').length;
    return { output: `Wrote ${input.path} (${lineCount} lines).`, summary: input.path };
  },
});
