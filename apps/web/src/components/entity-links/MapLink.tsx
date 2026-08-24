import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { HoverPopover } from '@scrolled/ui';
import { routeForEntity } from '@/lib/entityRoutes';
import { GenericHoverCard } from './GenericHoverCard';

interface MapLinkProps {
  id: number;
  children: ReactNode;
  className?: string;
  noPreview?: boolean;
  triggerClassName?: string;
}

export function MapLink({ id, children, className, noPreview, triggerClassName }: MapLinkProps) {
  const link = (
    <Link to={routeForEntity('map', id)} className={className}>
      {children}
    </Link>
  );
  if (noPreview) return link;
  return (
    <HoverPopover content={<GenericHoverCard entity="map" id={id} />} triggerClassName={triggerClassName}>
      {link}
    </HoverPopover>
  );
}

export function MapHoverCard({ id }: { id: number }) {
  return <GenericHoverCard entity="map" id={id} />;
}
