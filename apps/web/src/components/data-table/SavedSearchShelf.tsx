import type { ReactNode } from 'react';
import { BookmarkPlus, Settings2 } from 'lucide-react';
import { PresetTile, Segmented } from '@scrolled/design';
import type { ColumnFilter } from '@/db';
import type { PinnedSearchRecord } from '@/db/user';
import { savedSearchLook } from '@/components/pinned-searches/savedSearchLook';
import { presetMatches, type ListPreset } from './presets';

export type ShelfTab = 'suggested' | 'yours';

interface SavedSearchShelfProps {
  tab: ShelfTab;
  onTab: (tab: ShelfTab) => void;
  presets: readonly ListPreset[];
  presetCounts: Record<string, number | undefined>;
  saved: readonly PinnedSearchRecord[];
  savedCounts: Record<number, number | undefined>;
  loadedId: number | null;
  dirty: boolean;
  filters: Record<string, ColumnFilter>;
  /** Show the "Save as new" tile */
  canSaveNew: boolean;
  /** `null` clears the filters (clicking the active tile again) */
  onApplyPreset: (preset: ListPreset | null) => void;
  onLoadSaved: (search: PinnedSearchRecord | null) => void;
  onSaveNew: () => void;
  onManage: () => void;
}

/** Suggested presets and the user's saved searches as tiles above a list. */
export function SavedSearchShelf(p: SavedSearchShelfProps) {
  const hasPresets = p.presets.length > 0;
  const tab = hasPresets ? p.tab : 'yours';

  const tiles = (compact: boolean): ReactNode[] =>
    tab === 'suggested'
      ? p.presets.map((preset) => {
          const active = presetMatches(preset, p.filters);
          return (
            <li key={preset.id} className={compact ? 'shrink-0 snap-start' : undefined}>
              <PresetTile
                icon={preset.icon}
                label={preset.label}
                hue={preset.hue}
                count={p.presetCounts[preset.id]}
                active={active}
                compact={compact}
                onClick={() => p.onApplyPreset(active ? null : preset)}
              />
            </li>
          );
        })
      : [
          ...p.saved.map((s) => {
            const active = p.loadedId === s.id;
            const look = savedSearchLook(s);
            return (
              <li key={s.id} className={compact ? 'shrink-0 snap-start' : undefined}>
                <PresetTile
                  icon={look.icon}
                  hue={look.hue}
                  label={s.name}
                  count={p.savedCounts[s.id]}
                  meta={s.pinned ? 'pinned' : undefined}
                  active={active}
                  dirty={active && p.dirty}
                  compact={compact}
                  onClick={() => p.onLoadSaved(active ? null : s)}
                />
              </li>
            );
          }),
          p.canSaveNew && (
            <li key="save-new" className={compact ? 'shrink-0 snap-start' : undefined}>
              <SaveNewTile compact={compact} onClick={p.onSaveNew} />
            </li>
          ),
        ];

  const empty = tab === 'yours' && p.saved.length === 0 && !p.canSaveNew;

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex min-h-8 items-center gap-2.5">
        {hasPresets ? (
          <Segmented
            size="sm"
            value={tab}
            onChange={(v) => p.onTab(v as ShelfTab)}
            options={[
              { value: 'suggested', label: 'Suggested' },
              { value: 'yours', label: `Yours · ${p.saved.length}` },
            ]}
          />
        ) : (
          <h2 className="font-display text-muted-foreground text-sm font-semibold">
            Your searches · {p.saved.length}
          </h2>
        )}
        {tab === 'yours' && p.saved.length > 0 && (
          <button
            type="button"
            onClick={p.onManage}
            className="sc-focus-ring text-muted-foreground hover:text-foreground ml-auto inline-flex items-center gap-1 rounded-md text-[12.5px] font-bold"
          >
            <Settings2 className="h-3.5 w-3.5" />
            Manage
          </button>
        )}
      </div>
      {empty ? (
        <p className="text-muted-foreground text-[13px]">
          Filter the list, then save the search to keep it here.
        </p>
      ) : (
        <>
          <ul className="grid grid-cols-2 gap-2.5 max-md:hidden sm:grid-cols-3 lg:grid-cols-6">
            {tiles(false)}
          </ul>
          {/* Vertical padding keeps the active halo from being clipped by the scroller. */}
          <ul className="-mx-2 flex snap-x snap-mandatory gap-2 overflow-x-auto px-2 py-1 [scrollbar-width:none] md:hidden [&::-webkit-scrollbar]:hidden">
            {tiles(true)}
          </ul>
        </>
      )}
    </div>
  );
}

function SaveNewTile({ compact, onClick }: { compact: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        compact
          ? 'sc-focus-ring border-primary inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border-2 border-dashed bg-[var(--accent-glow)] py-1 pl-1.5 pr-3 text-[13px] font-bold text-[color:var(--accent-text)]'
          : 'sc-focus-ring border-primary ease-spring flex h-full w-full items-center gap-2.5 rounded-2xl border-2 border-dashed bg-[var(--accent-glow)] px-2.5 py-2 text-left text-[color:var(--accent-text)] transition-transform duration-300 hover:-translate-y-[3px]'
      }
    >
      <span
        className={
          compact
            ? 'bg-card grid h-[22px] w-[22px] place-items-center rounded-full'
            : 'bg-card shadow-slot grid h-8 w-8 shrink-0 place-items-center rounded-[10px]'
        }
      >
        <BookmarkPlus className={compact ? 'h-3 w-3' : 'h-4 w-4'} />
      </span>
      {compact ? (
        'Save as new'
      ) : (
        <span className="flex flex-col leading-tight">
          <span className="font-display text-sm font-semibold">Save as new</span>
          <span className="text-[11.5px]">from current filters</span>
        </span>
      )}
    </button>
  );
}
