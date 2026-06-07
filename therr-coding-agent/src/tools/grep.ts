import { z } from 'zod';
import { readFile } from 'node:fs/promises';
import { relative, sep } from 'node:path';
import { defineTool } from './types.js';
import { resolvePath } from '../util/paths.js';
import { globToRegExp, walkFiles } from '../util/walk.js';

const MAX_MATCHES = 200;

/** Heuristic: a NUL byte in the first 8KB means the file is almost certainly binary. */
function looksBinary(content: string): boolean {
  const len = Math.min(content.length, 8192);
  for (let i = 0; i < len; i += 1) {
    if (content.charCodeAt(i) === 0) return true;
  }
  return false;
}

export const grepTool = defineTool({
  name: 'grep',
  description:
    'Search file contents with a regular expression. Returns matching lines as ' +
    '"path:line: text". Optionally restrict to files matching a glob.',
  mutating: false,
  schema: z.object({
    pattern: z.string().describe('Regular expression to search for.'),
    path: z.string().optional().describe('Directory to search in (default: working directory).'),
    glob: z.string().optional().describe('Only search files whose path matches this glob.'),
    ignore_case: z.boolean().optional().describe('Case-insensitive match (default false).'),
  }),
  async execute(input, ctx) {
    const root = resolvePath(ctx.cwd, input.path ?? '.');
    let re: RegExp;
    try {
      re = new RegExp(input.pattern, input.ignore_case ? 'i' : undefined);
    } catch (err) {
      return { output: `Invalid regex: ${(err as Error).message}`, isError: true };
    }
    const globRe = input.glob ? globToRegExp(input.glob) : undefined;

    const results: string[] = [];
    outer: for await (const file of walkFiles(root, { maxFiles: 50_000 })) {
      const rel = relative(root, file).split(sep).join('/');
      if (globRe && !globRe.test(rel)) continue;

      let content: string;
      try {
        content = await readFile(file, 'utf8');
      } catch {
        continue; // skip unreadable files
      }
      if (looksBinary(content)) continue;

      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i += 1) {
        const line = lines[i] as string;
        if (re.test(line)) {
          results.push(`${rel}:${i + 1}: ${line.trim()}`);
          if (results.length >= MAX_MATCHES) break outer;
        }
      }
    }

    return {
      output: results.length > 0 ? results.join('\n') : '(no matches)',
      summary: `${input.pattern} (${results.length}${results.length >= MAX_MATCHES ? '+' : ''})`,
    };
  },
});
