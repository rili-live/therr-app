import pc from 'picocolors';
import type { AgentUI } from '../agent/loop.js';
import type { ToolResult } from '../tools/types.js';

function preview(name: string, input: unknown): string {
  const obj = (input ?? {}) as Record<string, unknown>;
  if (name === 'bash') return `$ ${String(obj.command ?? '')}`;
  if (name === 'glob' || name === 'grep') return String(obj.pattern ?? '');
  if (obj.path !== undefined) return String(obj.path);
  return JSON.stringify(obj);
}

function truncate(s: string, n: number): string {
  const oneLine = s.replace(/\s*\n\s*/g, ' ').trim();
  return oneLine.length > n ? `${oneLine.slice(0, n)}…` : oneLine;
}

/** Minimal streaming UI: assistant text inline, compact colored tool summaries. */
export function createTerminalUI(): AgentUI {
  let atLineStart = true;

  const write = (s: string): void => {
    if (s.length === 0) return;
    process.stdout.write(s);
    atLineStart = s.endsWith('\n');
  };

  const ensureNewline = (): void => {
    if (!atLineStart) write('\n');
  };

  return {
    onText(delta) {
      write(delta);
    },
    onToolStart(name, input) {
      ensureNewline();
      write(`${pc.cyan(`● ${name}`)} ${pc.dim(preview(name, input))}\n`);
    },
    onToolResult(_name, result: ToolResult) {
      const status = result.isError ? pc.red('✗') : pc.green('✓');
      const detail = result.summary ?? truncate(result.output, 200);
      write(`  ${status} ${pc.dim(detail)}\n`);
    },
    onToolDenied(name) {
      ensureNewline();
      write(pc.yellow(`  ⊘ ${name} denied\n`));
    },
    onUsage() {
      // Token usage is available here; kept silent to reduce noise in the MVP.
    },
    onAssistantEnd() {
      ensureNewline();
    },
    onMaxIterations() {
      ensureNewline();
      write(pc.yellow('[Reached max iterations — stopping]\n'));
    },
  };
}
