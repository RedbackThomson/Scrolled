import { Coins, Crown, Flame, Layers, PartyPopper, Sparkles, type LucideIcon } from 'lucide-react';

export const SAMPLE_PRESETS: [LucideIcon, string, number, number][] = [
  [Sparkles, 'Starter weapons', 38, 148],
  [Flame, 'Highest ATK', 24, 22],
  [Layers, '7+ upgrade slots', 212, 235],
  [PartyPopper, 'Event & seasonal', 57, 300],
  [Coins, 'Sold by NPCs', 41, 75],
  [Crown, 'Boss drops', 19, 60],
];

/** A 14-bin level distribution peaking in the 30s–40s */
export const SAMPLE_LEVEL_BINS = [3, 5, 9, 14, 22, 36, 54, 66, 48, 33, 24, 18, 12, 6];
