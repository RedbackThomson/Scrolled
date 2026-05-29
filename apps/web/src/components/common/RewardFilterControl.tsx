import { useEffect, useRef } from 'react';
import { Filter, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ALL_EQUIP_CLASSES, type EquipClass } from '@/domain/equipJobs';
import { useCharacterPreferences, type Gender } from '@/stores/characterPreferences';

/**
 * Section-header filter control for quest rewards. Visually a sibling of
 * {@link ListSortControl}: a `<details>` whose summary is a compact button
 * and whose body is a small panel of chips. Picks are committed to the
 * persistent {@link useCharacterPreferences} store so the same selection
 * survives the next quest visit.
 */
export function RewardFilterControl() {
  const { job, gender, setJob, setGender, clear } = useCharacterPreferences();
  const activeCount = (job !== null ? 1 : 0) + (gender !== null ? 1 : 0);
  const label =
    activeCount === 0
      ? 'Filter rewards'
      : [job, gender ? gender[0].toUpperCase() + gender.slice(1) : null]
          .filter(Boolean)
          .join(' · ');

  // `<details>` doesn't dismiss on outside click on its own. We watch for
  // mousedowns and Escape and flip the native `open` property when the
  // user clicks anywhere that isn't the popover itself.
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const el = detailsRef.current;
      if (!el || !el.open) return;
      if (el.contains(e.target as Node)) return;
      el.open = false;
    };
    const onKey = (e: KeyboardEvent) => {
      const el = detailsRef.current;
      if (!el || !el.open) return;
      if (e.key === 'Escape') el.open = false;
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <details ref={detailsRef} className="relative">
      <summary
        className={cn(
          'border-input bg-background hover:bg-accent inline-flex h-7 cursor-pointer list-none items-center gap-1.5 rounded-md border px-2 text-xs font-medium normal-case tracking-normal',
          activeCount > 0 && 'border-primary/40 text-primary',
        )}
        style={{ listStyle: 'none' }}
        aria-label={label}
        title={label}
      >
        <Filter className="h-3.5 w-3.5" />
        Filter
        {activeCount > 0 && (
          <span className="bg-primary/15 text-primary inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[10px]">
            {activeCount}
          </span>
        )}
      </summary>
      <div className="border-border bg-card text-card-foreground absolute right-0 z-20 mt-1 w-64 max-w-[calc(100vw-1rem)] rounded-md border p-2 shadow-md">
        <div className="text-muted-foreground mb-1 flex items-center justify-between px-1">
          <span className="text-xs uppercase tracking-wide">Class</span>
          {job !== null && <ClearButton onClick={() => setJob(null)} label="Clear class" />}
        </div>
        <div className="mb-3 flex flex-wrap gap-1">
          {ALL_EQUIP_CLASSES.map((cls) => (
            <Chip
              key={cls}
              active={job === cls}
              onClick={() => setJob(job === cls ? null : cls)}
              label={cls}
            />
          ))}
        </div>
        <div className="text-muted-foreground mb-1 flex items-center justify-between px-1">
          <span className="text-xs uppercase tracking-wide">Gender</span>
          {gender !== null && <ClearButton onClick={() => setGender(null)} label="Clear gender" />}
        </div>
        <div className="mb-2 flex flex-wrap gap-1">
          <Chip
            active={gender === 'male'}
            onClick={() => setGender(gender === 'male' ? null : 'male')}
            label="Male"
          />
          <Chip
            active={gender === 'female'}
            onClick={() => setGender(gender === 'female' ? null : 'female')}
            label="Female"
          />
        </div>
        {activeCount > 0 && (
          <div className="border-border mt-2 flex justify-end border-t pt-2">
            <button
              type="button"
              onClick={clear}
              className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
            >
              Clear all
            </button>
          </div>
        )}
      </div>
    </details>
  );
}

interface ChipProps {
  active: boolean;
  label: EquipClass | Gender | string;
  onClick: () => void;
}

function Chip({ active, label, onClick }: ChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs',
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-input bg-background hover:bg-accent',
      )}
    >
      {label}
    </button>
  );
}

function ClearButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="text-muted-foreground hover:text-foreground inline-flex h-4 w-4 items-center justify-center rounded"
    >
      <X className="h-3 w-3" />
    </button>
  );
}
