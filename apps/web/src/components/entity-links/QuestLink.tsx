import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { HoverPopover } from '@scrolled/design';
import { routeForEntity } from '@/lib/entityRoutes';
import { GenericHoverCard } from './GenericHoverCard';

interface QuestLinkProps {
  id: number;
  children: ReactNode;
  className?: string;
  noPreview?: boolean;
  triggerClassName?: string;
}

export function QuestLink({
  id,
  children,
  className,
  noPreview,
  triggerClassName,
}: QuestLinkProps) {
  const link = (
    <Link to={routeForEntity('quest', id)} className={className}>
      {children}
    </Link>
  );
  if (noPreview) return link;
  return (
    <HoverPopover bare content={<GenericHoverCard entity="quest" id={id} />} triggerClassName={triggerClassName}>
      {link}
    </HoverPopover>
  );
}
