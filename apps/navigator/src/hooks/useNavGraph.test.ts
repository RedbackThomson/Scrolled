import { renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { DEFAULT_GRAPH_ID } from '@scrolled/nav-graph';
import { useNavGraph } from './useNavGraph';

describe('useNavGraph', () => {
  it('compiles the default authored graph', () => {
    const { result } = renderHook(() => useNavGraph(DEFAULT_GRAPH_ID));
    expect(result.current.nodes.size).toBeGreaterThan(0);
    expect(result.current.source.profileId).toBe(DEFAULT_GRAPH_ID);
  });
});
