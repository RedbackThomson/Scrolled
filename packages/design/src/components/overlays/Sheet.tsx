import {
  forwardRef,
  type ComponentPropsWithoutRef,
  type ElementRef,
  type HTMLAttributes,
} from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
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
          'bg-card text-card-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:ease-spring fixed z-50 flex flex-col shadow-[0_12px_40px_rgba(10,20,50,.25)] outline-none data-[state=closed]:duration-200 data-[state=open]:duration-500',
          sideClasses[side],
          className,
        )}
        {...props}
      >
        {side === 'bottom' && (
          <span aria-hidden className="bg-border mx-auto mt-2 h-[5px] w-11 shrink-0 rounded-full" />
        )}
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
