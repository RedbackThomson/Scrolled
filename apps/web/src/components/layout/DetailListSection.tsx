import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { ListCard, SectionHeader } from '@scrolled/design';

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
  icon,
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
    <section className="space-y-2">
      <SectionHeader icon={icon} title={title} count={count} action={action} />
      {isLoading && (
        <p className="text-muted-foreground text-[12.5px]">
          {loadingLabel ?? `Loading ${title.toLowerCase()}…`}
        </p>
      )}
      {!isLoading && isEmpty && <p className="text-muted-foreground text-[12.5px]">{emptyLabel}</p>}
      {!isLoading && !isEmpty && children !== undefined && children !== null && (
        <ListCard as="ul" divided>
          {children}
        </ListCard>
      )}
    </section>
  );
}
