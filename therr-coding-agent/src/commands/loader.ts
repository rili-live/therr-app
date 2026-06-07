import matter from 'gray-matter';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Command } from './types.js';

interface Frontmatter {
  name?: string;
  description?: string;
  'argument-hint'?: string;
}

/**
 * Load markdown+frontmatter command files from each directory. Directories are
 * searched in order; the first definition of a given name wins (so a project's
 * `.agent/commands` overrides the user's `~/.config` commands).
 */
export function loadCommands(dirs: string[]): Map<string, Command> {
  const map = new Map<string, Command>();

  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    let files: string[];
    try {
      files = readdirSync(dir).filter((f) => f.endsWith('.md'));
    } catch {
      continue;
    }

    for (const file of files.sort()) {
      const path = join(dir, file);
      let content: string;
      try {
        content = readFileSync(path, 'utf8');
      } catch {
        continue;
      }
      const parsed = matter(content);
      const data = parsed.data as Frontmatter;
      const name = data.name ?? file.replace(/\.md$/, '');
      if (map.has(name)) continue;

      const command: Command = {
        name,
        description: data.description ?? '',
        body: parsed.content.trim(),
        source: path,
      };
      if (data['argument-hint']) command.argumentHint = data['argument-hint'];
      map.set(name, command);
    }
  }

  return map;
}

/**
 * Produce the prompt text for a command invocation. If the body contains the
 * `$ARGUMENTS` placeholder, it is substituted; otherwise args are appended.
 */
export function renderCommand(command: Command, args: string): string {
  if (command.body.includes('$ARGUMENTS')) {
    return command.body.split('$ARGUMENTS').join(args);
  }
  return args ? `${command.body}\n\n${args}` : command.body;
}
