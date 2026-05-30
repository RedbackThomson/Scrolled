import { GitBranch, Map as MapIcon, ScrollText, Skull, Sparkles, Users } from 'lucide-react';
import { EntityIcon } from '@/components/entity-display/EntityIcon';
import { ItemIcon } from '@/components/entity-display/ItemIcon';
import type { EntityKind } from '@/db/types';
import { cn } from '@/lib/utils';

interface Props {
  entity: EntityKind;
  id: number;
  /** Square dimension in px. Default 28 (relation-list size). */
  size?: number;
  className?: string;
  alt?: string;
}

/**
 * Single source of truth for entity-type → icon. Items, equips, mobs, and
 * NPCs render from DB-persisted sprites; maps and quests have no stored
 * sprite so they fall back to a neutral lucide glyph in a matching box.
 */
export function EntityAvatar({ entity, id, size = 28, className, alt }: Props) {
  switch (entity) {
    case 'item':
      return (
        <ItemIcon
          entity="item"
          id={id}
          size={size}
          alt={alt}
          className={cn('shrink-0', className)}
        />
      );
    case 'equip':
      return (
        <ItemIcon
          entity="equip"
          id={id}
          size={size}
          alt={alt}
          className={cn('shrink-0', className)}
        />
      );
    case 'mob':
      return (
        <EntityIcon
          entity="mob"
          id={id}
          size={size}
          placeholder={Skull}
          alt={alt}
          className={cn('shrink-0', className)}
        />
      );
    case 'npc':
      return (
        <EntityIcon
          entity="npc"
          id={id}
          size={size}
          placeholder={Users}
          alt={alt}
          className={cn('shrink-0', className)}
        />
      );
    case 'map':
      return <GlyphBox size={size} className={className} Glyph={MapIcon} />;
    case 'quest':
      return <GlyphBox size={size} className={className} Glyph={ScrollText} />;
    case 'questChain':
      return <GlyphBox size={size} className={className} Glyph={GitBranch} />;
    case 'skill':
      return (
        <EntityIcon
          entity="skill"
          id={id}
          size={size}
          placeholder={Sparkles}
          alt={alt}
          className={cn('shrink-0', className)}
        />
      );
  }
}

function GlyphBox({
  size,
  className,
  Glyph,
}: {
  size: number;
  className?: string;
  Glyph: typeof MapIcon;
}) {
  const dim = `${size}px`;
  return (
    <span
      className={cn(
        'bg-muted text-muted-foreground inline-flex shrink-0 items-center justify-center rounded',
        className,
      )}
      style={{ width: dim, height: dim }}
      aria-hidden
    >
      <Glyph style={{ width: size * 0.55, height: size * 0.55 }} />
    </span>
  );
}
