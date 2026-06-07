import { describe, it, expect, vi } from 'vitest';
import { PermissionGate } from '../../src/permissions/gate.js';
import type { PermissionChoice } from '../../src/permissions/gate.js';
import type { AllowRules } from '../../src/config/load.js';
import { readFileTool } from '../../src/tools/readFile.js';
import { bashTool } from '../../src/tools/bash.js';
import { writeFileTool } from '../../src/tools/writeFile.js';

const noAllow: AllowRules = { tools: [], bash: [], write: [] };

function gate(allow: AllowRules, choice: PermissionChoice = 'no') {
  const prompt = vi.fn(async () => choice);
  return { gate: new PermissionGate(allow, prompt), prompt };
}

describe('PermissionGate', () => {
  it('always allows read-only tools without prompting', async () => {
    const { gate: g, prompt } = gate(noAllow);
    expect(await g.check(readFileTool, { path: 'a' })).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
  });

  it('prompts for a mutating tool and honors yes/no', async () => {
    const yes = gate(noAllow, 'yes');
    expect(await yes.gate.check(bashTool, { command: 'rm -rf x' })).toBe(true);
    expect(yes.prompt).toHaveBeenCalledOnce();

    const no = gate(noAllow, 'no');
    expect(await no.gate.check(bashTool, { command: 'rm -rf x' })).toBe(false);
  });

  it('caches "always" for the rest of the session', async () => {
    const { gate: g, prompt } = gate(noAllow, 'always');
    expect(await g.check(bashTool, { command: 'ls' })).toBe(true);
    expect(await g.check(bashTool, { command: 'pwd' })).toBe(true);
    expect(prompt).toHaveBeenCalledOnce();
  });

  it('pre-approves bash command prefixes from config', async () => {
    const { gate: g, prompt } = gate({ ...noAllow, bash: ['npm test'] });
    expect(await g.check(bashTool, { command: 'npm test -- --watch' })).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
    expect(await g.check(bashTool, { command: 'rm file' })).toBe(false);
  });

  it('pre-approves write paths matching a glob', async () => {
    const { gate: g, prompt } = gate({ ...noAllow, write: ['src/**'] });
    expect(await g.check(writeFileTool, { path: 'src/a/b.ts', content: '' })).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
    expect(await g.check(writeFileTool, { path: 'secrets.txt', content: '' })).toBe(false);
  });

  it('pre-approves explicitly allowlisted tool names', async () => {
    const { gate: g, prompt } = gate({ ...noAllow, tools: ['bash'] });
    expect(await g.check(bashTool, { command: 'anything' })).toBe(true);
    expect(prompt).not.toHaveBeenCalled();
  });
});
