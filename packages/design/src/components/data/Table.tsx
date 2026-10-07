import {
  forwardRef,
  type HTMLAttributes,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from 'react';
import { cn } from '../../lib/cn';

export const Table = forwardRef<HTMLTableElement, HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="border-border bg-card text-card-foreground shadow-rim w-full overflow-x-auto rounded-lg border-2">
      {/* `min-w-[640px]` forces the table to overflow on narrow viewports so
       *  the wrapper's `overflow-x-auto` actually has content to scroll. On
       *  desktop the container is wider than this, so the table sizes
       *  naturally and the min-width is inert. */}
      <table
        ref={ref}
        className={cn('w-full min-w-[640px] caption-bottom text-[13.5px]', className)}
        {...props}
      />
    </div>
  ),
);
Table.displayName = 'Table';

export const TableHeader = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('bg-muted [&_tr]:hover:bg-transparent', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

export const TableBody = forwardRef<
  HTMLTableSectionElement,
  HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr]:border-muted [&_tr]:border-t-[1.5px]', className)}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

export const TableRow = forwardRef<HTMLTableRowElement, HTMLAttributes<HTMLTableRowElement>>(
  ({ className, ...props }, ref) => (
    <tr ref={ref} className={cn('hover:bg-muted transition-colors', className)} {...props} />
  ),
);
TableRow.displayName = 'TableRow';

export const TableHead = forwardRef<HTMLTableCellElement, ThHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <th
      ref={ref}
      className={cn(
        'text-muted-foreground h-9 px-3.5 text-left align-middle text-[11.5px] font-bold uppercase tracking-[.04em]',
        className,
      )}
      {...props}
    />
  ),
);
TableHead.displayName = 'TableHead';

export const TableCell = forwardRef<HTMLTableCellElement, TdHTMLAttributes<HTMLTableCellElement>>(
  ({ className, ...props }, ref) => (
    <td ref={ref} className={cn('h-[46px] px-3.5 py-[5px] align-middle', className)} {...props} />
  ),
);
TableCell.displayName = 'TableCell';
