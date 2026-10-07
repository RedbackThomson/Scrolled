import { Shield, ShieldCheck, Target, type LucideIcon } from 'lucide-react';
import { ElementChip, type ElementKey } from '@scrolled/design';
import { elementsByStatus } from '@scrolled/game-db/domain/mobElements';
import {
  ELEMENT_AFFINITY_STATUSES,
  ELEMENT_GROUP_LABELS,
  ELEMENT_STATUS_ON_DARK_CLASSES,
} from '@/components/entity-display/mobElementsDisplay';
import { cn } from '@scrolled/design';

const ICONS: Record<(typeof ELEMENT_AFFINITY_STATUSES)[number], LucideIcon> = {
  weak: Target,
  resistant: Shield,
  immune: ShieldCheck,
};

/** A mob's element weaknesses and strengths for the hover card: one row per status, as element chips. */
export function ElementAffinities({ element }: { element: string | null }) {
  const groups = ELEMENT_AFFINITY_STATUSES.map((status) => ({
    status,
    names: elementsByStatus(element, status),
  })).filter((g) => g.names.length > 0);

  return (
    <dl className="space-y-1.5">
      {groups.map(({ status, names }) => {
        const Icon = ICONS[status];
        return (
          <div key={status} className="flex flex-wrap items-center gap-1.5">
            <dt
              className={cn(
                'inline-flex items-center gap-1 text-[11px] font-bold',
                ELEMENT_STATUS_ON_DARK_CLASSES[status],
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {ELEMENT_GROUP_LABELS[status]}
            </dt>
            {names.map((name) => (
              <dd key={name}>
                <ElementChip element={name.toLowerCase() as ElementKey} />
              </dd>
            ))}
          </div>
        );
      })}
    </dl>
  );
}
