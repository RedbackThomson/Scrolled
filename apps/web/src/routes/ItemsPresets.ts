import { Armchair, Droplet, Heart, ScrollText } from 'lucide-react';
import type { ListPreset } from '@/components/data-table/presets';

export const presets: readonly ListPreset[] = [
  {
    id: 'hp-potions',
    label: 'HP potions',
    icon: Heart,
    hue: 22,
    filters: { recoveryHp: { kind: 'range', min: 1 } },
  },
  {
    id: 'mp-potions',
    label: 'MP potions',
    icon: Droplet,
    hue: 255,
    filters: { recoveryMp: { kind: 'range', min: 1 } },
  },
  {
    id: 'chairs',
    label: 'Chairs',
    icon: Armchair,
    hue: 70,
    filters: { chair: { kind: 'range', min: 1, max: 1 } },
  },
  {
    id: 'quest-items',
    label: 'Quest items',
    icon: ScrollText,
    hue: 295,
    filters: { quest: { kind: 'range', min: 1, max: 1 } },
  },
];
