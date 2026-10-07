import type { ReactNode } from 'react';
import { Chip } from '@scrolled/design';
import { Coins, Package, ScrollText, TrendingUp, type LucideIcon } from 'lucide-react';
import type { Requirement } from '@scrolled/nav-graph';

import { itemUrl, questUrl } from '@/lib/scrolledLinks';

export interface RequirementChipProps {
  requirement: Requirement;
}

export function RequirementChip({ requirement }: RequirementChipProps) {
  switch (requirement.kind) {
    case 'meso':
      return <GoldChip icon={Coins}>{requirement.amount.toLocaleString()} mesos</GoldChip>;
    case 'level':
      return <GoldChip icon={TrendingUp}>Level {requirement.min}+</GoldChip>;
    case 'item': {
      const qty =
        requirement.quantity && requirement.quantity > 1 ? ` ×${requirement.quantity}` : '';
      const verb = requirement.consumed ? 'Use' : 'Have';
      const label = requirement.name ?? `item #${requirement.itemId}`;
      return (
        <GoldChip icon={Package} href={itemUrl(requirement.itemId)}>
          {verb} {label}
          {qty}
        </GoldChip>
      );
    }
    case 'quest': {
      const label = requirement.name ?? `quest #${requirement.questId}`;
      return (
        <GoldChip icon={ScrollText} href={questUrl(requirement.questId)}>
          Complete {label}
        </GoldChip>
      );
    }
  }
}

interface GoldChipProps {
  icon: LucideIcon;
  href?: string | null;
  children: ReactNode;
}

function GoldChip({ icon, href, children }: GoldChipProps) {
  const body = (
    <Chip tone="gold" icon={icon}>
      {children}
    </Chip>
  );
  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className="focus-visible:ring-primary/30 rounded-full transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-4"
      >
        {body}
      </a>
    );
  }
  return body;
}
