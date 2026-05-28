// The six entity browse tiles on the home page. Each tile shows the total
// count and, when a useful breakdown exists, the top sub-categories as
// filter-applied deep-links into the listing page. NPCs and quests don't
// have a sub-breakdown worth surfacing in 3 lines, so those tiles fall
// back to a single count + "Browse all" link.

import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { getDbClient, type CategoryCount, type EntityKind } from '@/db';
import { labelForEquipSlot } from '@/domain/equipTypes';
import { iconForEntity, listingRouteForEntity } from '@/lib/entityRoutes';
import type { Features } from '@/hooks/useFeatures';
import { HomeSection } from './HomeSection';

const TOP_N = 3;

/** Builds the deep-link URL for one row of a tile's breakdown. The
 *  signature lets each tile own a different URL shape — single-param
 *  for category filters, multi-param for level ranges. */
type HrefForKey = (key: string) => string;

/** Renders a sub-category key for display. The underlying `key` keeps
 *  the raw DB value (lowercase slug / enum) so the URL filter still
 *  matches; only the visible label is reshaped. */
type DisplayKey = (key: string) => string;

interface TileSpec {
  entity: EntityKind;
  label: string;
  enabled: boolean;
  count: number;
  /** null = no breakdown row rendered for this tile. */
  rows: CategoryCount[] | null;
  hrefForKey: HrefForKey | null;
  displayKey: DisplayKey;
}

/** Title-case a single lowercase token (item categories are 4 fixed
 *  enums: use/etc/setup/cash; "ETC" would look yelled, "Etc" reads as a
 *  word). */
function titleCaseToken(s: string): string {
  if (s.length === 0) return s;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

const IDENTITY: DisplayKey = (k) => k;

export function BrowseTiles({ features }: { features: Features }) {
  const db = useMemo(() => getDbClient(), []);
  const counts = features.counts ?? null;

  const itemCatsQ = useQuery({
    queryKey: ['home', 'browse', 'item-categories'],
    queryFn: () => db.listItemCategoryCounts(TOP_N),
    enabled: features.hasItems,
  });
  const equipSlotsQ = useQuery({
    queryKey: ['home', 'browse', 'equip-slots'],
    queryFn: () => db.listEquipSlotCounts(TOP_N),
    enabled: features.hasEquips,
  });
  const mobBucketsQ = useQuery({
    queryKey: ['home', 'browse', 'mob-level-buckets'],
    queryFn: () => db.listMobLevelBucketCounts(),
    enabled: features.hasMobs,
  });

  const tiles: TileSpec[] = [
    {
      entity: 'item',
      label: 'Items',
      enabled: features.hasItems,
      count: counts?.items ?? 0,
      rows: itemCatsQ.data ?? null,
      hrefForKey: (key) => `/items?f_category=${encodeURIComponent(key)}`,
      displayKey: titleCaseToken,
    },
    {
      entity: 'equip',
      label: 'Equips',
      enabled: features.hasEquips,
      count: counts?.equips ?? 0,
      rows: equipSlotsQ.data ?? null,
      hrefForKey: (key) => `/equips?f_slot=${encodeURIComponent(key)}`,
      // `labelForEquipSlot` already title-cases and expands hyphenated
      // slugs (e.g. "pet-equip" → "Pet Equip").
      displayKey: labelForEquipSlot,
    },
    {
      entity: 'mob',
      label: 'Mobs',
      enabled: features.hasMobs,
      count: counts?.mobs ?? 0,
      // Drop zero-count buckets so a dataset that's all early-game doesn't
      // advertise empty mid/endgame rows.
      rows: (mobBucketsQ.data ?? null)?.filter((r) => r.count > 0) ?? null,
      hrefForKey: mobBucketHref,
      // Mob bucket labels are numeric ranges already shaped for display
      // ("30-70", "120+") — no transformation needed.
      displayKey: IDENTITY,
    },
    {
      entity: 'npc',
      label: 'NPCs',
      enabled: features.hasNpcs,
      count: counts?.npcs ?? 0,
      rows: null,
      hrefForKey: null,
      displayKey: IDENTITY,
    },
    {
      entity: 'map',
      label: 'Maps',
      // MapsByRegion handles the breakdown separately — keep the tile
      // simple here so the two widgets don't repeat the same data.
      enabled: features.hasMaps,
      count: counts?.maps ?? 0,
      rows: null,
      hrefForKey: null,
      displayKey: IDENTITY,
    },
    {
      entity: 'quest',
      label: 'Quests',
      enabled: features.hasQuests,
      count: counts?.quests ?? 0,
      rows: null,
      hrefForKey: null,
      displayKey: IDENTITY,
    },
  ];

  const enabled = tiles.filter((t) => t.enabled);
  if (enabled.length === 0) return null;

  return (
    <HomeSection title="Browse">
      <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {enabled.map((t) => {
          const Icon = iconForEntity(t.entity);
          return (
            <li key={t.entity}>
              <div className="border-border bg-card text-card-foreground rounded-md border">
                <Link
                  to={listingRouteForEntity(t.entity)}
                  className="hover:bg-muted/40 group flex items-center gap-3 rounded-t-md p-4 transition-colors"
                >
                  <Icon className="text-muted-foreground group-hover:text-foreground h-5 w-5 shrink-0 transition-colors" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{t.label}</div>
                    <div className="text-muted-foreground font-mono text-xs">
                      {t.count.toLocaleString()}
                    </div>
                  </div>
                  <ArrowRight className="text-muted-foreground group-hover:text-foreground h-3.5 w-3.5 opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
                {t.rows && t.rows.length > 0 && t.hrefForKey && (
                  <ul className="border-border divide-border divide-y border-t text-xs">
                    {t.rows.map((row) => (
                      <li key={row.key}>
                        <Link
                          to={t.hrefForKey!(row.key)}
                          className="text-muted-foreground hover:bg-muted/40 hover:text-foreground flex items-center justify-between px-4 py-1.5 transition-colors"
                        >
                          <span className="truncate">{t.displayKey(row.key)}</span>
                          <span className="font-mono">{row.count.toLocaleString()}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </HomeSection>
  );
}

/** Resolves a mob-level bucket label to a `/mobs?f_level_min=…&f_level_max=…`
 *  URL. The "120+" bucket has no upper bound so the max param is omitted. */
function mobBucketHref(key: string): string {
  if (key === '120+') return '/mobs?f_level_min=120';
  // Anything else looks like "<min>-<max>"; split safely.
  const [minStr, maxStr] = key.split('-');
  const min = Number(minStr);
  const max = Number(maxStr);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return '/mobs';
  return `/mobs?f_level_min=${min}&f_level_max=${max}`;
}
