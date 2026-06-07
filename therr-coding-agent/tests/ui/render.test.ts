import { describe, it, expect, vi, afterEach } from 'vitest';
import { createTerminalUI } from '../../src/ui/render.js';

function capture(fn: (write: ReturnType<typeof vi.fn>) => void): string {
  const write = vi.fn();
  const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: string | Uint8Array) => {
    write(String(chunk));
    return true;
  });
  fn(write);
  spy.mockRestore();
  return write.mock.calls.map((c) => c[0]).join('');
}

afterEach(() => vi.restoreAllMocks());

describe('createTerminalUI', () => {
  it('streams text and renders a tool start with a preview', () => {
    const out = capture(() => {
      const ui = createTerminalUI();
      ui.onText('thinking...');
      ui.onToolStart('bash', { command: 'npm test' });
    });
    expect(out).toContain('thinking...');
    expect(out).toContain('bash');
    expect(out).toContain('$ npm test');
  });

  it('renders tool results and denials', () => {
    const out = capture(() => {
      const ui = createTerminalUI();
      ui.onToolResult('read_file', { output: 'ok', summary: 'a.txt (1 lines)' });
      ui.onToolResult('bash', { output: 'failed', isError: true });
      ui.onToolDenied('write_file');
      ui.onMaxIterations();
    });
    expect(out).toContain('a.txt (1 lines)');
    expect(out).toContain('write_file denied');
    expect(out).toContain('max iterations');
  });

  it('previews path- and pattern-based tools', () => {
    const out = capture(() => {
      const ui = createTerminalUI();
      ui.onToolStart('read_file', { path: 'src/x.ts' });
      ui.onToolStart('glob', { pattern: '**/*.ts' });
    });
    expect(out).toContain('src/x.ts');
    expect(out).toContain('**/*.ts');
  });
});
