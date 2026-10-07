import { Bookmark, BookmarkCheck } from 'lucide-react';
import { Button, cn } from '@scrolled/design';
import type { CollectionEntityType } from '@/db/user';
import { CollectionPicker } from './CollectionPicker';

interface SaveButtonProps {
  entityType: CollectionEntityType;
  entityId: number;
  entityName?: string;
}

/** The detail-page header's primary action: opens the collection picker. */
export function SaveButton({ entityType, entityId, entityName }: SaveButtonProps) {
  return (
    <CollectionPicker entityType={entityType} entityId={entityId} entityName={entityName}>
      {({ toggle, open, memberCount, saves }) => (
        <>
          <Button
            icon={memberCount > 0 ? BookmarkCheck : Bookmark}
            onClick={toggle}
            aria-haspopup="dialog"
            aria-expanded={open}
          >
            {memberCount > 0 ? 'Saved' : 'Save'}
          </Button>
          {memberCount > 0 && (
            // Re-keyed per save so the count pops again after each add.
            <span
              key={saves}
              aria-hidden
              className={cn(
                'pointer-events-none absolute -right-1.5 -top-1.5 grid h-5 min-w-[20px] place-items-center rounded-full bg-[image:var(--gradient-gold)] px-1 text-[11px] font-bold text-[color:var(--gold-fg)] shadow-[0_0_0_2px_var(--surface-card)]',
                saves > 0 && 'animate-pop [animation-delay:260ms]',
              )}
            >
              {memberCount}
            </span>
          )}
        </>
      )}
    </CollectionPicker>
  );
}
