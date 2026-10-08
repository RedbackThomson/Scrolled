import {
  forwardRef,
  useEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type HTMLAttributes,
  type PointerEvent,
  type ReactNode,
} from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { ArrowLeft, X } from 'lucide-react';
import { cn } from '../../lib/cn';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetPortal = DialogPrimitive.Portal;
export const SheetClose = DialogPrimitive.Close;

export const SheetOverlay = forwardRef<
  ElementRef<typeof DialogPrimitive.Overlay>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-40 bg-[var(--surface-scrim)]',
      className,
    )}
    {...props}
  />
));
SheetOverlay.displayName = DialogPrimitive.Overlay.displayName;

type SheetSide = 'top' | 'bottom' | 'left' | 'right';

// Position + slide animation per side. Sizing (width / height) is intentionally
// left to the consumer via `className` — left-drawer width and bottom-sheet
// height aren't one-size-fits-all.
const sideClasses: Record<SheetSide, string> = {
  top: 'inset-x-0 top-0 rounded-b-[30px] data-[state=closed]:slide-out-to-top data-[state=open]:slide-in-from-top',
  bottom:
    'inset-x-0 bottom-0 rounded-t-[30px] data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
  left: 'inset-y-0 left-0 h-full rounded-r-[30px] data-[state=closed]:slide-out-to-left data-[state=open]:slide-in-from-left',
  right:
    'inset-y-0 right-0 h-full rounded-l-[30px] data-[state=closed]:slide-out-to-right data-[state=open]:slide-in-from-right',
};

export interface SheetContentProps extends ComponentPropsWithoutRef<
  typeof DialogPrimitive.Content
> {
  side?: SheetSide;
  /** Render the floating close (X) button inside the sheet. Defaults to true. */
  showCloseButton?: boolean;
  /** Render the backdrop overlay. Defaults to true. */
  withOverlay?: boolean;
  /** Extra classes applied to the overlay — useful for gating it with responsive utilities. */
  overlayClassName?: string;
}

export const SheetContent = forwardRef<
  ElementRef<typeof DialogPrimitive.Content>,
  SheetContentProps
>(
  (
    {
      className,
      children,
      side = 'right',
      showCloseButton = true,
      withOverlay = true,
      overlayClassName,
      ...props
    },
    ref,
  ) => (
    <SheetPortal>
      {withOverlay && <SheetOverlay className={overlayClassName} />}
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          'bg-card text-card-foreground data-[state=open]:animate-in data-[state=closed]:animate-out fixed z-50 flex flex-col shadow-[0_12px_40px_rgba(10,20,50,.25)] outline-none data-[state=closed]:duration-200 data-[state=open]:duration-300 data-[state=open]:ease-out',
          sideClasses[side],
          className,
        )}
        {...props}
      >
        {side === 'bottom' && <SheetHandle className="mt-2" />}
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            aria-label="Close"
            className="bg-muted text-muted-foreground ease-spring hover:text-foreground focus-visible:ring-primary/30 absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-[10px] transition-transform duration-300 hover:rotate-90 focus-visible:outline-none focus-visible:ring-4"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </SheetPortal>
  ),
);
SheetContent.displayName = DialogPrimitive.Content.displayName;

export const SheetHeader = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col space-y-1.5 px-4 pt-4 text-left', className)} {...props} />
);
SheetHeader.displayName = 'SheetHeader';

export const SheetFooter = ({ className, ...props }: HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('mt-auto flex flex-col gap-2 px-4 pb-4 pt-2', className)} {...props} />
);
SheetFooter.displayName = 'SheetFooter';

export const SheetTitle = forwardRef<
  ElementRef<typeof DialogPrimitive.Title>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('font-display text-xl font-semibold leading-tight', className)}
    {...props}
  />
));
SheetTitle.displayName = DialogPrimitive.Title.displayName;

export const SheetDescription = forwardRef<
  ElementRef<typeof DialogPrimitive.Description>,
  ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-muted-foreground text-sm', className)}
    {...props}
  />
));
SheetDescription.displayName = DialogPrimitive.Description.displayName;

/** The grab handle at the top of a bottom sheet. */
export function SheetHandle({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn('bg-border mx-auto h-[5px] w-11 shrink-0 rounded-full', className)}
    />
  );
}

export interface BottomSheetProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  /** Accessible name for the sheet. */
  label: string;
  /** Tapping the scrim or swiping the sheet down. Escape and outside clicks are the caller's to handle. */
  onDismiss: () => void;
  /** Gap above a tall sheet, in px; the sheet fills the rest of the screen. Omit to size to content. */
  top?: number;
  /** Pinned under the scrolling content, e.g. a full-width action. */
  footer?: ReactNode;
  /** Shows a back button for a panel pushed inside the sheet. */
  onBack?: () => void;
}

const SWIPE_DISMISS_PX = 90;

/**
 * A bottom sheet for content that manages its own open state, such as a popover
 * that turns into a sheet on phones. Render it only while open, inside a portal.
 * Swiping down from the handle dismisses it. Use `Sheet` when you want a full
 * modal dialog instead.
 */
export const BottomSheet = forwardRef<HTMLDivElement, BottomSheetProps>(function BottomSheet(
  { label, onDismiss, top, footer, onBack, className, style, children, ...props },
  ref,
) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef<{ startY: number; pointer: number } | null>(null);
  const [offset, setOffset] = useState(0);

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
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  const grab = {
    onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
      drag.current = { startY: e.clientY, pointer: e.pointerId };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
      if (drag.current) setOffset(Math.max(0, e.clientY - drag.current.startY));
    },
    onPointerUp: () => {
      drag.current = null;
      if (offset > SWIPE_DISMISS_PX) onDismiss();
      else setOffset(0);
    },
    onPointerCancel: () => {
      drag.current = null;
      setOffset(0);
    },
  };

  return (
    <>
      <div
        aria-hidden
        onClick={onDismiss}
        className="animate-fade fixed inset-0 z-50 bg-[var(--surface-scrim)]"
      />
      <div
        ref={setRefs}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        className={cn(
          'bg-card text-card-foreground animate-in slide-in-from-bottom fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-[30px] shadow-[0_-12px_40px_rgba(10,20,50,.25)] duration-300 ease-out focus-visible:outline-none',
          top == null && 'max-h-[85dvh]',
          className,
        )}
        style={{
          top,
          transform: offset ? `translateY(${offset}px)` : undefined,
          transition: drag.current ? 'none' : 'transform var(--dur-base) var(--ease-spring)',
          ...style,
        }}
        {...props}
      >
        {/* The whole row is the drag target, so it stays a comfortable thumb height. */}
        <div
          {...grab}
          className={cn(
            'relative flex shrink-0 touch-none items-start justify-center pt-2',
            onBack ? 'h-[52px]' : 'h-10',
          )}
        >
          <SheetHandle />
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              onPointerDown={(e) => e.stopPropagation()}
              aria-label="Back"
              className="sc-focus-ring text-muted-foreground absolute left-3 top-1 grid h-11 w-11 place-items-center rounded-full"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
        </div>
        <div
          className={cn(
            'min-h-0 flex-1 overflow-y-auto overscroll-contain',
            !footer && 'pb-[max(1rem,env(safe-area-inset-bottom))]',
          )}
        >
          {children}
        </div>
        {footer && (
          <div className="shrink-0 px-4 pb-[max(1.625rem,env(safe-area-inset-bottom))] pt-2">
            {footer}
          </div>
        )}
      </div>
    </>
  );
});
