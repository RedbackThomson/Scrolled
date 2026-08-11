import { useMemo } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Package, ScrollText } from 'lucide-react';
import {
  collectUnlockables,
  type NavGraph,
  type UnlockableEntry,
  type UnlockableKind,
} from '@scrolled/nav-graph';

import { useDirections } from '@/stores/useDirections';
import { ToggleSwitch } from './ToggleSwitch';

// One section per unlockable kind, in this order. Add a kind here (and to the
// nav-graph UnlockableKind union) as new id-bearing requirements appear.
const GROUPS: Record<UnlockableKind, { label: string; icon: LucideIcon }> = {
  item: { label: 'Items', icon: Package },
  quest: { label: 'Quests', icon: ScrollText },
};
const GROUP_ORDER: UnlockableKind[] = ['item', 'quest'];

// Named subjects first (alphabetical); anonymous ones after, by id — so a graph
// that hasn't named everything still lists predictably.
function byLabel(a: UnlockableEntry, b: UnlockableEntry): number {
  if (a.name && b.name) return a.name.localeCompare(b.name);
  if (a.name) return -1;
  if (b.name) return 1;
  return a.id - b.id;
}

export interface RequirementUnlocksProps {
  graph: NavGraph;
}

/**
 * The "requirements unlocked" section of the travel-setup menu: every item /
 * quest the graph gates a route on, grouped by type, each a toggle. Everything
 * starts unlocked; turning one off makes pathfinding route around edges that
 * need it. Renders nothing when the graph gates on no requirements.
 */
export function RequirementUnlocks({ graph }: RequirementUnlocksProps) {
  const entries = useMemo(() => collectUnlockables(graph.source), [graph]);
  const locked = useDirections((s) => s.options.lockedRequirements);
  const toggleRequirement = useDirections((s) => s.toggleRequirement);
  const setRequirementsLocked = useDirections((s) => s.setRequirementsLocked);

  const groups = useMemo(
    () =>
      GROUP_ORDER.map((kind) => ({
        kind,
        meta: GROUPS[kind],
        items: entries.filter((e) => e.kind === kind).sort(byLabel),
      })).filter((g) => g.items.length > 0),
    [entries],
  );

  if (entries.length === 0) return null;

  const lockedSet = new Set(locked);

  return (
    <div className="border-border mt-3 border-t pt-3">
      <p className="text-sm font-medium">Requirements unlocked</p>
      <p className="text-muted-foreground mt-0.5 text-xs">
        Enables routes that require specific items or quests to be completed
      </p>
      <div className="mt-2 flex flex-col gap-3">
        {groups.map((group) => {
          const keys = group.items.map((i) => i.key);
          const unlockedCount = keys.filter((k) => !lockedSet.has(k)).length;
          const allUnlocked = unlockedCount === keys.length;
          const Icon = group.meta.icon;
          return (
            <div key={group.kind}>
              <div className="flex items-center justify-between gap-2 px-2">
                <span className="text-muted-foreground flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider">
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                  {group.meta.label}
                  <span className="tabular-nums">
                    {unlockedCount}/{keys.length}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setRequirementsLocked(keys, allUnlocked)}
                  className="text-muted-foreground hover:text-foreground text-[11px] underline-offset-2 hover:underline"
                >
                  {allUnlocked ? 'None' : 'All'}
                </button>
              </div>
              <div className="mt-1 flex flex-col gap-0.5">
                {group.items.map((entry) => {
                  const checked = !lockedSet.has(entry.key);
                  return (
                    <button
                      key={entry.key}
                      type="button"
                      role="switch"
                      aria-checked={checked}
                      aria-label={entry.name ?? `${group.meta.label} #${entry.id}`}
                      onClick={() => toggleRequirement(entry.key)}
                      className="hover:bg-accent flex items-center gap-3 rounded-md p-2 text-left transition-colors"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm">
                        {entry.name ?? `#${entry.id}`}
                      </span>
                      <ToggleSwitch checked={checked} />
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
