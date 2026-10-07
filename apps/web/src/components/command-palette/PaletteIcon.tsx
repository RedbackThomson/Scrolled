import type { LucideIcon } from 'lucide-react';
import { SlotTile } from '@scrolled/design';
import { EntityAvatar } from '@/components/entity-display/EntityAvatar';
import type { EntityKind } from '@/db';

const SIZE = 30;

/** The leading tile on a palette row: a glyph on a tile, tinted when a hue is given. */
export function PaletteIcon({ icon, hue }: { icon: LucideIcon; hue?: number }) {
  return <SlotTile icon={icon} hue={hue} size={SIZE} />;
}

/** The leading tile on a palette row for an entity, showing its sprite. */
export function PaletteEntityIcon({
  entity,
  id,
  alt,
}: {
  entity: EntityKind;
  id: number;
  alt?: string;
}) {
  return <EntityAvatar entity={entity} id={id} size={SIZE} alt={alt} />;
}
