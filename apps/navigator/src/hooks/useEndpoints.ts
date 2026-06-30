import { useCallback } from 'react';
import { parseAsString, useQueryState } from 'nuqs';
import type { NavGraph, NodeId } from '@scrolled/nav-graph';

// Both endpoints are URL state — start/end and the implied directions are a
// shareable link. Nodes that aren't in the active graph are silently dropped so
// stale URLs degrade gracefully (the picker shows "Pick a place" again).

export interface EndpointsState {
  fromId: string | null;
  toId: string | null;
  setFrom: (id: NodeId | null) => void;
  setTo: (id: NodeId | null) => void;
  swap: () => void;
  clear: () => void;
}

export function useEndpoints(graph: NavGraph): EndpointsState {
  const parser = parseAsString;
  const [rawFrom, setRawFrom] = useQueryState('from', parser);
  const [rawTo, setRawTo] = useQueryState('to', parser);

  const fromId = rawFrom && graph.nodes.has(rawFrom as NodeId) ? rawFrom : null;
  const toId = rawTo && graph.nodes.has(rawTo as NodeId) ? rawTo : null;

  const setFrom = useCallback((id: NodeId | null) => setRawFrom(id), [setRawFrom]);
  const setTo = useCallback((id: NodeId | null) => setRawTo(id), [setRawTo]);
  const swap = useCallback(() => {
    setRawFrom(toId);
    setRawTo(fromId);
  }, [setRawFrom, setRawTo, fromId, toId]);
  const clear = useCallback(() => {
    setRawFrom(null);
    setRawTo(null);
  }, [setRawFrom, setRawTo]);

  return { fromId, toId, setFrom, setTo, swap, clear };
}
