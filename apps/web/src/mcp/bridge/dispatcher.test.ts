// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { BridgeEnvelope } from '@scrolled/mcp-protocol';
import { ToolRegistry } from '../registry';
import { NotFoundError } from '../errors';
import type { ToolContext } from '../types';
import { BridgeDispatcher, stripBinary } from './dispatcher';
import type { BridgeStatus, BridgeTransport } from './transport';

class FakeTransport implements BridgeTransport {
  private handler: ((env: BridgeEnvelope) => void) | null = null;
  readonly sent: BridgeEnvelope[] = [];
  status: BridgeStatus = 'open';
  onMessage(handler: (env: BridgeEnvelope) => void): void {
    this.handler = handler;
  }
  onStatusChange(): void {}
  async open(): Promise<void> {}
  send(env: BridgeEnvelope): void {
    this.sent.push(env);
  }
  close(): void {}
  inject(env: BridgeEnvelope): void {
    this.handler?.(env);
  }
}

function makeRegistry(): ToolRegistry {
  const r = new ToolRegistry();
  r.register({
    name: 'test.echo',
    category: 'Search',
    description: '',
    inputSchema: z.object({ msg: z.string() }),
    execute: async (input) => ({ echoed: input.msg }),
  });
  r.register({
    name: 'test.miss',
    category: 'Search',
    description: '',
    inputSchema: z.object({}),
    execute: async () => {
      throw new NotFoundError('not here');
    },
  });
  return r;
}

function makeContext(): ToolContext {
  return {
    db: {} as ToolContext['db'],
    userDb: {} as ToolContext['userDb'],
    services: {},
  };
}

async function flush(): Promise<void> {
  // Two microtask ticks: one for the dispatcher's `await registry.execute`,
  // one for the resulting send.
  await Promise.resolve();
  await Promise.resolve();
}

describe('BridgeDispatcher', () => {
  it('responds to discoverRequest with the registry catalog', () => {
    const transport = new FakeTransport();
    new BridgeDispatcher({ registry: makeRegistry(), context: makeContext(), transport });
    transport.inject({ v: 1, id: 'd1', kind: 'discoverRequest' });
    expect(transport.sent[0]).toMatchObject({
      id: 'd1',
      kind: 'discoverResponse',
      protocolVersion: 1,
    });
  });

  it('routes a tool envelope to the registry and replies with success', async () => {
    const transport = new FakeTransport();
    new BridgeDispatcher({ registry: makeRegistry(), context: makeContext(), transport });
    transport.inject({
      v: 1,
      id: 't1',
      kind: 'tool',
      tool: 'test.echo',
      input: { msg: 'hi' },
    });
    await flush();
    expect(transport.sent[0]).toMatchObject({
      id: 't1',
      kind: 'response',
      success: true,
      result: { echoed: 'hi' },
    });
  });

  it('serializes typed tool errors into the failure envelope shape', async () => {
    const transport = new FakeTransport();
    new BridgeDispatcher({ registry: makeRegistry(), context: makeContext(), transport });
    transport.inject({
      v: 1,
      id: 't2',
      kind: 'tool',
      tool: 'test.miss',
      input: {},
    });
    await flush();
    expect(transport.sent[0]).toMatchObject({
      id: 't2',
      kind: 'response',
      success: false,
      error: { code: 'NotFoundError', message: 'not here' },
    });
  });

  it('returns ValidationError when input fails the schema', async () => {
    const transport = new FakeTransport();
    new BridgeDispatcher({ registry: makeRegistry(), context: makeContext(), transport });
    transport.inject({
      v: 1,
      id: 't3',
      kind: 'tool',
      tool: 'test.echo',
      input: { msg: 7 },
    });
    await flush();
    expect(transport.sent[0]).toMatchObject({
      id: 't3',
      kind: 'response',
      success: false,
      error: { code: 'ValidationError' },
    });
  });

  it('drops malformed envelopes silently', async () => {
    const transport = new FakeTransport();
    new BridgeDispatcher({ registry: makeRegistry(), context: makeContext(), transport });
    transport.inject({ v: 1, id: 'bad' } as unknown as BridgeEnvelope);
    await flush();
    expect(transport.sent).toHaveLength(0);
  });

  it('omits Uint8Array fields from tool responses', async () => {
    const transport = new FakeTransport();
    const r = new ToolRegistry();
    r.register({
      name: 'test.icon',
      category: 'Items',
      description: '',
      inputSchema: z.object({}),
      execute: async () => ({
        id: 1,
        name: 'thing',
        iconData: new Uint8Array([1, 2, 3, 4]),
        nested: { description: 'x', previewData: new Uint8Array(2048) },
      }),
    });
    new BridgeDispatcher({ registry: r, context: makeContext(), transport });
    transport.inject({
      v: 1,
      id: 'i1',
      kind: 'tool',
      tool: 'test.icon',
      input: {},
    });
    await flush();
    const env = transport.sent[0];
    expect(env).toMatchObject({
      success: true,
      result: {
        id: 1,
        name: 'thing',
        nested: { description: 'x' },
      },
    });
    const result = (env as { result: Record<string, unknown> }).result;
    expect(result).not.toHaveProperty('iconData');
    expect(result.nested).not.toHaveProperty('previewData');
  });
});

describe('stripBinary', () => {
  it('returns null for a top-level typed array or ArrayBuffer', () => {
    expect(stripBinary(new Uint8Array([1, 2]))).toBeNull();
    expect(stripBinary(new Uint16Array([1, 2]))).toBeNull();
    expect(stripBinary(new ArrayBuffer(8))).toBeNull();
    expect(stripBinary(new DataView(new ArrayBuffer(8)))).toBeNull();
  });

  it('omits binary-valued object keys entirely', () => {
    const out = stripBinary({
      a: 1,
      b: new Uint8Array([9]),
      nested: { c: 'hi', d: new Uint8Array([0]) },
    }) as Record<string, unknown>;
    expect(out).toEqual({ a: 1, nested: { c: 'hi' } });
    expect(out).not.toHaveProperty('b');
    expect((out.nested as Record<string, unknown>)).not.toHaveProperty('d');
  });

  it('preserves array indices by replacing binary elements with null', () => {
    expect(
      stripBinary([1, new Uint8Array([7]), { e: new Uint8Array([8]), f: 'keep' }]),
    ).toEqual([1, null, { f: 'keep' }]);
  });

  it('leaves primitives, dates and strings intact', () => {
    const d = new Date(0);
    expect(stripBinary({ a: 1, b: 'two', c: true, d, e: null })).toEqual({
      a: 1,
      b: 'two',
      c: true,
      d,
      e: null,
    });
  });
});
