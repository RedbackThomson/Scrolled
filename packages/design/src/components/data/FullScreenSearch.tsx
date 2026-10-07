import { useEffect, useRef, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { IconButton } from '../core/IconButton';
import { TextField } from '../forms/TextField';

export interface FullScreenSearchProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  placeholder?: string;
  /** Removable chips for the filters already applied */
  chips?: ReactNode;
  /** Return on the phone keyboard; label it with `enterKeyHint` */
  onSubmit?: () => void;
  enterKeyHint?: 'done' | 'search' | 'go' | 'enter';
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  /** Sections under the field, e.g. "Filter by" and "Results" */
  children?: ReactNode;
  'aria-label'?: string;
}

/** A phone search that takes the whole screen: a focused field, its chips, then sections. */
export function FullScreenSearch({
  value,
  onChange,
  onClose,
  placeholder,
  chips,
  onSubmit,
  enterKeyHint = 'search',
  onKeyDown,
  children,
  'aria-label': ariaLabel = 'Search',
}: FullScreenSearchProps) {
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => input.current?.focus(), []);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="animate-fade"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 55,
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--gradient-page)',
        color: 'var(--text-1)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: 'max(12px, env(safe-area-inset-top)) 12px 10px',
        }}
      >
        <IconButton
          icon={ArrowLeft}
          variant="float"
          size={44}
          label="Close search"
          onClick={onClose}
        />
        <TextField
          ref={input}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            onKeyDown?.(e);
            if (!e.defaultPrevented && e.key === 'Enter' && onSubmit) {
              e.preventDefault();
              onSubmit();
            }
            if (!e.defaultPrevented && e.key === 'Escape') onClose();
          }}
          enterKeyHint={enterKeyHint}
          placeholder={placeholder}
          aria-label={ariaLabel}
          shape="pill"
          icon={Search}
          // The field is the screen's only job, so it keeps the focus look throughout.
          focused
          className="flex-1"
          style={{ height: 44, gap: 10, padding: '0 14px', font: '500 16px var(--font-body)' }}
        />
      </div>
      {chips && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '2px 16px 8px' }}>
          {chips}
        </div>
      )}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          padding: '4px 16px 24px',
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

export interface FullScreenSearchSectionProps {
  title: string;
  children: ReactNode;
}

export function FullScreenSearchSection({ title, children }: FullScreenSearchSectionProps) {
  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
      <h2 style={{ margin: '0 0 2px', font: '700 13px var(--font-body)', color: 'var(--text-2)' }}>
        {title}
      </h2>
      {children}
    </section>
  );
}
