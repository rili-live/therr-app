import { z } from 'zod';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { defineTool } from './types.js';

const execAsync = promisify(exec);

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_BUFFER = 10 * 1024 * 1024;

export const bashTool = defineTool({
  name: 'bash',
  description:
    'Run a shell command in the working directory and return combined stdout/stderr. ' +
    'Use for builds, tests, git, and other CLI tasks.',
  mutating: true,
  schema: z.object({
    command: z.string().describe('The shell command to execute.'),
    timeout_ms: z
      .number()
      .int()
      .min(1)
      .max(600_000)
      .optional()
      .describe('Timeout in milliseconds (default 120000).'),
  }),
  async execute(input, ctx) {
    try {
      const { stdout, stderr } = await execAsync(input.command, {
        cwd: ctx.cwd,
        timeout: input.timeout_ms ?? DEFAULT_TIMEOUT_MS,
        maxBuffer: MAX_BUFFER,
        shell: '/bin/bash',
      });
      const out = [stdout, stderr].map((s) => s.trim()).filter(Boolean).join('\n');
      return { output: out || '(no output)', summary: input.command };
    } catch (err) {
      const e = err as { stdout?: string; stderr?: string; message?: string };
      const out = [e.stdout, e.stderr, e.message]
        .map((s) => (s ?? '').trim())
        .filter(Boolean)
        .join('\n');
      return { output: out || 'Command failed.', isError: true, summary: input.command };
    }
  },
});
