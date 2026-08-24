import { cn } from '@scrolled/ui';
import { FIELD_MODES, type FieldMode } from '@/components/entity-links/registry';

const MODE_LABELS: Record<FieldMode, string> = {
  always: 'Always',
  whenPresent: 'When present',
  never: 'Never',
};

export function FieldModeControl({
  value,
  onChange,
}: {
  value: FieldMode;
  onChange: (mode: FieldMode) => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-1 text-xs" role="radiogroup">
      {FIELD_MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={value === mode}
          onClick={() => onChange(mode)}
          className={cn(
            'rounded px-2 py-1 transition-colors',
            value === mode
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {MODE_LABELS[mode]}
        </button>
      ))}
    </div>
  );
}
