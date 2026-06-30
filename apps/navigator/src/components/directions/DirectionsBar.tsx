import { useCallback } from 'react';
import { Button } from '@scrolled/ui';
import { ArrowRightLeft, Route, X } from 'lucide-react';
import { asNodeId, type NavGraph } from '@scrolled/nav-graph';

import { useDirections } from '@/stores/useDirections';
import { useEndpoints } from '@/hooks/useEndpoints';
import { NodePicker } from './NodePicker';

export interface DirectionsBarProps {
  graph: NavGraph;
}

export function DirectionsBar({ graph }: DirectionsBarProps) {
  const { fromId, toId, setFrom, setTo, swap, clear } = useEndpoints(graph);
  const compute = useDirections((s) => s.compute);
  const clearResult = useDirections((s) => s.clear);
  const hasResult = useDirections((s) => s.result !== null);

  const onGo = useCallback(() => {
    if (fromId && toId) compute(graph, asNodeId(fromId), asNodeId(toId));
  }, [compute, graph, fromId, toId]);

  const onClear = useCallback(() => {
    clear();
    clearResult();
  }, [clear, clearResult]);

  const canGo = !!fromId && !!toId && fromId !== toId;

  return (
    <div className="border-border bg-background flex flex-none items-center gap-2 border-b px-4 py-2">
      <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-end gap-2">
        <NodePicker
          label="From"
          graph={graph}
          value={fromId ? asNodeId(fromId) : null}
          onChange={(id) => setFrom(id)}
        />
        <Button
          variant="ghost"
          size="icon"
          aria-label="Swap from and to"
          onClick={swap}
          disabled={!fromId && !toId}
        >
          <ArrowRightLeft className="h-4 w-4" aria-hidden />
        </Button>
        <NodePicker
          label="To"
          graph={graph}
          value={toId ? asNodeId(toId) : null}
          onChange={(id) => setTo(id)}
        />
      </div>
      <Button onClick={onGo} disabled={!canGo} size="sm" className="gap-2">
        <Route className="h-4 w-4" aria-hidden />
        Get directions
      </Button>
      {(fromId || toId || hasResult) && (
        <Button variant="ghost" size="icon" aria-label="Clear directions" onClick={onClear}>
          <X className="h-4 w-4" aria-hidden />
        </Button>
      )}
    </div>
  );
}
