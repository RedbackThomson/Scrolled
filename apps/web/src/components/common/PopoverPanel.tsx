import {
  useEffect,
  useRef,
  type CSSProperties,
  type MouseEventHandler,
  type ReactNode,
  type Ref,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@scrolled/design';
import { useIsMobile } from '@/hooks/useIsMobile';
import type { PopoverCoords } from '@/hooks/usePopover';

interface PopoverPanelProps {
  /** Accessible name for the dialog. */
  label: string;
  onClose: () => void;
  /** From `usePopover`; dismissal treats clicks inside this element as inside. */
  panelRef: Ref<HTMLDivElement>;
  /** Anchor position on desktop; the panel waits for it before rendering there. */
  coords: PopoverCoords | null;
  /** Desktop-only sizing, e.g. `w-72`. */
  widthClassName?: string;
  /** Corner the desktop popover grows from. */
  align?: 'left' | 'right';
  /** Applied in both layouts — padding, overflow, spacing. */
  className?: string;
  onMouseDown?: MouseEventHandler<HTMLDivElement>;
  children: ReactNode;
}

/**
 * A trigger-anchored popover on desktop and a bottom sheet below `md`, so every
 * list-page menu gets thumb-reachable rows without each one branching itself.
 * Render it only while open.
 */
export function PopoverPanel({
  label,
  onClose,
  panelRef,
  coords,
  widthClassName,
  align = 'left',
  className,
  onMouseDown,
  children,
}: PopoverPanelProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return createPortal(
      <BottomSheet
        label={label}
        onClose={onClose}
        panelRef={panelRef}
        className={className}
        onMouseDown={onMouseDown}
      >
        {children}
      </BottomSheet>,
      document.body,
    );
  }

  if (!coords) return null;
  const style: CSSProperties = { position: 'fixed', top: coords.top, left: coords.left };
  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={label}
      style={style}
      onMouseDown={onMouseDown}
      className={cn(
        'border-border bg-card text-card-foreground shadow-pop animate-tip z-50 max-w-[calc(100vw-1rem)] rounded-xl border-2',
        align === 'right' ? 'origin-top-right' : 'origin-top-left',
        widthClassName,
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}

function BottomSheet({
  label,
  onClose,
  panelRef,
  className,
  onMouseDown,
  children,
}: {
  label: string;
  onClose: () => void;
  panelRef: Ref<HTMLDivElement>;
  className?: string;
  onMouseDown?: MouseEventHandler<HTMLDivElement>;
  children: ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement | null>(null);

  // The sheet covers its trigger, so focus moves in on open and back out on close.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const sheet = sheetRef.current;
    if (sheet && !sheet.contains(document.activeElement)) sheet.focus();
    return () => {
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  const setRefs = (node: HTMLDivElement | null) => {
    sheetRef.current = node;
    if (typeof panelRef === 'function') panelRef(node);
    else if (panelRef) (panelRef as { current: HTMLDivElement | null }).current = node;
  };

  return (
    <>
      <div
        aria-hidden
        onClick={onClose}
        className="animate-fade fixed inset-0 z-50 bg-[var(--surface-scrim)]"
      />
      <div
        ref={setRefs}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onMouseDown={onMouseDown}
        className={cn(
          'bg-card text-card-foreground animate-in slide-in-from-bottom fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-y-auto overscroll-contain rounded-t-[30px] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(10,20,50,.25)] duration-300 ease-out focus-visible:outline-none',
          // Popover bodies are sized for a pointer; lift their rows and fields
          // to touch size here rather than in every menu.
          '[&_[cmdk-item]]:min-h-12 [&_input:not([type=checkbox]):not([type=radio])]:h-11 [&_li>button]:min-h-12 [&_select]:h-11',
          className,
        )}
      >
        <span
          aria-hidden
          className="bg-border mx-auto mb-1 mt-2 h-[5px] w-11 shrink-0 rounded-full"
        />
        {children}
      </div>
    </>
  );
}
