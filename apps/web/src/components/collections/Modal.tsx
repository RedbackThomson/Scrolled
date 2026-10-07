// Small portaled modal primitive used by the collection create/rename
// dialogs. Same conventions as `ColumnFilter.tsx`: outside-click and Escape
// close, focus is given to the first focusable child, body scroll locked
// while open. Hand-rolled rather than pulling in a shadcn/radix dialog —
// the codebase already standardised on the custom portal pattern.

import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn, IconButton } from '@scrolled/design';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Visible heading when it needs more than plain text (e.g. a breadcrumb); `title` still labels the dialog. */
  heading?: ReactNode;
  description?: string;
  /** Leading tile in the header, usually a 38px SlotTile. */
  icon?: ReactNode;
  /** Skip the header row; `title` still labels the dialog for screen readers. */
  headerless?: boolean;
  children: ReactNode;
  /** Footer slot (typically action buttons). */
  footer?: ReactNode;
  /**
   * Width/height utility classes for the outer panel. Defaults to the
   * `w-full max-w-md` used by the original collection dialogs.
   */
  panelClassName?: string;
  /**
   * Classes applied to the inner body container. Defaults to the standard
   * `border-t px-4 py-3`; the map viewer overrides this to a no-padding
   * flex column.
   */
  bodyClassName?: string;
}

export function Modal({
  open,
  onClose,
  title,
  heading,
  description,
  icon,
  headerless,
  children,
  footer,
  panelClassName,
  bodyClassName,
}: ModalProps) {
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
      <div className="sc-scrim absolute inset-0 bg-[var(--surface-scrim)]" aria-hidden />
      <div
        ref={panelRef}
        className={cn(
          'border-border bg-card text-card-foreground shadow-pop sc-modal relative flex flex-col overflow-hidden rounded-2xl border-2',
          panelClassName ?? 'w-full max-w-md',
        )}
      >
        {!headerless && (
          <div className="flex items-center gap-3 py-3.5 pl-[18px] pr-4">
            {icon}
            <div className="min-w-0 flex-1">
              <h2 className="font-display truncate text-[19px] font-semibold leading-tight">
                {heading ?? title}
              </h2>
              {description && <p className="text-muted-foreground text-[12.5px]">{description}</p>}
            </div>
            <IconButton
              data-modal-close
              variant="sunken"
              size={32}
              spin
              icon={X}
              label="Close"
              onClick={onClose}
            />
          </div>
        )}
        <div
          className={cn(
            !headerless && 'border-muted border-t-2',
            bodyClassName ?? 'px-[18px] py-4',
          )}
        >
          {children}
        </div>
        {footer && (
          <div className="border-muted bg-muted flex items-center justify-end gap-2 border-t-2 px-4 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
