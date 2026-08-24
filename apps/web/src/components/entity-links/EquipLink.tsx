import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { HoverPopover } from '@scrolled/ui';
import { routeForEntity } from '@/lib/entityRoutes';
import { GenericHoverCard } from './GenericHoverCard';

interface EquipLinkProps {
  id: number;
  children: ReactNode;
  className?: string;
  noPreview?: boolean;
  triggerClassName?: string;
}

export function EquipLink({
  id,
  children,
  className,
  noPreview,
  triggerClassName,
}: EquipLinkProps) {
  const link = (
    <Link to={routeForEntity('equip', id)} className={className}>
      {children}
    </Link>
  );
  if (noPreview) return link;
  return (
    <HoverPopover content={<GenericHoverCard entity="equip" id={id} />} triggerClassName={triggerClassName}>
      {link}
    </HoverPopover>
  );
}
