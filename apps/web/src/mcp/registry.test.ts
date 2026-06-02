// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { ToolRegistry } from './registry';
import { NotFoundError, ValidationError, ToolExecutionError } from './errors';
import type { ToolContext } from './types';

function makeContext(): ToolContext {
  // Cast through `unknown` — the registry only needs the shape on the
  // execute side, and the test tools below don't touch db/userDb.
  return {
    db: {} as ToolContext['db'],
    userDb: {} as ToolContext['userDb'],
    services: {},
  };
}

describe('ToolRegistry', () => {
  it('registers and retrieves a tool', () => {
    const r = new ToolRegistry();
    r.register({
      name: 'test.ping',
      category: 'Database',
      description: 'ping',
      inputSchema: z.object({}),
      execute: async () => 'pong',
    });
    expect(r.has('test.ping')).toBe(true);
    expect(r.list()).toHaveLength(1);
  });

  it('refuses duplicate registrations', () => {
    const r = new ToolRegistry();
    const tool = {
      name: 'test.ping',
      category: 'Database' as const,
      description: 'ping',
      inputSchema: z.object({}),
      execute: async () => null,
    };
    r.register(tool);
    expect(() => r.register(tool)).toThrow(/already registered/);
  });

  it('validates input and rejects bad shapes with ValidationError', async () => {
    const r = new ToolRegistry();
    r.register({
      name: 'test.add',
      category: 'Database',
      description: 'add two ints',
      inputSchema: z.object({ a: z.number().int(), b: z.number().int() }),
      execute: async ({ a, b }) => a + b,
    });
    await expect(r.execute('test.add', { a: 1, b: 2 }, makeContext())).resolves.toBe(3);
    await expect(r.execute('test.add', { a: 'no' }, makeContext())).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('maps unknown tool name to NotFoundError', async () => {
    const r = new ToolRegistry();
    await expect(r.execute('nope', {}, makeContext())).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rethrows typed tool errors verbatim and wraps untyped throws as InternalError', async () => {
    const r = new ToolRegistry();
    r.register({
      name: 'test.typed',
      category: 'Database',
      description: '',
      inputSchema: z.object({}),
      execute: async () => {
        throw new NotFoundError('gone');
      },
    });
    r.register({
      name: 'test.boom',
      category: 'Database',
      description: '',
      inputSchema: z.object({}),
      execute: async () => {
        throw new Error('kaboom');
      },
    });
    await expect(r.execute('test.typed', {}, makeContext())).rejects.toBeInstanceOf(NotFoundError);
    const wrapped = r.execute('test.boom', {}, makeContext());
    await expect(wrapped).rejects.toBeInstanceOf(ToolExecutionError);
    await expect(wrapped).rejects.toMatchObject({ code: 'InternalError', message: 'kaboom' });
  });

  it('emits a JSON-schema-shaped catalog via describe()', () => {
    const r = new ToolRegistry();
    r.register({
      name: 'test.shape',
      category: 'Search',
      description: 'shape',
      inputSchema: z.object({ q: z.string() }),
      execute: async () => null,
    });
    const cat = r.describe();
    expect(cat.tools[0]?.name).toBe('test.shape');
    expect(cat.tools[0]?.inputSchema).toMatchObject({ type: 'object' });
  });
});
