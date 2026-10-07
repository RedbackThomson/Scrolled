import { cn } from '@scrolled/design';
import { FIELD_LABEL } from './fieldStyles';
import { COLLECTION_ICONS } from './iconRegistry';
import { COLLECTION_COLORS, resolveCollectionColor } from './colorRegistry';

interface IconFieldProps {
  value: string;
  onChange: (name: string) => void;
  /** Colour key the selected tile is tinted with */
  colorName: string;
}

/** The icon grid shared by collection and saved-search dialogs. */
export function IconField({ value, onChange, colorName }: IconFieldProps) {
  const color = resolveCollectionColor(colorName);
  return (
    <fieldset className="space-y-1.5">
      <legend className={FIELD_LABEL}>Icon</legend>
      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8">
        {COLLECTION_ICONS.map((opt) => {
          const active = opt.name === value;
          return (
            <button
              key={opt.name}
              type="button"
              onClick={() => onChange(opt.name)}
              aria-label={opt.label}
              aria-pressed={active}
              title={opt.label}
              className={cn(
                'sc-focus-ring flex h-[38px] w-[38px] items-center justify-center rounded-[10px] text-sm transition-colors',
                active
                  ? cn(color.iconBg, color.iconColor, 'ring-2 ring-current')
                  : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              <opt.Icon className="h-4 w-4" />
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

interface ColorFieldProps {
  value: string;
  onChange: (name: string) => void;
}

/** The colour swatch row shared by collection and saved-search dialogs. */
export function ColorField({ value, onChange }: ColorFieldProps) {
  return (
    <fieldset className="space-y-1.5">
      <legend className={FIELD_LABEL}>Color</legend>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-10">
        {COLLECTION_COLORS.map((opt) => {
          const active = opt.name === value;
          return (
            <button
              key={opt.name}
              type="button"
              onClick={() => onChange(opt.name)}
              aria-label={opt.label}
              aria-pressed={active}
              title={opt.label}
              className={cn(
                'sc-focus-ring ease-spring flex h-[30px] w-[30px] items-center justify-center rounded-full transition-transform duration-300',
                opt.swatch,
                active
                  ? 'ring-offset-card scale-110 ring-2 ring-current ring-offset-[3px]'
                  : 'shadow-[inset_0_-3px_0_rgba(0,0,0,.15)] hover:scale-105',
              )}
            />
          );
        })}
      </div>
    </fieldset>
  );
}
