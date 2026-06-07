import { isAbsolute, resolve } from 'node:path';

/** Resolve a user-supplied path against the working directory. */
export function resolvePath(cwd: string, p: string): string {
  return isAbsolute(p) ? p : resolve(cwd, p);
}
