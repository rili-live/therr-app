import * as readline from 'node:readline';
import pc from 'picocolors';
import { createTerminalUI } from './ui/render.js';
import { AgentLoop } from './agent/loop.js';
import { PermissionGate } from './permissions/gate.js';
import type { PermissionPrompt } from './permissions/gate.js';
import { createRegistry } from './tools/registry.js';
import { createProvider } from './providers/index.js';
import { loadConfig } from './config/load.js';
import type { CliOverrides } from './config/load.js';
import { loadProjectContext } from './config/context.js';
import { buildSystemPrompt } from './agent/systemPrompt.js';
import { loadCommands, renderCommand } from './commands/loader.js';
import type { Command } from './commands/types.js';

function printHelp(commands: Map<string, Command>): void {
  console.log(pc.bold('\nBuilt-in:'));
  console.log('  /help            Show this help');
  console.log('  /exit, /quit     Leave the session');
  if (commands.size > 0) {
    console.log(pc.bold('\nCustom commands:'));
    for (const cmd of commands.values()) {
      const hint = cmd.argumentHint ? pc.dim(` ${cmd.argumentHint}`) : '';
      console.log(`  /${cmd.name}${hint}  ${pc.dim(cmd.description)}`);
    }
  }
}

export async function startRepl(overrides: CliOverrides): Promise<void> {
  const cwd = process.cwd();
  const config = loadConfig(overrides, cwd);
  const provider = createProvider(config); // throws with a clear message if the API key is missing
  const registry = createRegistry();
  const projectContext = loadProjectContext(cwd);
  const system = buildSystemPrompt({ cwd, projectContext, tools: registry.toSchemas() });
  const commands = loadCommands(config.commandDirs);

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  const prompt: PermissionPrompt = (req) =>
    new Promise((resolve) => {
      const label = pc.yellow(`\nAllow ${req.toolName}?`);
      rl.question(`${label} ${pc.dim(req.summary)} [y/N/a] `, (answer) => {
        const a = answer.trim().toLowerCase();
        if (a === 'a' || a === 'always') resolve('always');
        else if (a === 'y' || a === 'yes') resolve('yes');
        else resolve('no');
      });
    });

  const gate = new PermissionGate(config.allow, prompt);
  const ui = createTerminalUI();
  const agent = new AgentLoop({
    provider,
    registry,
    gate,
    system,
    ui,
    cwd,
    maxIterations: config.maxIterations,
  });

  console.log(
    pc.bold('therr-agent') + pc.dim(` · ${provider.name}:${provider.model} · ${cwd}`),
  );
  if (projectContext.trim().length > 0) {
    console.log(pc.dim('Loaded project context.'));
  }
  console.log(pc.dim('Type a request, /help for commands, /exit to quit.'));

  const handle = async (line: string): Promise<void> => {
    const input = line.trim();
    if (input.length === 0) {
      ask();
      return;
    }
    if (input === '/exit' || input === '/quit') {
      rl.close();
      return;
    }
    if (input === '/help') {
      printHelp(commands);
      ask();
      return;
    }

    let userMessage = input;
    if (input.startsWith('/')) {
      const [name, ...rest] = input.slice(1).split(' ');
      const cmd = name ? commands.get(name) : undefined;
      if (!cmd) {
        console.log(pc.red(`Unknown command: /${name ?? ''} (try /help)`));
        ask();
        return;
      }
      userMessage = renderCommand(cmd, rest.join(' '));
    }

    try {
      await agent.run(userMessage);
    } catch (err) {
      console.error(pc.red(`\nError: ${(err as Error).message}`));
    }
    ask();
  };

  const ask = (): void => {
    rl.question(pc.green('\n› '), (line) => {
      void handle(line);
    });
  };

  rl.on('close', () => {
    console.log(pc.dim('\nBye.'));
    process.exit(0);
  });

  ask();
}
