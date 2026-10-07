import { createContext, type MouseEvent, type ReactNode } from 'react';

export interface ListCardStat {
  label: string;
  value: ReactNode;
  /** `attack` tints the headline offensive stat, as the redesign's cards do. */
  tone?: 'attack';
}

export interface ListCardLayout {
  /** compact = the mobile row; tall = the desktop card grid. */
  variant: 'compact' | 'tall';
  selected?: boolean;
  /** Rows are being picked on a phone: unselected pictures show their outline */
  selecting?: boolean;
  /** Set when rows can be selected: the card's picture becomes its checkbox */
  onToggleSelect?: (event: MouseEvent<HTMLButtonElement>) => void;
  /** Stats from columns the user turned on beyond the entity's defaults. */
  extraStats?: readonly ListCardStat[];
}

/** Lets one card body per entity render both layouts, set by whichever list hosts it. */
export const ListCardLayoutContext = createContext<ListCardLayout>({ variant: 'compact' });
