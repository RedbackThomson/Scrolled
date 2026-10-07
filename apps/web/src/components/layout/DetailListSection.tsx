import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface DetailListSectionProps {
  icon: LucideIcon;
  title: string;
  count?: number;
  action?: ReactNode;
  isLoading?: boolean;
  isEmpty?: boolean;
  emptyLabel?: string;
  loadingLabel?: string;
  children?: ReactNode;
}

export function DetailListSection({
  icon: Icon,
  title,
  count,
  action,
  isLoading,
  isEmpty,
  emptyLabel = 'None.',
  loadingLabel,
  children,
}: DetailListSectionProps) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="font-display flex items-center gap-2 text-[17px] font-semibold">
          <Icon className="h-[18px] w-[18px]" /> {title}
          {count !== undefined && (
            <span className="bg-muted text-muted-foreground rounded-full px-2 py-px font-sans text-xs font-medium">
              {count}
            </span>
          )}
        </h2>
        {action}
      </div>
      {isLoading && (
        <p className="text-muted-foreground text-[12.5px]">
          {loadingLabel ?? `Loading ${title.toLowerCase()}…`}
        </p>
      )}
      {!isLoading && isEmpty && <p className="text-muted-foreground text-[12.5px]">{emptyLabel}</p>}
      {!isLoading && !isEmpty && children !== undefined && children !== null && (
        <ul className="border-border bg-card text-card-foreground shadow-rim divide-muted divide-y-[1.5px] overflow-hidden rounded-lg border-2">
          {children}
        </ul>
      )}
    </section>
  );
}
