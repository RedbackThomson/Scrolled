import { ELEMENT_ORDER, parseMobElements } from '@scrolled/game-db/domain/mobElements';
import {
  ELEMENT_STATUS_CLASSES,
  ELEMENT_STATUS_LABELS,
} from '@/components/entity-display/mobElementsDisplay';
import { cn } from '@scrolled/ui';

export function MobElementsSection({ element }: { element: string | null }) {
  const statuses = parseMobElements(element);
  return (
    <section>
      <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide">Elements</h2>
      <dl className="divide-border divide-y">
        {ELEMENT_ORDER.map((name) => {
          const status = statuses[name];
          return (
            <div key={name} className="flex items-baseline justify-between gap-3 py-1.5">
              <dt className="text-muted-foreground text-xs uppercase tracking-wide">{name}</dt>
              <dd className={cn('text-sm', ELEMENT_STATUS_CLASSES[status])}>
                {ELEMENT_STATUS_LABELS[status]}
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}
