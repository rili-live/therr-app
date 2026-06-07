import { describe, it, expect } from 'vitest';
import { buildSystemPrompt } from '../../src/agent/systemPrompt.js';

const tools = [
  { name: 'read_file', description: 'read', jsonSchema: { type: 'object' } },
  { name: 'bash', description: 'run', jsonSchema: { type: 'object' } },
];

describe('buildSystemPrompt', () => {
  it('includes the cwd, tool list, and project context', () => {
    const prompt = buildSystemPrompt({
      cwd: '/work',
      projectContext: 'Use tabs not spaces.',
      tools,
    });
    expect(prompt).toContain('/work');
    expect(prompt).toContain('- read_file: read');
    expect(prompt).toContain('- bash: run');
    expect(prompt).toContain('Use tabs not spaces.');
  });

  it('omits the project section when context is empty', () => {
    const prompt = buildSystemPrompt({ cwd: '/work', projectContext: '   ', tools });
    expect(prompt).not.toContain('Project-specific instructions');
  });
});
