import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCommands, renderCommand } from '../../src/commands/loader.js';

let root: string;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'therr-cmd-'));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
});

describe('loadCommands', () => {
  it('parses frontmatter and body', async () => {
    const dir = join(root, 'a');
    await mkdir(dir);
    await writeFile(
      join(dir, 'review.md'),
      '---\nname: review\ndescription: Review code\nargument-hint: "[scope]"\n---\nDo the review. $ARGUMENTS',
    );
    const commands = loadCommands([dir]);
    const cmd = commands.get('review');
    expect(cmd?.description).toBe('Review code');
    expect(cmd?.argumentHint).toBe('[scope]');
    expect(cmd?.body).toContain('Do the review.');
  });

  it('falls back to the filename when name is absent', async () => {
    const dir = join(root, 'b');
    await mkdir(dir);
    await writeFile(join(dir, 'plan.md'), 'Just a body, no frontmatter.');
    const commands = loadCommands([dir]);
    expect(commands.get('plan')?.body).toBe('Just a body, no frontmatter.');
  });

  it('lets the first directory win on name conflicts (project over user)', async () => {
    const project = join(root, 'project');
    const user = join(root, 'user');
    await mkdir(project);
    await mkdir(user);
    await writeFile(join(project, 'x.md'), '---\nname: x\n---\nproject version');
    await writeFile(join(user, 'x.md'), '---\nname: x\n---\nuser version');
    const commands = loadCommands([project, user]);
    expect(commands.get('x')?.body).toBe('project version');
  });

  it('ignores missing directories', () => {
    expect(loadCommands([join(root, 'nope')]).size).toBe(0);
  });
});

describe('renderCommand', () => {
  const base = { name: 'c', description: '', source: 'x' };

  it('substitutes $ARGUMENTS when present', () => {
    const out = renderCommand({ ...base, body: 'before $ARGUMENTS after' }, 'MIDDLE');
    expect(out).toBe('before MIDDLE after');
  });

  it('appends args when no placeholder is present', () => {
    const out = renderCommand({ ...base, body: 'body' }, 'extra');
    expect(out).toBe('body\n\nextra');
  });

  it('returns the body unchanged with no args and no placeholder', () => {
    const out = renderCommand({ ...base, body: 'body' }, '');
    expect(out).toBe('body');
  });
});
