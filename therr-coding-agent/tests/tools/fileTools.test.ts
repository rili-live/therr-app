import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readFileTool } from '../../src/tools/readFile.js';
import { writeFileTool } from '../../src/tools/writeFile.js';
import { editFileTool } from '../../src/tools/editFile.js';
import { lsTool } from '../../src/tools/ls.js';
import { globTool } from '../../src/tools/glob.js';
import { grepTool } from '../../src/tools/grep.js';

let cwd: string;

beforeEach(async () => {
  cwd = await mkdtemp(join(tmpdir(), 'therr-agent-'));
});

afterEach(async () => {
  await rm(cwd, { recursive: true, force: true });
});

describe('read_file', () => {
  it('returns content with 1-based line numbers', async () => {
    await writeFile(join(cwd, 'a.txt'), 'one\ntwo\nthree');
    const res = await readFileTool.execute({ path: 'a.txt' }, { cwd });
    expect(res.isError).toBeUndefined();
    expect(res.output).toContain('1\tone');
    expect(res.output).toContain('3\tthree');
  });

  it('honors offset and limit', async () => {
    await writeFile(join(cwd, 'a.txt'), 'l1\nl2\nl3\nl4');
    const res = await readFileTool.execute({ path: 'a.txt', offset: 2, limit: 2 }, { cwd });
    expect(res.output).toContain('2\tl2');
    expect(res.output).toContain('3\tl3');
    expect(res.output).not.toContain('l1');
    expect(res.output).not.toContain('l4');
  });

  it('reports an error for a missing file', async () => {
    const res = await readFileTool.execute({ path: 'nope.txt' }, { cwd });
    expect(res.isError).toBe(true);
  });
});

describe('write_file', () => {
  it('writes a file and creates parent directories', async () => {
    const res = await writeFileTool.execute(
      { path: 'nested/dir/out.txt', content: 'hello' },
      { cwd },
    );
    expect(res.isError).toBeUndefined();
    expect(await readFile(join(cwd, 'nested/dir/out.txt'), 'utf8')).toBe('hello');
  });
});

describe('edit_file', () => {
  beforeEach(async () => {
    await writeFile(join(cwd, 'code.ts'), 'const a = 1;\nconst b = 2;\n');
  });

  it('replaces a unique string', async () => {
    const res = await editFileTool.execute(
      { path: 'code.ts', old_string: 'const a = 1;', new_string: 'const a = 42;' },
      { cwd },
    );
    expect(res.isError).toBeUndefined();
    expect(await readFile(join(cwd, 'code.ts'), 'utf8')).toContain('const a = 42;');
  });

  it('errors when old_string is not found', async () => {
    const res = await editFileTool.execute(
      { path: 'code.ts', old_string: 'missing', new_string: 'x' },
      { cwd },
    );
    expect(res.isError).toBe(true);
  });

  it('errors on multiple matches unless replace_all', async () => {
    await writeFile(join(cwd, 'dup.ts'), 'x\nx\n');
    const fail = await editFileTool.execute(
      { path: 'dup.ts', old_string: 'x', new_string: 'y' },
      { cwd },
    );
    expect(fail.isError).toBe(true);

    const ok = await editFileTool.execute(
      { path: 'dup.ts', old_string: 'x', new_string: 'y', replace_all: true },
      { cwd },
    );
    expect(ok.isError).toBeUndefined();
    expect(await readFile(join(cwd, 'dup.ts'), 'utf8')).toBe('y\ny\n');
  });
});

describe('ls', () => {
  it('lists entries with directory suffixes', async () => {
    await mkdir(join(cwd, 'sub'));
    await writeFile(join(cwd, 'file.txt'), '');
    const res = await lsTool.execute({}, { cwd });
    expect(res.output).toContain('sub/');
    expect(res.output).toContain('file.txt');
  });
});

describe('glob', () => {
  it('matches files by pattern, relative to cwd', async () => {
    await mkdir(join(cwd, 'src'));
    await writeFile(join(cwd, 'src/a.ts'), '');
    await writeFile(join(cwd, 'src/b.ts'), '');
    await writeFile(join(cwd, 'readme.md'), '');
    const res = await globTool.execute({ pattern: '**/*.ts' }, { cwd });
    expect(res.output).toContain('src/a.ts');
    expect(res.output).toContain('src/b.ts');
    expect(res.output).not.toContain('readme.md');
  });

  it('ignores node_modules', async () => {
    await mkdir(join(cwd, 'node_modules'));
    await writeFile(join(cwd, 'node_modules/dep.ts'), '');
    await writeFile(join(cwd, 'top.ts'), '');
    const res = await globTool.execute({ pattern: '**/*.ts' }, { cwd });
    expect(res.output).toContain('top.ts');
    expect(res.output).not.toContain('dep.ts');
  });
});

describe('grep', () => {
  it('returns matching lines as path:line: text', async () => {
    await writeFile(join(cwd, 'a.txt'), 'alpha\nbeta\nBETA');
    const res = await grepTool.execute({ pattern: 'beta' }, { cwd });
    expect(res.output).toContain('a.txt:2: beta');
    expect(res.output).not.toContain('BETA');
  });

  it('supports case-insensitive search and glob filtering', async () => {
    await writeFile(join(cwd, 'a.ts'), 'TODO: fix');
    await writeFile(join(cwd, 'b.md'), 'todo: doc');
    const res = await grepTool.execute(
      { pattern: 'todo', ignore_case: true, glob: '*.ts' },
      { cwd },
    );
    expect(res.output).toContain('a.ts:1');
    expect(res.output).not.toContain('b.md');
  });

  it('reports an invalid regex', async () => {
    const res = await grepTool.execute({ pattern: '(' }, { cwd });
    expect(res.isError).toBe(true);
  });
});
