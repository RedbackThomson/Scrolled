import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { HoverPopover } from '@scrolled/ui';
import { routeForEntity } from '@/lib/entityRoutes';
import { GenericHoverCard } from './GenericHoverCard';

interface NpcLinkProps {
  id: number;
  children: ReactNode;
  className?: string;
  /** Opt out of the hover preview (e.g. when the row already conveys
   *  the same info). */
  noPreview?: boolean;
  triggerClassName?: string;
}

export function NpcLink({ id, children, className, noPreview, triggerClassName }: NpcLinkProps) {
  const link = (
    <Link to={routeForEntity('npc', id)} className={className}>
      {children}
    </Link>
  );
  if (noPreview) return link;
  return (
    <HoverPopover content={<GenericHoverCard entity="npc" id={id} />} triggerClassName={triggerClassName}>
      {link}
    </HoverPopover>
  );
}

export function NpcHoverCard({ id }: { id: number }) {
  return <GenericHoverCard entity="npc" id={id} />;
}
