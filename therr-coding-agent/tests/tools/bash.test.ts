import { describe, it, expect } from 'vitest';
import { bashTool } from '../../src/tools/bash.js';

describe('bash', () => {
  it('returns combined output of a successful command', async () => {
    const res = await bashTool.execute({ command: 'echo hello' }, { cwd: process.cwd() });
    expect(res.isError).toBeUndefined();
    expect(res.output).toContain('hello');
  });

  it('marks a failing command as an error', async () => {
    const res = await bashTool.execute({ command: 'exit 3' }, { cwd: process.cwd() });
    expect(res.isError).toBe(true);
  });

  it('runs in the provided working directory', async () => {
    const res = await bashTool.execute({ command: 'pwd' }, { cwd: process.cwd() });
    expect(res.output.trim()).toBe(process.cwd());
  });
});
