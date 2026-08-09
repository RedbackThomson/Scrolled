import { Button } from '@scrolled/ui';
import { Clock, X } from 'lucide-react';
import type { NavGraph, PathResult, TravelEdge } from '@scrolled/nav-graph';

import { formatDuration } from '@/lib/formatDuration';
import { useDirections } from '@/stores/useDirections';
import { DirectionStep } from './DirectionStep';

export interface DirectionsPanelProps {
  graph: NavGraph;
}

export function DirectionsPanel({ graph }: DirectionsPanelProps) {
  const result = useDirections((s) => s.result);
  const clear = useDirections((s) => s.clear);
  const fastTravel = useDirections((s) => s.options.fastTravel);
  if (!result) return null;

  const { steps, header, totalSeconds } = framesFromResult(result);
  const fromName = steps[0] ? graph.nodes.get(steps[0].from)?.name : undefined;
  const lastTo = steps[steps.length - 1]?.to;
  const toName = lastTo ? graph.nodes.get(lastTo)?.name : undefined;
  const blocked = result.fallback?.blocked ?? [];
  // A timed step with no authored time falls back to an estimate, so the total
  // is approximate whenever one appears. Transport only counts when fast travel
  // is off (with it on, transports are instant, not estimated).
  const approximate = steps.some(
    (s) =>
      s.seconds == null &&
      (s.method === 'walk' || (s.method === 'transport' && !fastTravel)),
  );
  // "on foot" is only right for a pure-walk route; label anything with a ride,
  // teleport, or scroll neutrally.
  const label = steps.every((s) => s.method === 'walk') ? 'on foot' : 'travel time';

  return (
    <aside className="border-border bg-background z-10 flex w-80 flex-none flex-col border-l">
      <header className="border-border flex flex-none items-start justify-between gap-2 border-b px-4 py-3">
        <div className="min-w-0">
          <p className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
            Directions
          </p>
          {fromName && toName ? (
            <p className="truncate text-sm">
              <span className="font-medium">{fromName}</span>
              <span className="text-muted-foreground"> → </span>
              <span className="font-medium">{toName}</span>
            </p>
          ) : (
            <p className="text-muted-foreground text-sm">No path</p>
          )}
          {steps.length > 0 ? (
            <p className="text-muted-foreground mt-0.5 flex items-center gap-1 text-xs">
              <Clock className="h-3 w-3" aria-hidden />
              <span className="tabular-nums">
                {approximate ? '~' : ''}
                {formatDuration(totalSeconds)}
              </span>
              <span>{label}</span>
            </p>
          ) : null}
        </div>
        <Button variant="ghost" size="icon" aria-label="Close directions" onClick={clear}>
          <X className="h-4 w-4" aria-hidden />
        </Button>
      </header>
      {header ? (
        <div className="border-border border-b bg-amber-500/10 px-4 py-2 text-xs text-amber-700 dark:text-amber-300">
          {header}
        </div>
      ) : null}
      {steps.length === 0 ? (
        <div className="text-muted-foreground p-4 text-sm">
          No path between these places — try a different start or end.
        </div>
      ) : (
        <ol className="flex flex-col gap-2 overflow-y-auto p-3">
          {steps.map((step, i) => (
            <DirectionStep
              key={`${step.from}->${step.to}#${i}`}
              index={i}
              step={step}
              graph={graph}
              fastTravel={fastTravel}
              blocked={blocked.includes(i)}
            />
          ))}
        </ol>
      )}
    </aside>
  );
}

interface Frames {
  steps: TravelEdge[];
  /** Total estimated walking time of `steps`, in seconds. */
  totalSeconds: number;
  /** Optional banner shown above the step list. */
  header: string | null;
}

function framesFromResult(result: PathResult): Frames {
  if (result.status === 'found') {
    return { steps: result.steps, totalSeconds: result.totalSeconds, header: null };
  }
  if (result.status === 'unreachable-when-filtered') {
    return {
      steps: result.fallback?.steps ?? [],
      totalSeconds: result.fallback?.totalSeconds ?? 0,
      header: 'Some steps need things you don\'t have yet — showing the closest route.',
    };
  }
  return { steps: [], totalSeconds: 0, header: null };
}
