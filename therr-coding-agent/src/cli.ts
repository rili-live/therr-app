import { parseArgs } from 'node:util';
import { createRequire } from 'node:module';
import { startRepl } from './repl.js';
import type { CliOverrides, Provider } from './config/load.js';

const require = createRequire(import.meta.url);
const pkg = require('../package.json') as { version: string };

const USAGE = `therr-agent — a small, extensible CLI coding agent

Usage:
  therr-agent [options]

Options:
  --provider <name>   anthropic | gemini (default: inferred from API keys)
  --model <id>        Model id override
  --config <path>     Path to a config JSON file
  -v, --version       Print version
  -h, --help          Show this help

Environment:
  ANTHROPIC_API_KEY   Required for the Anthropic provider
  GEMINI_API_KEY      Required for the Gemini provider
`;

function main(): void {
  const { values } = parseArgs({
    options: {
      provider: { type: 'string' },
      model: { type: 'string' },
      config: { type: 'string' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
    allowPositionals: true,
  });

  if (values.help) {
    process.stdout.write(USAGE);
    return;
  }
  if (values.version) {
    process.stdout.write(`${pkg.version}\n`);
    return;
  }

  const overrides: CliOverrides = {};
  if (values.provider) overrides.provider = values.provider as Provider;
  if (values.model) overrides.model = values.model;
  if (values.config) overrides.configPath = values.config;

  startRepl(overrides).catch((err: unknown) => {
    process.stderr.write(`${(err as Error).message}\n`);
    process.exit(1);
  });
}

main();
