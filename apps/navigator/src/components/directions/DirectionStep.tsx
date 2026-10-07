import type { LucideIcon } from 'lucide-react';
import {
  Footprints,
  MoreHorizontal,
  Package,
  Scroll,
  Ship,
  Sparkles,
  Train,
  Users,
} from 'lucide-react';
import { cn } from '@scrolled/design';
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
  scroll: Scroll,
  other: MoreHorizontal,
};

const METHOD_HUES: Record<TravelMethod, number | null> = {
  walk: 150,
  transport: 230,
  portal: 295,
  npc: 70,
  item: 30,
  skill: 260,
  scroll: 185,
  other: null,
};

const METHOD_LABELS: Record<TravelMethod, string> = {
  walk: 'Walk',
  transport: 'Transport',
  portal: 'Portal',
  npc: 'NPC',
  item: 'Item',
  skill: 'Skill',
  scroll: 'Return scroll',
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

  const hue = METHOD_HUES[step.method];

  return (
    <li
      className={cn(
        'border-border bg-card text-card-foreground shadow-rim rounded-[14px] border-2 p-3',
        blocked && 'opacity-60 ring-4 ring-amber-500/30',
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className="bg-muted text-muted-foreground grid h-7 w-7 flex-none place-items-center rounded-full"
          style={
            hue === null
              ? undefined
              : {
                  background: `oklch(0.72 0.12 ${hue} / .2)`,
                  color: `oklch(var(--chip-fg-l) 0.14 ${hue})`,
                }
          }
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-muted-foreground flex items-center gap-1.5 text-[11.5px] font-bold">
            <span className="tabular-nums">{index + 1}</span>
            <span aria-hidden>·</span>
            <span>{METHOD_LABELS[step.method]}</span>
            {timed ? (
              <span className="font-semibold tabular-nums">
                · {estimated ? '~' : ''}
                {formatDuration(secs)}
              </span>
            ) : null}
          </div>
          <p className="mt-1 break-words text-[13.5px] font-bold leading-snug">
            <span>{fromName}</span>
            <span className="text-muted-foreground font-semibold"> → </span>
            <span>{toName}</span>
          </p>
          {step.via ? (
            <p className="text-muted-foreground mt-1 text-[12.5px]">
              {npcLink ? (
                <a
                  href={npcLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary font-semibold underline-offset-2 hover:underline"
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
