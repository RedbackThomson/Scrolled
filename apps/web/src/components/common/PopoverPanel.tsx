import type { MouseEventHandler, ReactNode, Ref } from 'react';
import { createPortal } from 'react-dom';
import { BottomSheet, cn, Popover } from '@scrolled/design';
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
  /** Desktop notch centre in px from the panel's left edge; omit for no notch. */
  arrowLeft?: number;
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
  arrowLeft,
  className,
  onMouseDown,
  children,
}: PopoverPanelProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return createPortal(
      <BottomSheet
        ref={panelRef}
        label={label}
        onDismiss={onClose}
        onMouseDown={onMouseDown}
        className={cn(
          // Popover bodies are sized for a pointer; lift their rows and fields
          // to touch size here rather than in every menu.
          '[&_[cmdk-item]]:min-h-12 [&_input:not([type=checkbox]):not([type=radio])]:h-11 [&_li>button]:min-h-12 [&_select]:h-11',
          className,
        )}
      >
        {children}
      </BottomSheet>,
      document.body,
    );
  }

  if (!coords) return null;
  return createPortal(
    <Popover
      ref={panelRef}
      role="dialog"
      aria-label={label}
      onMouseDown={onMouseDown}
      arrow={arrowLeft === undefined ? undefined : 'top'}
      arrowLeft={arrowLeft}
      style={{ position: 'fixed', top: coords.top, left: coords.left }}
      className={cn(
        'z-50 max-w-[calc(100vw-1rem)]',
        arrowLeft === undefined && (align === 'right' ? 'origin-top-right' : 'origin-top-left'),
        widthClassName,
        className,
      )}
    >
      {children}
    </Popover>,
    document.body,
  );
}
