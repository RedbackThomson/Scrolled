// Compact "Save to collection" footer used at the bottom of every entity
// hover card. Renders the count of collections this entity is in and a
// button that opens the shared CollectionPicker.

import { BookmarkPlus } from 'lucide-react';
import type { CollectionEntityType } from '@/db/user';
import { cn } from '@scrolled/design';
import { CollectionPicker } from './CollectionPicker';

interface HoverCardSaveFooterProps {
  entityType: CollectionEntityType;
  entityId: number;
  className?: string;
}

export function HoverCardSaveFooter({ entityType, entityId, className }: HoverCardSaveFooterProps) {
  return (
    <div className={cn('border-t border-[var(--tooltip-line)] p-1.5', className)}>
      <CollectionPicker entityType={entityType} entityId={entityId}>
        {({ toggle, open, memberCount, saves }) => (
          <button
            type="button"
            onClick={toggle}
            aria-haspopup="dialog"
            aria-expanded={open}
            className={cn(
              'text-muted-foreground hover:text-foreground hover:bg-muted flex w-full items-center gap-1.5 rounded-md px-1.5 py-1 text-xs transition-colors',
              open && 'bg-muted text-foreground',
            )}
          >
            <BookmarkPlus className="h-3.5 w-3.5" aria-hidden />
            <span className="flex-1 text-left">Save to collection</span>
            {memberCount > 0 && (
              <span
                key={saves}
                className={cn(
                  'rounded-full bg-[image:var(--gradient-gold)] px-1.5 py-px text-[10px] font-bold text-[var(--gold-fg)]',
                  saves > 0 && 'animate-pop',
                )}
              >
                in {memberCount}
              </span>
            )}
          </button>
        )}
      </CollectionPicker>
    </div>
  );
}
