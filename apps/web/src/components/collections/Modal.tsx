// Small portaled modal primitive used by the collection create/rename
// dialogs. Same conventions as `ColumnFilter.tsx`: outside-click and Escape
// close, focus is given to the first focusable child, body scroll locked
// while open. Hand-rolled rather than pulling in a shadcn/radix dialog —
// the codebase already standardised on the custom portal pattern.

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  /** Footer slot (typically action buttons). */
  footer?: ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, description, children, footer, className }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Escape close + initial focus.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey);
    // Give the first focusable child focus so Enter/Tab work as expected.
    const first = panelRef.current?.querySelector<HTMLElement>(
      'input,select,textarea,button:not([data-modal-close])',
    );
    first?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-background/70 absolute inset-0 backdrop-blur-sm" aria-hidden />
      <div
        ref={panelRef}
        className={cn(
          'border-border bg-card text-card-foreground relative w-full max-w-md rounded-lg border shadow-lg',
          className,
        )}
      >
        <div className="flex items-start justify-between gap-3 p-4">
          <div className="min-w-0 space-y-1">
            <h2 className="truncate text-base font-semibold">{title}</h2>
            {description && (
              <p className="text-muted-foreground text-xs">{description}</p>
            )}
          </div>
          <button
            type="button"
            data-modal-close
            onClick={onClose}
            aria-label="Close"
            className="text-muted-foreground hover:bg-accent hover:text-foreground inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="border-border border-t px-4 py-3">{children}</div>
        {footer && (
          <div className="border-border bg-muted/30 flex items-center justify-end gap-2 rounded-b-lg border-t px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
