import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfig } from '../../src/config/load.js';

const ENV_KEYS = [
  'ANTHROPIC_API_KEY',
  'GEMINI_API_KEY',
  'THERR_AGENT_PROVIDER',
  'THERR_AGENT_MODEL',
  'THERR_AGENT_MAX_TOKENS',
  'THERR_AGENT_EFFORT',
  'HOME',
];

let cwd: string;
let saved: Record<string, string | undefined>;

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'therr-cfg-'));
  saved = {};
  for (const k of ENV_KEYS) {
    saved[k] = process.env[k];
    delete process.env[k];
  }
  // Isolate from any real ~/.config/therr-agent/config.json
  process.env.HOME = cwd;
});

afterEach(async () => {
  for (const k of ENV_KEYS) {
    if (saved[k] === undefined) delete process.env[k];
    else process.env[k] = saved[k];
  }
  await rm(cwd, { recursive: true, force: true });
});

describe('loadConfig', () => {
  it('infers anthropic when only ANTHROPIC_API_KEY is set', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const cfg = loadConfig({}, cwd);
    expect(cfg.provider).toBe('anthropic');
    expect(cfg.model).toBe('claude-opus-4-8');
    expect(cfg.anthropicApiKey).toBe('sk-test');
  });

  it('infers gemini when only GEMINI_API_KEY is set', () => {
    process.env.GEMINI_API_KEY = 'g-test';
    const cfg = loadConfig({}, cwd);
    expect(cfg.provider).toBe('gemini');
    expect(cfg.model).toBe('gemini-2.5-pro');
  });

  it('lets CLI overrides win over env and defaults', () => {
    process.env.ANTHROPIC_API_KEY = 'sk-test';
    const cfg = loadConfig({ provider: 'gemini', model: 'custom-model' }, cwd);
    expect(cfg.provider).toBe('gemini');
    expect(cfg.model).toBe('custom-model');
  });

  it('reads a project config file', async () => {
    await writeFile(
      join(cwd, 'therr-agent.config.json'),
      JSON.stringify({
        provider: 'anthropic',
        maxTokens: 8000,
        effort: 'max',
        allow: { bash: ['npm test'], write: ['src/**'] },
      }),
    );
    const cfg = loadConfig({}, cwd);
    expect(cfg.maxTokens).toBe(8000);
    expect(cfg.effort).toBe('max');
    expect(cfg.allow.bash).toEqual(['npm test']);
    expect(cfg.allow.write).toEqual(['src/**']);
  });

  it('lets env override the config file model', async () => {
    await writeFile(
      join(cwd, 'therr-agent.config.json'),
      JSON.stringify({ provider: 'anthropic', model: 'from-file' }),
    );
    process.env.THERR_AGENT_MODEL = 'from-env';
    const cfg = loadConfig({}, cwd);
    expect(cfg.model).toBe('from-env');
  });
});
