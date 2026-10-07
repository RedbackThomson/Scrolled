import { useContext, type ReactNode } from 'react';
import { Chip, EntityCard } from '@scrolled/design';
import type { EntityKind } from '@scrolled/game-db/db/types';
import { EntityAvatar } from '@/components/entity-display/EntityAvatar';
import { ListCardLayoutContext, type ListCardStat } from './listCardLayout';

interface ListCardBodyProps {
  entity: EntityKind;
  id: number;
  /** Sprite alt text when `name` isn't a plain string. */
  alt?: string;
  name: ReactNode;
  /** Tag beside the name, e.g. a Boss or Cash chip. */
  badge?: ReactNode;
  /** One line under the name (type, street, parent quest). */
  subtitle?: ReactNode;
  /** Most important first: the tall card shows four, the compact row three. */
  stats?: readonly ListCardStat[];
  /** Outlined tags on the tall card (class, cash or regular). */
  tags?: readonly string[];
}

const COMPACT_STATS = 3;
const TALL_STATS = 4;

/** An entity's list card: a compact row on mobile, a tall card in the desktop card view. */
export function ListCardBody({
  entity,
  id,
  alt,
  name,
  badge,
  subtitle,
  stats = [],
  tags,
}: ListCardBodyProps) {
  const { variant, selected, extraStats = [] } = useContext(ListCardLayoutContext);
  const altText = alt ?? (typeof name === 'string' ? name : undefined);

  if (variant === 'tall') {
    return (
      <EntityCard
        media={<EntityAvatar entity={entity} id={id} size={60} spotlight alt={altText} />}
        name={name}
        badge={badge}
        subtitle={subtitle}
        stats={[...stats.slice(0, TALL_STATS), ...extraStats].map((s) => ({
          label: s.label,
          value: s.value,
          color: s.tone === 'attack' ? 'var(--stat-hp)' : undefined,
        }))}
        tags={tags}
        selected={selected}
      />
    );
  }

  const shown = stats.slice(0, COMPACT_STATS);
  return (
    <div className="flex items-center gap-3">
      <EntityAvatar entity={entity} id={id} size={52} alt={altText} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-bold">{name}</span>
          {badge}
        </div>
        {subtitle && <div className="text-muted-foreground truncate text-xs">{subtitle}</div>}
        {shown.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-1">
            {shown.map((s) => (
              <Chip key={s.label}>
                {s.label} {s.value}
              </Chip>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
