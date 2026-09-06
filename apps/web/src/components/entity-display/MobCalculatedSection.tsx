import { Link } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { minMagicToOneShot } from '@scrolled/game-db/domain/magicDamage';
import type { MobRecord } from '@/db';
import { InfoSection } from '@/components/layout/DetailPageLayout';
import { useMagicLoadout } from '@/components/settings/useMagicLoadout';

const HELP =
  'The smallest magic attack that defeats this monster in a single hit, from the ' +
  'weapon, spell and stats you set in Customization. Click to change them.';

export function MobCalculatedSection({ mob }: { mob: MobRecord }) {
  const { loadout, loading, configured, missingBasePower } = useMagicLoadout();

  // Bosses aren't one-shot targets — the calculation isn't meaningful for them.
  if (mob.isBoss || !configured) return null;

  const required = loadout ? minMagicToOneShot(mob, loadout) : null;
  const display = loading
    ? '…'
    : missingBasePower || required === null
      ? '—'
      : required.toLocaleString();

  return (
    <InfoSection title="Calculated">
      <div className="flex items-baseline justify-between gap-3 py-1.5">
        <dt className="text-muted-foreground flex items-center gap-1 text-xs uppercase tracking-wide">
          Req. Magic 1-Hit
          <Link
            to="/settings#customization"
            title={HELP}
            aria-label="About this calculation — open Customization settings"
            className="hover:text-foreground inline-flex"
          >
            <HelpCircle className="h-3 w-3" />
          </Link>
        </dt>
        <dd className="text-sm tabular-nums">{display}</dd>
      </div>
    </InfoSection>
  );
}
