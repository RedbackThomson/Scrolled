import { Bookmark, BookmarkCheck } from 'lucide-react';
import { Button } from '@scrolled/design';
import type { CollectionEntityType } from '@/db/user';
import { CollectionPicker } from './CollectionPicker';

interface SaveButtonProps {
  entityType: CollectionEntityType;
  entityId: number;
}

/** The detail-page header's primary action: opens the collection picker. */
export function SaveButton({ entityType, entityId }: SaveButtonProps) {
  return (
    <CollectionPicker entityType={entityType} entityId={entityId}>
      {({ toggle, open, memberCount }) => (
        <Button
          icon={memberCount > 0 ? BookmarkCheck : Bookmark}
          onClick={toggle}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          {memberCount > 0 ? 'Saved' : 'Save'}
        </Button>
      )}
    </CollectionPicker>
  );
}
