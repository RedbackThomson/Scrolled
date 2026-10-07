// Mirrors the --hue-* tokens in colors.css for components that build oklch()
// colours in JS (SlotTile, Chip). Keep the two in sync.
export const ENTITY_HUES = {
  item: 70,
  equip: 235,
  mob: 20,
  npc: 150,
  map: 185,
  quest: 295,
  skill: 260,
  collection: 235,
} as const;

export type EntityHueKey = keyof typeof ENTITY_HUES;
