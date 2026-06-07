import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createRegistry, toJsonSchema, ALL_TOOLS } from '../../src/tools/registry.js';
import { defineTool } from '../../src/tools/types.js';

describe('toJsonSchema', () => {
  it('produces a self-contained object schema without $schema', () => {
    const schema = z.object({ name: z.string(), count: z.number().optional() });
    const js = toJsonSchema(schema);
    expect(js).not.toHaveProperty('$schema');
    expect(js.type).toBe('object');
    expect(js.properties).toHaveProperty('name');
    expect(js.required).toEqual(['name']);
  });
});

describe('createRegistry', () => {
  it('exposes the default tool set', () => {
    const registry = createRegistry();
    expect(registry.list()).toHaveLength(ALL_TOOLS.length);
    expect(registry.get('read_file')?.name).toBe('read_file');
    expect(registry.get('does_not_exist')).toBeUndefined();
  });

  it('emits a ToolSchema per tool', () => {
    const registry = createRegistry();
    const schemas = registry.toSchemas();
    expect(schemas).toHaveLength(ALL_TOOLS.length);
    for (const s of schemas) {
      expect(typeof s.name).toBe('string');
      expect(typeof s.description).toBe('string');
      expect(s.jsonSchema.type).toBe('object');
    }
  });

  it('accepts a custom tool set', () => {
    const custom = defineTool({
      name: 'noop',
      description: 'does nothing',
      mutating: false,
      schema: z.object({}),
      async execute() {
        return { output: 'ok' };
      },
    });
    const registry = createRegistry([custom]);
    expect(registry.list()).toHaveLength(1);
    expect(registry.get('noop')).toBe(custom);
  });
});
