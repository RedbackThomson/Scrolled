import { ELEMENT_ORDER, parseMobElements } from '@scrolled/game-db/domain/mobElements';
import {
  ELEMENT_STATUS_CLASSES,
  ELEMENT_STATUS_LABELS,
} from '@/components/entity-display/mobElementsDisplay';
import { ElementChip, type ElementKey } from '@scrolled/design';

export function MobElementsSection({ element }: { element: string | null }) {
  const statuses = parseMobElements(element);
  return (
    <section>
      <h2 className="font-display mb-2 text-[15px] font-semibold">Elements</h2>
      <div className="grid grid-cols-2 gap-1.5">
        {ELEMENT_ORDER.map((name) => {
          const status = statuses[name];
          return (
            <ElementChip
              key={name}
              element={name.toLowerCase() as ElementKey}
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
