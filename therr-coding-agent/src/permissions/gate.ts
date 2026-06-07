import type { Tool } from '../tools/types.js';
import type { AllowRules } from '../config/load.js';
import { globToRegExp } from '../util/walk.js';

export type PermissionChoice = 'yes' | 'no' | 'always';

export interface PermissionRequest {
  toolName: string;
  summary: string;
  input: unknown;
}

/** Asks the user to approve a mutating action. Returned by the REPL/UI layer. */
export type PermissionPrompt = (req: PermissionRequest) => Promise<PermissionChoice>;

function summarize(tool: Tool, input: unknown): string {
  const obj = (input ?? {}) as Record<string, unknown>;
  if (tool.name === 'bash') return `$ ${String(obj.command ?? '')}`;
  if (tool.name === 'write_file' || tool.name === 'edit_file') {
    return `${tool.name} ${String(obj.path ?? '')}`;
  }
  return `${tool.name} ${JSON.stringify(obj)}`;
}

/**
 * Decides whether a tool call may run. Read-only tools always run. Mutating
 * tools run if pre-approved by config, already approved this session, or the
 * user approves the interactive prompt.
 */
export class PermissionGate {
  private readonly sessionAllowed = new Set<string>();

  constructor(
    private readonly allow: AllowRules,
    private readonly prompt: PermissionPrompt,
  ) {}

  async check(tool: Tool, input: unknown): Promise<boolean> {
    if (!tool.mutating) return true;
    if (this.isPreApproved(tool, input)) return true;
    if (this.sessionAllowed.has(tool.name)) return true;

    const choice = await this.prompt({
      toolName: tool.name,
      summary: summarize(tool, input),
      input,
    });

    if (choice === 'always') {
      this.sessionAllowed.add(tool.name);
      return true;
    }
    return choice === 'yes';
  }

  private isPreApproved(tool: Tool, input: unknown): boolean {
    if (this.allow.tools.includes(tool.name)) return true;
    const obj = (input ?? {}) as Record<string, unknown>;

    if (tool.name === 'bash') {
      const cmd = String(obj.command ?? '').trim();
      return this.allow.bash.some((prefix) => cmd.startsWith(prefix));
    }
    if (tool.name === 'write_file' || tool.name === 'edit_file') {
      const path = String(obj.path ?? '');
      return this.allow.write.some((g) => globToRegExp(g).test(path));
    }
    return false;
  }
}
