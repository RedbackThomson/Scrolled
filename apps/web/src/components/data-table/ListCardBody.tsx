import { useContext, type ReactNode } from 'react';
import { Chip, EntityCard, SelectableSlot } from '@scrolled/design';
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
  const { variant, selected, selecting, extraStats = [], onToggleSelect } =
    useContext(ListCardLayoutContext);
  const altText = alt ?? (typeof name === 'string' ? name : undefined);
  const avatar = (size: number, spotlight?: boolean) => {
    const tile = (
      <EntityAvatar entity={entity} id={id} size={size} spotlight={spotlight} alt={altText} />
    );
    if (!onToggleSelect) return tile;
    // Lifted above the card's full-cover link so the picture takes its own clicks.
    return (
      <span className="pointer-events-auto relative z-10 inline-flex">
        <SelectableSlot
          tile={tile}
          size={size}
          selected={!!selected}
          selecting={selecting}
          label={altText ?? String(id)}
          onToggle={onToggleSelect}
        />
      </span>
    );
  };

  if (variant === 'tall') {
    return (
      <EntityCard
        media={avatar(60, true)}
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
        // The grid item lifts the card; a second lift here would pull the
        // picture out from under the pointer and bounce.
        lift={false}
      />
    );
  }

  const shown = stats.slice(0, COMPACT_STATS);
  return (
    <div className="flex items-center gap-3">
      {avatar(52)}
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
