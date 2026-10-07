// Pinned collections grid on the home page. Empty state nudges the user
// toward the collections index rather than silently hiding the section —
// new users have no idea pinning exists otherwise.

import { Link } from 'react-router-dom';
import { ArrowRight, Pin } from 'lucide-react';
import { resolveCollectionColor } from '@/components/collections/colorRegistry';
import { resolveCollectionIcon } from '@/components/collections/iconRegistry';
import { useCollectionsList } from '@/hooks/useCollections';
import { cn } from '@scrolled/design';
import { HomeSection } from './HomeSection';
import { popIn } from '@/lib/popIn';

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
          {pinned.map((c, i) => {
            const { Icon } = resolveCollectionIcon(c.icon);
            const color = resolveCollectionColor(c.color);
            const progress = computeProgress(c.memberCount);
            return (
              <li key={c.id} {...popIn(i)}>
                <Link
                  to={`/collections/${c.id}`}
                  className="border-border bg-card text-card-foreground shadow-rim ease-spring group flex h-full gap-3 rounded-lg border-2 p-3.5 transition-transform duration-300 hover:-translate-y-[3px]"
                >
                  <span
                    className={cn(
                      'shadow-slot inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[11px]',
                      color.iconBg,
                      color.iconColor,
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="font-display truncate text-base font-semibold">{c.name}</div>
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
    <div className="border-border text-muted-foreground flex items-center gap-3 rounded-lg border-2 border-dashed p-4 text-sm">
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
