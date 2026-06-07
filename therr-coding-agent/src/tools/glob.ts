import { z } from 'zod';
import { relative, sep } from 'node:path';
import { defineTool } from './types.js';
import { resolvePath } from '../util/paths.js';
import { globToRegExp, walkFiles } from '../util/walk.js';

const MAX_RESULTS = 500;

export const globTool = defineTool({
  name: 'glob',
  description:
    'Find files matching a glob pattern (e.g. "src/**/*.ts", "*.json"). ' +
    'Returns paths relative to the working directory. Ignores node_modules, .git, dist, etc.',
  mutating: false,
  schema: z.object({
    pattern: z.string().describe('Glob pattern to match file paths against.'),
    path: z.string().optional().describe('Directory to search in (default: working directory).'),
  }),
  async execute(input, ctx) {
    const root = resolvePath(ctx.cwd, input.path ?? '.');
    const re = globToRegExp(input.pattern);
    const matches: string[] = [];

    for await (const file of walkFiles(root, { maxFiles: 50_000 })) {
      const rel = relative(root, file).split(sep).join('/');
      if (re.test(rel)) {
        matches.push(rel);
        if (matches.length >= MAX_RESULTS) break;
      }
    }

    matches.sort((a, b) => a.localeCompare(b));
    return {
      output: matches.length > 0 ? matches.join('\n') : '(no matches)',
      summary: `${input.pattern} (${matches.length}${matches.length >= MAX_RESULTS ? '+' : ''})`,
    };
  },
});
