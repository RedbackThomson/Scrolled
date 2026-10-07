import { ELEMENT_ORDER, parseMobElements } from '@scrolled/game-db/domain/mobElements';
import {
  ELEMENT_STATUS_CLASSES,
  ELEMENT_STATUS_LABELS,
} from '@/components/entity-display/mobElementsDisplay';
import { ElementChip, type ElementKey, SectionHeader } from '@scrolled/design';

export function MobElementsSection({ element }: { element: string | null }) {
  const statuses = parseMobElements(element);
  return (
    <section>
      <SectionHeader title="Elements" size="panel" className="mb-2" />
      <div className="grid gap-1.5">
        {ELEMENT_ORDER.map((name) => {
          const status = statuses[name];
          return (
            <ElementChip
              key={name}
              element={name.toLowerCase() as ElementKey}
              stretch
              status={
                <span className={ELEMENT_STATUS_CLASSES[status]}>
                  {ELEMENT_STATUS_LABELS[status]}
                </span>
              }
            />
          );
        })}
      </div>
    </section>
  );
}
