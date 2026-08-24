import { type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { HoverPopover } from '@scrolled/ui';
import { routeForEntity } from '@/lib/entityRoutes';
import { GenericHoverCard } from './GenericHoverCard';

interface SkillLinkProps {
  id: number;
  children: ReactNode;
  className?: string;
  noPreview?: boolean;
  triggerClassName?: string;
}

export function SkillLink({
  id,
  children,
  className,
  noPreview,
  triggerClassName,
}: SkillLinkProps) {
  const link = (
    <Link to={routeForEntity('skill', id)} className={className}>
      {children}
    </Link>
  );
  if (noPreview) return link;
  return (
    <HoverPopover content={<GenericHoverCard entity="skill" id={id} />} triggerClassName={triggerClassName}>
      {link}
    </HoverPopover>
  );
}

export function SkillHoverCard({ id }: { id: number }) {
  return <GenericHoverCard entity="skill" id={id} />;
}
