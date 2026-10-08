import {
  forwardRef,
  useEffect,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ElementRef,
  type HTMLAttributes,
  type ReactNode,
} from 'react';
import { Command as CommandPrimitive } from 'cmdk';
import { ArrowLeft, Search } from 'lucide-react';
import { IconButton } from '../core/IconButton';
import { Dialog, DialogContent } from './Dialog';
import { cn } from '../../lib/cn';

export const Command = forwardRef<
  ElementRef<typeof CommandPrimitive>,
  ComponentPropsWithoutRef<typeof CommandPrimitive>
>(({ className, ...props }, ref) => (
  <CommandPrimitive
    ref={ref}
    className={cn(
      'bg-card text-card-foreground flex h-full w-full flex-col overflow-hidden',
      className,
    )}
    {...props}
  />
));
Command.displayName = CommandPrimitive.displayName;

interface CommandDialogProps extends ComponentPropsWithoutRef<typeof Dialog> {
  label?: string;
  shouldFilter?: boolean;
  footer?: React.ReactNode;
}

/**
 * The part of the screen the on-screen keyboard leaves visible. A full-screen
 * dialog sized to the layout viewport runs behind the keyboard, and the browser
 * then pans the page underneath when the list is dragged.
 */
function useVisibleViewport() {
  const [box, setBox] = useState<{ top: number; height: number } | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setBox({ top: vv.offsetTop, height: vv.height });
    update();
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    return () => {
      vv.removeEventListener('resize', update);
      vv.removeEventListener('scroll', update);
    };
  }, []);
  return box;
}

export function CommandDialog({
  children,
  label,
  shouldFilter,
  footer,
  ...props
}: CommandDialogProps) {
  const visible = useVisibleViewport();
  return (
    <Dialog {...props}>
      <DialogContent
        showCloseButton={false}
        // Below `md` the palette covers the whole viewport — centered modals
        // are awkward on narrow phones where the on-screen keyboard already
        // claims half the height. Override translate/positioning so the
        // dialog fills the screen instead of staying centered.
        className="flex flex-col gap-0 overflow-hidden p-0 max-md:inset-x-0 max-md:top-[var(--palette-top,0px)] max-md:h-[var(--palette-height,100dvh)] max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-none max-md:border-0 sm:max-w-[600px]"
        aria-label={label ?? 'Command palette'}
        style={
          visible
            ? ({
                '--palette-top': `${visible.top}px`,
                '--palette-height': `${visible.height}px`,
              } as CSSProperties)
            : undefined
        }
      >
        <Command
          label={label ?? 'Command palette'}
          shouldFilter={shouldFilter}
          className="min-h-0 flex-1 [&_[cmdk-group]]:px-2 max-md:[&_[cmdk-item]]:min-h-11 [&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5"
        >
          {children}
        </Command>
        {footer && (
          // Keyboard hints aren't useful on touch — hide them on mobile so the
          // list claims the recovered vertical space.
          <div className="border-muted bg-muted text-muted-foreground hidden border-t-2 px-4 py-[9px] text-xs md:block">
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export const CommandInput = forwardRef<
  ElementRef<typeof CommandPrimitive.Input>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Input> & {
    /** Shown at the input's right edge, e.g. a shortcuts hint. */
    trailing?: ReactNode;
    /** Shows a back button in place of the search icon on phones, where there is no Escape key. */
    onBack?: () => void;
  }
>(({ className, trailing, onBack, ...props }, ref) => (
  <div
    // A drag starting on the focused field slips past the dialog's scroll lock and scrolls the page.
    className="border-muted flex items-center gap-3 border-b-2 px-[18px] max-md:touch-none max-md:pl-2"
    cmdk-input-wrapper=""
  >
    {onBack && (
      <span className="md:hidden">
        <IconButton icon={ArrowLeft} variant="ghost" size={44} label="Close" onClick={onBack} />
      </span>
    )}
    <Search
      className={cn('text-muted-foreground h-5 w-5 shrink-0', onBack && 'max-md:hidden')}
    />
    <CommandPrimitive.Input
      ref={ref}
      className={cn(
        'placeholder:text-muted-foreground flex h-[52px] w-full bg-transparent py-3.5 text-[17px] font-medium outline-none disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
    {trailing}
  </div>
));
CommandInput.displayName = CommandPrimitive.Input.displayName;

export const CommandList = forwardRef<
  ElementRef<typeof CommandPrimitive.List>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.List>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.List
    ref={ref}
    className={cn(
      // Cap height on desktop so the dialog stays a tidy box; let the list
      // claim the available height when the dialog fills the viewport.
      'max-h-[420px] min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-2 max-md:max-h-none',
      className,
    )}
    {...props}
  />
));
CommandList.displayName = CommandPrimitive.List.displayName;

export const CommandEmpty = forwardRef<
  ElementRef<typeof CommandPrimitive.Empty>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Empty>
>((props, ref) => (
  <CommandPrimitive.Empty ref={ref} className="py-6 text-center text-sm" {...props} />
));
CommandEmpty.displayName = CommandPrimitive.Empty.displayName;

export const CommandGroup = forwardRef<
  ElementRef<typeof CommandPrimitive.Group>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Group>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Group
    ref={ref}
    className={cn(
      'text-foreground [&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:font-display overflow-hidden [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[13px] [&_[cmdk-group-heading]]:font-semibold',
      className,
    )}
    {...props}
  />
));
CommandGroup.displayName = CommandPrimitive.Group.displayName;

export const CommandSeparator = forwardRef<
  ElementRef<typeof CommandPrimitive.Separator>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Separator
    ref={ref}
    className={cn('bg-muted -mx-1 my-1 h-0.5', className)}
    {...props}
  />
));
CommandSeparator.displayName = CommandPrimitive.Separator.displayName;

export const CommandItem = forwardRef<
  ElementRef<typeof CommandPrimitive.Item>,
  ComponentPropsWithoutRef<typeof CommandPrimitive.Item>
>(({ className, ...props }, ref) => (
  <CommandPrimitive.Item
    ref={ref}
    className={cn(
      "data-[selected='true']:bg-muted data-[selected='true']:text-foreground relative flex cursor-pointer select-none items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-sm font-semibold outline-none data-[disabled='true']:pointer-events-none data-[disabled='true']:opacity-50 data-[selected='true']:shadow-[inset_0_0_0_2px_var(--border-1)]",
      className,
    )}
    {...props}
  />
));
CommandItem.displayName = CommandPrimitive.Item.displayName;

export const CommandShortcut = ({ className, ...props }: HTMLAttributes<HTMLSpanElement>) => (
  <span
    className={cn('text-muted-foreground ml-auto text-xs tracking-widest', className)}
    {...props}
  />
);
CommandShortcut.displayName = 'CommandShortcut';
