import { describe, expect, it } from 'vitest';
import { compileGraph } from '../compile/compileGraph';
import { defineGraph } from '../dsl/builder';
import { meso } from '../dsl/requirements';
import { toJSON } from './toJSON';

describe('toJSON', () => {
  it('produces JSON that round-trips back into compileGraph', () => {
    const source = defineGraph({ profileId: 'test' }, (g) => {
      g.region('north', 'Northland', (r) => {
        const a = r.node('a', 'Alpha');
        const b = r.node('b', 'Beta');
        a.walk(b);
        a.npcTo(b, { via: 'Take the carriage', cost: meso(100) });
      });
    });
    const graph = compileGraph(source);
    const json = toJSON(graph);
    // Serialization must be pure JSON (no Map/Set/undefined fields lurking).
    const stringified = JSON.stringify(json);
    const reparsed = JSON.parse(stringified);
    const rebuilt = compileGraph(reparsed);

    expect(rebuilt.nodes.size).toBe(graph.nodes.size);
    expect(rebuilt.adjacency.get(graph.source.nodes[0].id)).toHaveLength(
      graph.adjacency.get(graph.source.nodes[0].id)!.length,
    );
    expect(rebuilt.source.profileId).toBe('test');
  });
});
