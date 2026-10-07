export interface SampleWeapon {
  id: string;
  name: string;
  atk: number;
  slots: number;
}

export const SAMPLE_WEAPONS: SampleWeapon[] = (
  [
    ['Bronze Sword', 17, 7],
    ['Worn Blade', 10, 0],
    ['Parasol Saber', 15, 7],
    ['Squeaky Mallet', 1, 7],
    ['Rolled Paper Sword', 19, 7],
    ['Festival Banner', 1, 7],
    ['Harvest Basket', 1, 7],
    ['Starlit Pennant', 30, 7],
  ] as const
).map(([name, atk, slots]) => ({ id: name, name, atk, slots }));
