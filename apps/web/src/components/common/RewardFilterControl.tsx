import { Filter, X } from 'lucide-react';
import { cn } from '@scrolled/design';
import { ALL_EQUIP_CLASSES, type EquipClass } from '@scrolled/game-db/domain/equipJobs';
import { useCharacterPreferences, type Gender } from '@/stores/characterPreferences';
import { PopoverPanel } from '@/components/common/PopoverPanel';
import { usePopover } from '@/hooks/usePopover';

/**
 * Section-header filter control for quest rewards. Visually a sibling of
 * {@link ListSortControl}: a compact button that opens a small panel of chips. Picks are committed to the
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

  const { open, setOpen, close, coords, triggerRef, popoverRef } = usePopover();

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={cn(
          'border-input bg-background hover:bg-accent inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-md border px-2 text-xs font-medium normal-case tracking-normal max-md:h-11 max-md:px-3',
          activeCount > 0 && 'border-primary/40 text-primary',
        )}
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
      </button>
      {open && (
        <PopoverPanel
          label="Filter rewards"
          onClose={close}
          panelRef={popoverRef}
          coords={coords}
          widthClassName="w-64"
          align="right"
          className="p-2 max-md:px-4"
        >
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
            {gender !== null && (
              <ClearButton onClick={() => setGender(null)} label="Clear gender" />
            )}
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
        </PopoverPanel>
      )}
    </>
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
        'inline-flex items-center rounded-full border px-2 py-0.5 text-xs max-md:min-h-11 max-md:px-3.5',
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
      className="text-muted-foreground hover:text-foreground inline-flex h-4 w-4 items-center justify-center rounded max-md:h-11 max-md:w-11"
    >
      <X className="h-3 w-3" />
    </button>
  );
}
