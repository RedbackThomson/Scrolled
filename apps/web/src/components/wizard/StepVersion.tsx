import type { WzMapleVersionName } from '@/parser';
import { cn } from '@/lib/utils';

interface Props {
  value: WzMapleVersionName;
  onChange: (v: WzMapleVersionName) => void;
}

interface Option {
  id: WzMapleVersionName;
  label: string;
  description: string;
}

const OPTIONS: Option[] = [
  {
    id: 'GMS',
    label: 'GMS (old Global MapleStory)',
    description: 'Correct for MapleRoyals v83-era clients. Pick this unless you know otherwise.',
  },
  {
    id: 'BMS',
    label: 'BMS',
    description: 'Modern Global MapleStory / MapleSEA / MapleStory Japan.',
  },
  {
    id: 'EMS',
    label: 'EMS',
    description: 'Old MapleStory Europe / China encryption.',
  },
  {
    id: 'CLASSIC',
    label: 'Classic',
    description: 'Less common; only pick this if your files were specifically built for it.',
  },
];

export function StepVersion({ value, onChange }: Props) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Which client are these files from?</h2>
        <p className="text-muted-foreground mt-1 text-sm">
          The encryption version determines how we decode strings out of your{' '}
          <code className="font-mono text-xs">.wz</code> files. Pick wrong and names come out as
          garbage — you can always restart the wizard.
        </p>
      </div>
      <ul className="space-y-2">
        {OPTIONS.map((o) => {
          const selected = value === o.id;
          return (
            <li key={o.id}>
              <button
                type="button"
                onClick={() => onChange(o.id)}
                className={cn(
                  'w-full rounded-md border p-3 text-left transition-colors',
                  selected
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-card hover:border-foreground/30',
                )}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{o.label}</span>
                  <span
                    className={cn(
                      'h-4 w-4 rounded-full border-2',
                      selected ? 'border-primary bg-primary' : 'border-muted-foreground/30',
                    )}
                  />
                </div>
                <p className="text-muted-foreground mt-1 text-xs">{o.description}</p>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
