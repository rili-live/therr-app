import { readFileSync, existsSync } from 'node:fs';
import { dirname, join, parse } from 'node:path';

/** File names searched for project instructions, in priority order. */
const CONTEXT_FILES = ['AGENTS.md', 'CLAUDE.md', '.agent/AGENTS.md'];

/**
 * Walk up from `cwd` looking for a project instructions file. Returns its
 * contents, or an empty string if none is found.
 */
export function loadProjectContext(cwd: string = process.cwd()): string {
  let dir = cwd;
  const { root } = parse(cwd);

  for (;;) {
    for (const name of CONTEXT_FILES) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) {
        try {
          return readFileSync(candidate, 'utf8');
        } catch {
          // fall through to next candidate
        }
      }
    }
    if (dir === root) break;
    dir = dirname(dir);
  }
  return '';
}
