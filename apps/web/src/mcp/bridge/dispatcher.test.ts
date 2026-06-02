// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import type { BridgeEnvelope } from '@scrolled/mcp-protocol';
import { ToolRegistry } from '../registry';
import { NotFoundError } from '../errors';
import type { ToolContext } from '../types';
import { BridgeDispatcher } from './dispatcher';
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
});
