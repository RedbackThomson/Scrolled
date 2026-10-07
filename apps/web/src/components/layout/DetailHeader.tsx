import type { ReactNode } from 'react';
import type { EntityKind } from '@scrolled/game-db/db/types';
import { EntityAvatar } from '@/components/entity-display/EntityAvatar';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useShowEntityIds } from '@/stores/showEntityIds';
import { cn } from '@scrolled/design';

interface DetailHeaderProps {
  entity: EntityKind;
  id: number;
  title: ReactNode;
  /** Plain-text name for the sprite's alt text when `title` isn't a string. */
  alt?: string;
  /** Renders the title muted and italic, for entities without a real name. */
  placeholderTitle?: boolean;
  /** Chips beside the title (Boss, item type, trade flags). */
  badges?: ReactNode;
  /** Secondary lines under the title (street name, quest parent). */
  subtitle?: ReactNode;
  /** Buttons under the title. */
  actions?: ReactNode;
  /** Slot size on desktop; quests use a smaller glyph tile. */
  size?: number;
}

export function DetailHeader({
  entity,
  id,
  title,
  alt,
  placeholderTitle,
  badges,
  subtitle,
  actions,
  size = 116,
}: DetailHeaderProps) {
  const showIds = useShowEntityIds((s) => s.enabled);
  const isMobile = useIsMobile();
  return (
    <header className="flex items-center gap-[18px]">
      <EntityAvatar
        entity={entity}
        id={id}
        size={isMobile ? 88 : size}
        spotlight
        rimmed
        alt={alt ?? (typeof title === 'string' ? title : undefined)}
      />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <h1
            className={cn(
              'font-display break-words text-2xl font-semibold leading-none md:text-4xl',
              placeholderTitle && 'text-muted-foreground italic',
            )}
          >
            {title}
          </h1>
          {badges}
        </div>
        {(subtitle || showIds) && (
          <div className="text-muted-foreground -mt-1 flex flex-col gap-0.5 text-sm">
            {subtitle}
            {showIds && <span className="font-mono text-xs">{id}</span>}
          </div>
        )}
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
