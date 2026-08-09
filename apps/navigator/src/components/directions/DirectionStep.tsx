import type { LucideIcon } from 'lucide-react';
import { Footprints, MoreHorizontal, Package, Ship, Sparkles, Train, Users } from 'lucide-react';
import { cn } from '@scrolled/ui';
import { edgeSeconds, type NavGraph, type TravelEdge, type TravelMethod } from '@scrolled/nav-graph';

import { formatDuration } from '@/lib/formatDuration';
import { npcUrl } from '@/lib/scrolledLinks';
import { RequirementChip } from './RequirementChip';

const METHOD_ICONS: Record<TravelMethod, LucideIcon> = {
  walk: Footprints,
  transport: Ship,
  portal: Train,
  npc: Users,
  item: Package,
  skill: Sparkles,
  other: MoreHorizontal,
};

const METHOD_LABELS: Record<TravelMethod, string> = {
  walk: 'Walk',
  transport: 'Transport',
  portal: 'Portal',
  npc: 'NPC',
  item: 'Item',
  skill: 'Skill',
  other: 'Other',
};

export interface DirectionStepProps {
  index: number;
  step: TravelEdge;
  graph: NavGraph;
  /** Fast travel makes transport hops instant — mirrors the routed cost. */
  fastTravel?: boolean;
  /** True when the eligibility filter blocked this step (unreachable-when-filtered). */
  blocked?: boolean;
}

export function DirectionStep({ index, step, graph, fastTravel, blocked }: DirectionStepProps) {
  const Icon = METHOD_ICONS[step.method];
  const fromName = graph.nodes.get(step.from)?.name ?? step.from;
  const toName = graph.nodes.get(step.to)?.name ?? step.to;
  const npcLink = step.refs?.npcId ? npcUrl(step.refs.npcId) : null;
  // walk and transport carry time; the rest are instant. `~` marks a fallback
  // to the method's default time (no authored `seconds`).
  const timed = step.method === 'walk' || step.method === 'transport';
  const secs = edgeSeconds(step, { fastTravel });
  const estimated = step.seconds == null && secs > 0;

  return (
    <li
      className={cn(
        'border-border bg-card text-card-foreground rounded-md border p-3',
        blocked && 'opacity-60 ring-1 ring-amber-500/40',
      )}
    >
      <div className="flex items-start gap-3">
        <div className="bg-muted text-muted-foreground flex h-7 w-7 flex-none items-center justify-center rounded-full text-xs font-medium">
          {index + 1}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Icon className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
              {METHOD_LABELS[step.method]}
            </span>
            {timed ? (
              <span className="text-muted-foreground text-[10px] tabular-nums">
                · {estimated ? '~' : ''}
                {formatDuration(secs)}
              </span>
            ) : null}
          </div>
          <p className="mt-1 break-words text-sm leading-snug">
            <span className="font-medium">{fromName}</span>
            <span className="text-muted-foreground"> → </span>
            <span className="font-medium">{toName}</span>
          </p>
          {step.via ? (
            <p className="text-foreground mt-1.5 text-sm">
              {npcLink ? (
                <a
                  href={npcLink}
                  target="_blank"
                  rel="noreferrer"
                  className="underline-offset-2 hover:underline"
                >
                  {step.via}
                </a>
              ) : (
                step.via
              )}
            </p>
          ) : null}
          {step.notes ? (
            <p className="text-muted-foreground mt-1 text-xs italic">{step.notes}</p>
          ) : null}
          {step.requirements && step.requirements.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {step.requirements.map((req, i) => (
                <RequirementChip key={i} requirement={req} />
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </li>
  );
}
