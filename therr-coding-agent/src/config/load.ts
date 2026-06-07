import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { z } from 'zod';

export type Provider = 'anthropic' | 'gemini';
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

/** Auto-approval rules that bypass the interactive permission prompt. */
export interface AllowRules {
  /** Tool names that never prompt (in addition to read-only tools). */
  tools: string[];
  /** Bash command prefixes that auto-approve (e.g. "npm test", "git status"). */
  bash: string[];
  /** Write/edit path globs that auto-approve (e.g. "src/**"). */
  write: string[];
}

export interface ResolvedConfig {
  provider: Provider;
  model: string;
  anthropicApiKey: string | undefined;
  geminiApiKey: string | undefined;
  maxTokens: number;
  thinking: boolean;
  effort: Effort;
  maxIterations: number;
  commandDirs: string[];
  allow: AllowRules;
}

export interface CliOverrides {
  provider?: Provider;
  model?: string;
  configPath?: string;
}

const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: 'claude-opus-4-8',
  gemini: 'gemini-2.5-pro',
};

const FileConfigSchema = z
  .object({
    provider: z.enum(['anthropic', 'gemini']).optional(),
    model: z.string().optional(),
    maxTokens: z.number().int().positive().optional(),
    thinking: z.boolean().optional(),
    effort: z.enum(['low', 'medium', 'high', 'xhigh', 'max']).optional(),
    maxIterations: z.number().int().positive().optional(),
    commandDirs: z.array(z.string()).optional(),
    allow: z
      .object({
        tools: z.array(z.string()).optional(),
        bash: z.array(z.string()).optional(),
        write: z.array(z.string()).optional(),
      })
      .optional(),
  })
  .strict();

export type FileConfig = z.infer<typeof FileConfigSchema>;

function readFileConfig(path: string): FileConfig {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, 'utf8');
  return FileConfigSchema.parse(JSON.parse(raw));
}

/**
 * Resolve configuration with precedence: defaults < config file < env < CLI flags.
 * Provider defaults to whichever API key is present (Anthropic wins if both).
 */
export function loadConfig(overrides: CliOverrides = {}, cwd: string = process.cwd()): ResolvedConfig {
  const home = homedir();
  const homeConfig = readFileConfig(join(home, '.config', 'therr-agent', 'config.json'));
  const projectConfig = overrides.configPath
    ? readFileConfig(overrides.configPath)
    : readFileConfig(join(cwd, 'therr-agent.config.json'));
  const file: FileConfig = { ...homeConfig, ...projectConfig };

  const env = process.env;
  const anthropicApiKey = env.ANTHROPIC_API_KEY || undefined;
  const geminiApiKey = env.GEMINI_API_KEY || undefined;

  const provider: Provider =
    overrides.provider ??
    (env.THERR_AGENT_PROVIDER as Provider | undefined) ??
    file.provider ??
    (anthropicApiKey ? 'anthropic' : geminiApiKey ? 'gemini' : 'anthropic');

  const model =
    overrides.model ?? env.THERR_AGENT_MODEL ?? file.model ?? DEFAULT_MODELS[provider];

  const maxTokens = env.THERR_AGENT_MAX_TOKENS
    ? Number(env.THERR_AGENT_MAX_TOKENS)
    : (file.maxTokens ?? 16_000);

  const effort = (env.THERR_AGENT_EFFORT as Effort | undefined) ?? file.effort ?? 'high';

  const defaultCommandDirs = [
    join(cwd, '.agent', 'commands'),
    join(home, '.config', 'therr-agent', 'commands'),
  ];

  return {
    provider,
    model,
    anthropicApiKey,
    geminiApiKey,
    maxTokens,
    thinking: file.thinking ?? true,
    effort,
    maxIterations: file.maxIterations ?? 50,
    commandDirs: file.commandDirs ?? defaultCommandDirs,
    allow: {
      tools: file.allow?.tools ?? [],
      bash: file.allow?.bash ?? [],
      write: file.allow?.write ?? [],
    },
  };
}
