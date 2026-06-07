import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadProjectContext } from '../../src/config/context.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'therr-ctx-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('loadProjectContext', () => {
  it('finds AGENTS.md by walking up from a nested directory', async () => {
    await writeFile(join(root, 'AGENTS.md'), '# Rules\nbe nice');
    const nested = join(root, 'a', 'b');
    await mkdir(nested, { recursive: true });
    expect(loadProjectContext(nested)).toContain('be nice');
  });

  it('returns an empty string when no context file exists', async () => {
    const dir = join(root, 'empty');
    await mkdir(dir);
    expect(loadProjectContext(dir)).toBe('');
  });
});
