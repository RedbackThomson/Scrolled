import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { HoverPopover } from '@scrolled/design';
import { routeForEntity } from '@/lib/entityRoutes';
import { GenericHoverCard } from './GenericHoverCard';

interface QuestChainLinkProps {
  id: number;
  children: ReactNode;
  className?: string;
  noPreview?: boolean;
  triggerClassName?: string;
}

export function QuestChainLink({
  id,
  children,
  className,
  noPreview,
  triggerClassName,
}: QuestChainLinkProps) {
  const link = (
    <Link to={routeForEntity('questChain', id)} className={className}>
      {children}
    </Link>
  );
  if (noPreview) return link;
  return (
    <HoverPopover
      bare
      content={<GenericHoverCard entity="questChain" id={id} />}
      triggerClassName={triggerClassName}
    >
      {link}
    </HoverPopover>
  );
}
