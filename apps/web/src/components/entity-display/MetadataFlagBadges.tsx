import { Chip } from '@scrolled/design';
import {
  METADATA_FLAGS,
  type MetadataFlagKey,
} from '@/components/entity-display/metadataFlags';

/**
 * Renders the chips for whichever flags in `order` are true on `flags`.
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
          <Chip key={key} {...METADATA_FLAGS[key].chip}>
            {METADATA_FLAGS[key].label}
          </Chip>
        ))}
    </>
  );
}

// Any of these means the item can't move freely between characters.
const TRADE_RESTRICTIONS: readonly MetadataFlagKey[] = [
  'tradeBlock',
  'equipTradeBlock',
  'accountSharable',
];

/**
 * The affirmative counterparts to the restriction chips: "In-game" when it
 * isn't a cash item, "Tradeable" when nothing restricts trading.
 */
export function AvailabilityChips({ flags }: { flags: Partial<Record<MetadataFlagKey, boolean>> }) {
  return (
    <>
      {!flags.cash && <Chip>In-game</Chip>}
      {!TRADE_RESTRICTIONS.some((key) => flags[key]) && <Chip tone="ok">Tradeable</Chip>}
    </>
  );
}
