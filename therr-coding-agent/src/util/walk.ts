import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

const DEFAULT_IGNORES = new Set([
  'node_modules',
  '.git',
  'dist',
  'coverage',
  '.next',
  'build',
  '.cache',
]);

export interface WalkOptions {
  ignoreDirs?: Set<string>;
  maxFiles?: number;
}

/** Recursively yield absolute file paths under `root`, skipping ignored dirs. */
export async function* walkFiles(root: string, opts: WalkOptions = {}): AsyncGenerator<string> {
  const ignore = opts.ignoreDirs ?? DEFAULT_IGNORES;
  const stack: string[] = [root];
  let count = 0;

  while (stack.length > 0) {
    const dir = stack.pop() as string;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!ignore.has(entry.name)) stack.push(full);
      } else if (entry.isFile()) {
        yield full;
        count += 1;
        if (opts.maxFiles !== undefined && count >= opts.maxFiles) return;
      }
    }
  }
}

/** Convert a glob pattern into an anchored RegExp matched against `/`-paths. */
export function globToRegExp(glob: string): RegExp {
  let re = '';
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i] as string;
    if (c === '*') {
      if (glob[i + 1] === '*') {
        re += '.*';
        i += 1;
        if (glob[i + 1] === '/') i += 1;
      } else {
        re += '[^/]*';
      }
    } else if (c === '?') {
      re += '[^/]';
    } else if ('.+^${}()|[]\\'.includes(c)) {
      re += `\\${c}`;
    } else {
      re += c;
    }
  }
  return new RegExp(`^${re}$`);
}
