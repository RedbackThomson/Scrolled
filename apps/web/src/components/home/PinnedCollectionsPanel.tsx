// Pinned collections grid on the home page. Empty state nudges the user
// toward the collections index rather than silently hiding the section —
// new users have no idea pinning exists otherwise.

import { Link } from 'react-router-dom';
import { ArrowRight, Pin } from 'lucide-react';
import { resolveCollectionColor, resolveCollectionIcon } from '@/components/collections';
import { useCollectionsList } from '@/hooks/useCollections';
import { cn } from '@/lib/utils';
import { HomeSection } from './HomeSection';

export function PinnedCollectionsPanel() {
  const q = useCollectionsList();
  if (q.isPending) return null;
  const all = q.data ?? [];
  const pinned = all.filter((c) => c.pinned);

  // Hide the whole section if the user has no collections at all — the
  // browse tiles already point them at /collections. The empty-state below
  // is for when they have collections but none pinned yet.
  if (all.length === 0) return null;

  return (
    <HomeSection
      title="Pinned"
      action={
        <Link
          to="/collections"
          className="text-primary inline-flex items-center gap-1 text-xs hover:underline"
        >
          All collections <ArrowRight className="h-3 w-3" />
        </Link>
      }
    >
      {pinned.length === 0 ? (
        <EmptyState />
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {pinned.map((c) => {
            const { Icon } = resolveCollectionIcon(c.icon);
            const color = resolveCollectionColor(c.color);
            const progress = computeProgress(c.memberCount);
            return (
              <li key={c.id}>
                <Link
                  to={`/collections/${c.id}`}
                  className="border-border bg-card text-card-foreground hover:border-foreground/30 group flex h-full gap-3 rounded-md border p-4 transition-colors"
                >
                  <span
                    className={cn(
                      'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
                      color.iconBg,
                      color.iconColor,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-semibold">{c.name}</div>
                    <div className="text-muted-foreground mt-0.5 text-xs">
                      {progress.label}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </HomeSection>
  );
}

function EmptyState() {
  return (
    <div className="border-border bg-muted/30 text-muted-foreground flex items-center gap-3 rounded-md border border-dashed p-4 text-sm">
      <Pin className="h-4 w-4 shrink-0" />
      <p>
        Pin a collection from its detail page to keep it one click away from here.{' '}
        <Link to="/collections" className="text-primary hover:underline">
          Open collections
        </Link>
        .
      </p>
    </div>
  );
}

/** A lightweight stand-in until completion uses member.done; just renders
 *  the member count. Kept as a helper so the call site reads cleanly and a
 *  future change to "x of y done" lives in one place. */
function computeProgress(memberCount: number) {
  return {
    label:
      memberCount === 0
        ? 'No members yet'
        : `${memberCount.toLocaleString()} ${memberCount === 1 ? 'member' : 'members'}`,
  };
}
