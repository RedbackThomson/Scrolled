import type { ReactNode } from 'react';
import { Chip, cn } from '@scrolled/design';

interface MobileCardBodyProps {
  /** The entity's slot tile or sprite. */
  media: ReactNode;
  name: ReactNode;
  /** Tag beside the name, e.g. a Boss or Cash chip. */
  badge?: ReactNode;
  /** One truncated line under the name for long context (street, parent quest). */
  subtitle?: ReactNode;
  /** Short values shown as pills: levels, stats, counts. */
  stats?: readonly string[];
}

/** The compact horizontal card every list page uses below `md`. */
export function MobileCardBody({ media, name, badge, subtitle, stats = [] }: MobileCardBodyProps) {
  return (
    <div className="flex items-center gap-3">
      {media}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-bold">{name}</span>
          {badge}
        </div>
        {subtitle && <div className="text-muted-foreground truncate text-xs">{subtitle}</div>}
        {stats.length > 0 && (
          <div className={cn('flex flex-wrap gap-1', subtitle ? 'mt-1' : 'mt-1.5')}>
            {stats.map((stat) => (
              <Chip key={stat}>{stat}</Chip>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
