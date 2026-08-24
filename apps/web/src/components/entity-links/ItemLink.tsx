import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { HoverPopover } from '@scrolled/ui';
import { routeForEntity } from '@/lib/entityRoutes';
import { GenericHoverCard } from './GenericHoverCard';

interface ItemLinkProps {
  id: number;
  children: ReactNode;
  className?: string;
  noPreview?: boolean;
  /** Applied to the HoverPopover wrapper span — use this when the link needs
   *  to participate in a flex layout (e.g. `flex min-w-0 flex-1`). */
  triggerClassName?: string;
}

export function ItemLink({ id, children, className, noPreview, triggerClassName }: ItemLinkProps) {
  const link = (
    <Link to={routeForEntity('item', id)} className={className}>
      {children}
    </Link>
  );
  if (noPreview) return link;
  return (
    <HoverPopover content={<GenericHoverCard entity="item" id={id} />} triggerClassName={triggerClassName}>
      {link}
    </HoverPopover>
  );
}
