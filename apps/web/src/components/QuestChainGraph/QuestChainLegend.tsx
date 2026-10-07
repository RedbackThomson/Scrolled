import { cn } from '@scrolled/design';

const ITEMS = [
  { label: 'Start', swatch: 'border-emerald-500 ring-2 ring-emerald-500/25' },
  { label: 'Required', swatch: 'border-border' },
  { label: 'Optional', swatch: 'border-border border-dashed opacity-70' },
  { label: 'Cycle', swatch: 'border-amber-500 ring-2 ring-amber-500/25' },
  { label: 'Other chain', swatch: 'border-foreground/30 bg-muted border-dotted opacity-[.55]' },
];

/** Key to the node styles, floating over the canvas. */
export function QuestChainLegend() {
  return (
    <ul
      aria-label="Legend"
      className="bg-card shadow-float pointer-events-none absolute bottom-3 left-3 z-10 flex flex-wrap gap-x-3 gap-y-1.5 rounded-[14px] px-3 py-2 text-[11.5px] font-semibold max-md:hidden"
    >
      {ITEMS.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span aria-hidden className={cn('bg-card h-3 w-5 rounded-[5px] border-2', item.swatch)} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
