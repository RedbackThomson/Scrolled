// Compact "Save to collection" footer used at the bottom of every entity
// hover card. Renders the count of collections this entity is in and a
// button that opens the shared CollectionPicker.

import { BookmarkPlus } from 'lucide-react';
import type { CollectionEntityType } from '@/db/user';
import { cn } from '@/lib/utils';
import { CollectionPicker } from './CollectionPicker';

interface HoverCardSaveFooterProps {
  entityType: CollectionEntityType;
  entityId: number;
  className?: string;
}

export function HoverCardSaveFooter({ entityType, entityId, className }: HoverCardSaveFooterProps) {
  return (
    <div className={cn('border-border -mx-3 mt-1.5 border-t px-3 pt-1.5', className)}>
      <CollectionPicker entityType={entityType} entityId={entityId}>
        {({ toggle, open, memberCount }) => (
          <button
            type="button"
            onClick={toggle}
            aria-haspopup="dialog"
            aria-expanded={open}
            className={cn(
              'text-muted-foreground hover:text-foreground hover:bg-accent flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-[11px] transition-colors',
              open && 'bg-accent text-foreground',
            )}
          >
            <BookmarkPlus className="h-3.5 w-3.5" aria-hidden />
            <span className="flex-1 text-left">Save to collection</span>
            {memberCount > 0 && (
              <span className="text-foreground font-mono text-[10px]">in {memberCount}</span>
            )}
          </button>
        )}
      </CollectionPicker>
    </div>
  );
}
