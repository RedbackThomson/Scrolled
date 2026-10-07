import {
  useRef,
  type InputHTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from 'react';
import { Plus, Search } from 'lucide-react';
import { Icon } from '../core/Icon';
import { TextField } from '../forms/TextField';
import { Kbd } from '../core/Kbd';
import { FacetPill } from './FacetPill';
import { FilterChip } from './FilterChip';

export interface FacetBarFacet {
  id: string;
  label: string;
  hue: number;
  /** Set when the facet has a value */
  valueLabel?: string;
}

/** An active filter on a column that isn't one of the pinned facets */
export interface FacetBarChip {
  id: string;
  label: string;
  value: ReactNode;
  hue?: number;
}

export interface FacetBarProps {
  facets: readonly FacetBarFacet[];
  chips?: readonly FacetBarChip[];
  query: string;
  onQueryChange: (query: string) => void;
  onOpenFacet: (id: string, anchor: HTMLElement) => void;
  /** Clears a facet or chip by id */
  onClear: (id: string) => void;
  /** Omit to hide "More" */
  onOpenMore?: (anchor: HTMLElement) => void;
  /** Facet id whose popover is showing, or "more" */
  openId?: string | null;
  placeholder?: string;
  /** Keycap shown in the empty field, e.g. "/" */
  shortcut?: string;
  inputRef?: Ref<HTMLInputElement>;
  inputProps?: Omit<
    InputHTMLAttributes<HTMLInputElement>,
    'value' | 'onChange' | 'placeholder' | 'size'
  >;
  /** Rendered under the bar, e.g. the suggestion popover */
  children?: ReactNode;
}

export const FACET_BAR_PLACEHOLDER = 'Filter by name, or type “thief”, “30-50”, “fire”…';

/** The search pill with per-page facet pills. Backspace in the empty field steps back through active facets. */
export function FacetBar({
  facets,
  chips = [],
  query,
  onQueryChange,
  onOpenFacet,
  onClear,
  onOpenMore,
  openId,
  placeholder = FACET_BAR_PLACEHOLDER,
  shortcut,
  inputRef,
  inputProps,
  children,
}: FacetBarProps) {
  const localInput = useRef<HTMLInputElement | null>(null);
  const targets = useRef(new Map<string, HTMLElement>());

  const activeIds = [
    ...facets.filter((f) => f.valueLabel != null).map((f) => f.id),
    ...chips.map((c) => c.id),
  ];

  const setInput = (el: HTMLInputElement | null) => {
    localInput.current = el;
    if (typeof inputRef === 'function') inputRef(el);
    else if (inputRef) (inputRef as { current: HTMLInputElement | null }).current = el;
  };

  const register = (id: string) => (el: HTMLElement | null) => {
    if (el) targets.current.set(id, el);
    else targets.current.delete(id);
  };

  const onInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    inputProps?.onKeyDown?.(e);
    if (e.defaultPrevented || e.key !== 'Backspace' || query !== '') return;
    const last = activeIds[activeIds.length - 1];
    if (!last) return;
    e.preventDefault();
    targets.current.get(last)?.focus();
  };

  const clearFromKey = (id: string) => (e: KeyboardEvent) => {
    if (e.key !== 'Backspace' && e.key !== 'Delete') return;
    e.preventDefault();
    onClear(id);
    localInput.current?.focus();
  };

  return (
    <div style={{ position: 'relative' }}>
      <TextField
        {...inputProps}
        ref={setInput}
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={onInputKeyDown}
        placeholder={placeholder}
        spellCheck={false}
        icon={Search}
        wrap
        inputClassName="min-w-[160px] py-1"
        style={{
          minHeight: 44,
          borderRadius: 22,
          padding: '4px 6px 4px 14px',
          gap: 6,
          font: '500 14px var(--font-body)',
        }}
        trailing={
          <>
            {shortcut && query === '' && (
              <span className="hidden md:inline-flex">
                <Kbd>{shortcut}</Kbd>
              </span>
            )}
            {facets.map((f) => (
              <FacetPill
                key={f.id}
                ref={register(f.id)}
                label={f.label}
                valueLabel={f.valueLabel}
                hue={f.hue}
                open={openId === f.id}
                onClick={(e) => onOpenFacet(f.id, e.currentTarget)}
                onKeyDown={f.valueLabel != null ? clearFromKey(f.id) : undefined}
              />
            ))}
            {chips.map((c) => (
              <span
                key={c.id}
                ref={(el) => register(c.id)(el?.querySelector('button') ?? null)}
                onKeyDown={clearFromKey(c.id)}
                style={{ display: 'inline-flex' }}
              >
                <FilterChip
                  label={c.label}
                  value={c.value}
                  hue={c.hue}
                  onRemove={() => onClear(c.id)}
                />
              </span>
            ))}
            {onOpenMore && (
              <button
                type="button"
                aria-haspopup="dialog"
                aria-expanded={openId === 'more'}
                onClick={(e) => onOpenMore(e.currentTarget)}
                className="sc-focus-ring hover:text-foreground"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '4px 10px',
                  border: '2px solid transparent',
                  borderRadius: 999,
                  background: 'transparent',
                  color: 'var(--text-2)',
                  font: '700 13px var(--font-body)',
                  cursor: 'pointer',
                }}
              >
                <Icon icon={Plus} size={14} />
                More
              </button>
            )}
          </>
        }
      />
      {children}
    </div>
  );
}
