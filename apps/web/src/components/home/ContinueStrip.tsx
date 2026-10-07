// "Continue" row — last entities the user opened, newest first. Uses the
// same store that powers the command palette's Recents provider so the
// two surfaces always agree on what "recent" means.

import { Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useRecentEntities } from '@/lib/recents';
import { routeForEntity } from '@/lib/entityRoutes';
import { EntityAvatar } from '@/components/entity-display/EntityAvatar';
import { HomeSection } from './HomeSection';

const MAX = 6;

export function ContinueStrip() {
  const { items } = useRecentEntities();
  if (!items.length) return null;

  const slice = items.slice(0, MAX);

  return (
    <HomeSection title="Continue">
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        {slice.map((r) => (
          <li key={`${r.entity}-${r.id}`}>
            <Link
              to={routeForEntity(r.entity, r.id)}
              className="border-border bg-card text-card-foreground shadow-rim ease-spring flex h-full items-center gap-2.5 rounded-[14px] border-2 p-2.5 transition-transform duration-300 hover:-translate-y-[3px]"
              title={r.name}
            >
              <EntityAvatar entity={r.entity} id={r.id} alt={r.name} />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[13px] font-semibold">{r.name}</div>
                <div className="text-muted-foreground flex items-center gap-1 text-[11.5px]">
                  <Clock className="h-3 w-3" />
                  {timeAgo(r.viewedAt)}
                </div>
              </div>
            </Link>
          </li>
        ))}
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
