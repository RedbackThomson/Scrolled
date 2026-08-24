import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { HoverPopover } from '@scrolled/ui';
import { routeForEntity } from '@/lib/entityRoutes';
import { GenericHoverCard } from './GenericHoverCard';

interface MobLinkProps {
  id: number;
  children: ReactNode;
  className?: string;
  noPreview?: boolean;
  triggerClassName?: string;
}

export function MobLink({ id, children, className, noPreview, triggerClassName }: MobLinkProps) {
  const link = (
    <Link to={routeForEntity('mob', id)} className={className}>
      {children}
    </Link>
  );
  if (noPreview) return link;
  return (
    <HoverPopover content={<GenericHoverCard entity="mob" id={id} />} triggerClassName={triggerClassName}>
      {link}
    </HoverPopover>
  );
}

export function MobHoverCard({ id }: { id: number }) {
  return <GenericHoverCard entity="mob" id={id} />;
}
