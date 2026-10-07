import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { cn } from '@scrolled/design';

export interface DetailTab {
  key: string;
  label: string;
  count?: number;
  panel: ReactNode;
}

interface DetailTabsProps {
  tabs: DetailTab[];
  active: string;
  onChange: (key: string) => void;
}

/** Pill tabs for mobile detail pages. Inactive panels stay mounted so sort and scroll state survive. */
export function DetailTabs({ tabs, active, onChange }: DetailTabsProps) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const activeIndex = Math.max(
    0,
    tabs.findIndex((t) => t.key === active),
  );

  const onKeyDown = (e: KeyboardEvent) => {
    const last = tabs.length - 1;
    const next =
      e.key === 'ArrowRight'
        ? activeIndex === last
          ? 0
          : activeIndex + 1
        : e.key === 'ArrowLeft'
          ? activeIndex === 0
            ? last
            : activeIndex - 1
          : e.key === 'Home'
            ? 0
            : e.key === 'End'
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    onChange(tabs[next].key);
    refs.current[next]?.focus();
  };

  return (
    <div className="space-y-3">
      <div
        role="tablist"
        aria-orientation="horizontal"
        onKeyDown={onKeyDown}
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 py-1"
      >
        {tabs.map((t, i) => {
          const selected = i === activeIndex;
          return (
            <button
              key={t.key}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="tab"
              id={`${id}-tab-${t.key}`}
              aria-selected={selected}
              aria-controls={`${id}-panel-${t.key}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => onChange(t.key)}
              className={cn(
                'ease-spring focus-visible:ring-primary/30 inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm font-semibold transition-[background-color,color,box-shadow] duration-300 focus-visible:outline-none focus-visible:ring-4',
                selected
                  ? 'bg-card text-foreground shadow-float'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-xs font-medium">
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
      {tabs.map((t, i) => (
        <div
          key={t.key}
          role="tabpanel"
          id={`${id}-panel-${t.key}`}
          aria-labelledby={`${id}-tab-${t.key}`}
          hidden={i !== activeIndex}
        >
          {t.panel}
        </div>
      ))}
    </div>
  );
}
