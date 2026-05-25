import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

interface ListSectionHeaderProps {
  icon: LucideIcon;
  title: string;
  count?: number;
  action?: ReactNode;
}

export function ListSectionHeader({ icon: Icon, title, count, action }: ListSectionHeaderProps) {
  return (
    <div className="mb-2 flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide">
        <Icon className="h-4 w-4" /> {title}
        {count !== undefined && (
          <span className="text-muted-foreground text-xs normal-case">({count})</span>
        )}
      </h2>
      {action}
    </div>
  );
}
