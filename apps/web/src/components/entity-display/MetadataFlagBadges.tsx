import { Badge } from '@scrolled/ui';
import {
  METADATA_FLAGS,
  type MetadataFlagKey,
} from '@/components/entity-display/metadataFlags';

/**
 * Renders the badges for whichever flags in `order` are true on `flags`.
 * `flags` is typically an `ItemRecord` or `EquipRecord` — extra fields are
 * ignored, missing flag keys read as falsy.
 */
export function MetadataFlagBadges({
  flags,
  order,
}: {
  flags: Partial<Record<MetadataFlagKey, boolean>>;
  order: readonly MetadataFlagKey[];
}) {
  return (
    <>
      {order
        .filter((key) => flags[key])
        .map((key) => (
          <Badge key={key} tone={METADATA_FLAGS[key].tone}>
            {METADATA_FLAGS[key].label}
          </Badge>
        ))}
    </>
  );
}
