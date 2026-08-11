import type { ReactNode } from 'react';
import { Badge, type BadgeTone } from '@scrolled/ui';
import { Coins, Package, ScrollText, TrendingUp } from 'lucide-react';
import type { Requirement } from '@scrolled/nav-graph';

import { itemUrl, questUrl } from '@/lib/scrolledLinks';

export interface RequirementChipProps {
  requirement: Requirement;
}

export function RequirementChip({ requirement }: RequirementChipProps) {
  switch (requirement.kind) {
    case 'meso':
      return (
        <Chip tone="amber" icon={<Coins className="h-3 w-3" aria-hidden />}>
          {requirement.amount.toLocaleString()} mesos
        </Chip>
      );
    case 'level':
      return (
        <Chip tone="blue" icon={<TrendingUp className="h-3 w-3" aria-hidden />}>
          Level {requirement.min}+
        </Chip>
      );
    case 'item': {
      const qty =
        requirement.quantity && requirement.quantity > 1 ? ` ×${requirement.quantity}` : '';
      const verb = requirement.consumed ? 'Use' : 'Have';
      const label = requirement.name ?? `item #${requirement.itemId}`;
      return (
        <Chip
          tone="emerald"
          icon={<Package className="h-3 w-3" aria-hidden />}
          href={itemUrl(requirement.itemId)}
        >
          {verb} {label}
          {qty}
        </Chip>
      );
    }
    case 'quest': {
      const label = requirement.name ?? `quest #${requirement.questId}`;
      return (
        <Chip
          tone="violet"
          icon={<ScrollText className="h-3 w-3" aria-hidden />}
          href={questUrl(requirement.questId)}
        >
          Complete {label}
        </Chip>
      );
    }
  }
}

interface ChipProps {
  tone: BadgeTone;
  icon: ReactNode;
  href?: string | null;
  children: ReactNode;
}

function Chip({ tone, icon, href, children }: ChipProps) {
  const body = (
    <Badge tone={tone} className="gap-1 text-[11px]">
      {icon}
      {children}
    </Badge>
  );
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" className="hover:opacity-80">
        {body}
      </a>
    );
  }
  return body;
}
