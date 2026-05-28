// "Continue" row — last entities the user opened, newest first. Uses the
// same store that powers the command palette's Recents provider so the
// two surfaces always agree on what "recent" means.

import { Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRecentEntities } from '@/lib/recents';
import { iconForEntity, routeForEntity } from '@/lib/entityRoutes';
import { HomeSection } from './HomeSection';

const MAX = 6;

export function ContinueStrip() {
  const { items } = useRecentEntities();
  if (!items.length) return null;

  const slice = items.slice(0, MAX);

  return (
    <HomeSection title="Continue">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {slice.map((r) => {
          const Icon = iconForEntity(r.entity);
          return (
            <li key={`${r.entity}-${r.id}`}>
              <Link
                to={routeForEntity(r.entity, r.id)}
                className="border-border bg-card text-card-foreground hover:border-foreground/30 group flex h-full items-center gap-2 rounded-md border p-3 transition-colors"
                title={r.name}
              >
                <Icon className="text-muted-foreground group-hover:text-foreground h-4 w-4 shrink-0 transition-colors" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{r.name}</div>
                  <div className="text-muted-foreground flex items-center gap-1 text-xs">
                    <Clock className="h-3 w-3" />
                    {timeAgo(r.viewedAt)}
                  </div>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </HomeSection>
  );
}

/** Compact "5m / 3h / 2d" relative time. Local to this module — the rest
 *  of the app renders absolute timestamps where they appear. */
function timeAgo(ts: number): string {
  const diff = Math.max(0, Date.now() - ts);
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  return `${day}d ago`;
}
