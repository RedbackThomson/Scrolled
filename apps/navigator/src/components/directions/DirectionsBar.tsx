import { useCallback } from 'react';
import { Button } from '@scrolled/design';
import { ArrowRightLeft, Route, X } from 'lucide-react';
import { asNodeId, type NavGraph } from '@scrolled/nav-graph';

import { useDirections } from '@/stores/useDirections';
import { useEndpoints } from '@/hooks/useEndpoints';
import { NodePicker } from './NodePicker';
import { PathOptionsMenu } from './PathOptionsMenu';

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
    <div className="flex flex-none flex-col gap-2 px-4 pb-3 md:flex-row md:items-center">
      <div className="grid flex-1 grid-cols-[1fr_auto_1fr] items-center gap-2">
        <NodePicker
          label="From"
          tone="from"
          graph={graph}
          value={fromId ? asNodeId(fromId) : null}
          onChange={(id) => setFrom(id)}
        />
        <button
          type="button"
          aria-label="Swap from and to"
          onClick={swap}
          disabled={!fromId && !toId}
          className="bg-card text-foreground shadow-float ease-spring focus-visible:ring-primary/30 grid h-10 w-10 place-items-center rounded-full transition-transform duration-300 hover:rotate-180 focus-visible:outline-none focus-visible:ring-4 disabled:pointer-events-none disabled:opacity-50 max-md:h-11 max-md:w-11"
        >
          <ArrowRightLeft className="h-4 w-4" aria-hidden />
        </button>
        <NodePicker
          label="To"
          tone="to"
          graph={graph}
          value={toId ? asNodeId(toId) : null}
          onChange={(id) => setTo(id)}
        />
      </div>
      <div className="flex items-center gap-2">
        <PathOptionsMenu graph={graph} />
        <Button
          onClick={onGo}
          disabled={!canGo}
          icon={Route}
          className="h-10 flex-1 rounded-full px-4 max-md:h-11 md:flex-none"
        >
          Get directions
        </Button>
        {(fromId || toId || hasResult) && (
          <Button
            variant="ghost"
            size="icon"
            aria-label="Clear directions"
            onClick={onClear}
            className="h-10 w-10 rounded-full max-md:h-11 max-md:w-11"
          >
            <X className="h-4 w-4" aria-hidden />
          </Button>
        )}
      </div>
    </div>
  );
}
