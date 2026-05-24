// "In N collections" chip strip rendered on every entity detail page.
// Click any chip → navigate to that collection. Click the trailing "+"
// → open the shared CollectionPicker. Renders nothing while membership
// hasn't loaded (keeps the layout calm on detail pages that have a lot
// going on).

import { Link } from 'react-router-dom';
import { BookmarkPlus } from 'lucide-react';
import { HoverPopover } from '@/components/HoverPopover';
import { useMembership } from '@/lib/useCollections';
import type { CollectionEntityType, MembershipBadge } from '@/db/user';
import { cn } from '@/lib/utils';
import { CollectionPicker } from './CollectionPicker';
import { resolveCollectionIcon } from './iconRegistry';
import { resolveCollectionColor } from './colorRegistry';

interface CollectionBadgeStripProps {
  entityType: CollectionEntityType;
  entityId: number;
  className?: string;
}

export function CollectionBadgeStrip({
  entityType,
  entityId,
  className,
}: CollectionBadgeStripProps) {
  const membershipQ = useMembership(entityType, entityId);
  const memberships = membershipQ.data ?? [];

  return (
    <div className={cn('flex flex-wrap items-center gap-1.5', className)}>
      {memberships.length > 0 ? (
        memberships.map((m) => <BadgeChip key={m.collectionId} membership={m} />)
      ) : (
        <span className="text-muted-foreground text-xs">Not in any collection</span>
      )}
      <CollectionPicker entityType={entityType} entityId={entityId}>
        {({ toggle, open }) => (
          <button
            type="button"
            onClick={toggle}
            aria-haspopup="dialog"
            aria-expanded={open}
            aria-label="Add to a collection"
            className={cn(
              'border-border hover:bg-accent hover:text-foreground inline-flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-[11px] transition-colors',
              open && 'bg-accent text-foreground',
            )}
          >
            <BookmarkPlus className="h-3 w-3" aria-hidden />
            Save
          </button>
        )}
      </CollectionPicker>
    </div>
  );
}

function BadgeChip({ membership }: { membership: MembershipBadge }) {
  const { Icon } = resolveCollectionIcon(membership.icon);
  const color = resolveCollectionColor(membership.color);
  const chip = (
    <Link
      to={`/collections/${membership.collectionId}`}
      className={cn(
        'border-border hover:bg-accent hover:text-foreground inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors',
        color.chip,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden />
      <span className="truncate">{membership.name}</span>
    </Link>
  );

  // Skip the hover wrapper entirely when there's nothing to show — keeps
  // the trigger from flashing an empty popover on hover.
  if (!membership.description) return chip;

  return (
    <HoverPopover
      content={
        <div className="max-w-xs space-y-1">
          <div className="text-sm font-semibold">{membership.name}</div>
          <p className="text-muted-foreground whitespace-pre-line text-xs leading-relaxed">
            {membership.description}
          </p>
        </div>
      }
    >
      {chip}
    </HoverPopover>
  );
}
