import { z } from 'zod';
import { readFile, writeFile } from 'node:fs/promises';
import { defineTool } from './types.js';
import { resolvePath } from '../util/paths.js';

export const editFileTool = defineTool({
  name: 'edit_file',
  description:
    'Replace an exact string in a file. By default `old_string` must match exactly once; ' +
    'set `replace_all` to replace every occurrence. Include enough surrounding context to be unique.',
  mutating: true,
  schema: z.object({
    path: z.string().describe('File path, relative to the working directory or absolute.'),
    old_string: z.string().describe('The exact text to replace.'),
    new_string: z.string().describe('The replacement text.'),
    replace_all: z.boolean().optional().describe('Replace every occurrence (default false).'),
  }),
  async execute(input, ctx) {
    const full = resolvePath(ctx.cwd, input.path);
    let content: string;
    try {
      content = await readFile(full, 'utf8');
    } catch (err) {
      return { output: `Could not read ${input.path}: ${(err as Error).message}`, isError: true };
    }

    if (input.old_string === input.new_string) {
      return { output: 'old_string and new_string are identical; nothing to do.', isError: true };
    }

    const occurrences = content.split(input.old_string).length - 1;
    if (occurrences === 0) {
      return { output: `old_string not found in ${input.path}.`, isError: true };
    }
    if (occurrences > 1 && !input.replace_all) {
      return {
        output: `old_string matches ${occurrences} times in ${input.path}. Add more context to make it unique, or set replace_all.`,
        isError: true,
      };
    }

    const updated = input.replace_all
      ? content.split(input.old_string).join(input.new_string)
      : content.replace(input.old_string, input.new_string);

    try {
      await writeFile(full, updated, 'utf8');
    } catch (err) {
      return { output: `Could not write ${input.path}: ${(err as Error).message}`, isError: true };
    }

    const replaced = input.replace_all ? occurrences : 1;
    return {
      output: `Edited ${input.path} (${replaced} replacement${replaced === 1 ? '' : 's'}).`,
      summary: `${input.path} (${replaced} edit${replaced === 1 ? '' : 's'})`,
    };
  },
});
