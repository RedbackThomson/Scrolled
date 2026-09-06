import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { minMagicToOneShot } from '@scrolled/game-db/domain/magicDamage';
import type { MobRecord } from '@/db';
import { InfoSection } from '@/components/layout/DetailPageLayout';
import { useMagicLoadout } from '@/components/settings/useMagicLoadout';

const MAGIC_HELP =
  'The smallest magic attack that defeats this monster in a single hit, from the ' +
  'weapon, spell and stats you set in Customization. Click to change them.';

const RATIO_HELP = 'Experience per point of HP (EXP ÷ HP) — a rough training-efficiency measure.';

export function MobCalculatedSection({ mob }: { mob: MobRecord }) {
  const { loadout, loading, configured, missingBasePower } = useMagicLoadout();

  // Bosses aren't one-shot targets, so the magic calc isn't meaningful for them.
  const showMagic = configured && !mob.isBoss;
  const ratio = mob.exp !== null && mob.hp !== null && mob.hp > 0 ? mob.exp / mob.hp : null;

  if (!showMagic && ratio === null) return null;

  const required = showMagic && loadout ? minMagicToOneShot(mob, loadout) : null;
  const magicValue = loading
    ? '…'
    : missingBasePower || required === null
      ? '—'
      : required.toLocaleString();

  return (
    <InfoSection title="Calculated">
      {ratio !== null && (
        <CalcRow
          label="EXP / HP"
          help={RATIO_HELP}
          value={ratio.toLocaleString(undefined, { maximumFractionDigits: 3 })}
        />
      )}
      {showMagic && (
        <CalcRow
          label="Req. Magic 1-Hit"
          help={MAGIC_HELP}
          helpTo="/settings#customization"
          value={magicValue}
        />
      )}
    </InfoSection>
  );
}

function CalcRow({
  label,
  value,
  help,
  helpTo,
}: {
  label: string;
  value: ReactNode;
  help?: string;
  helpTo?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <dt className="text-muted-foreground flex items-center gap-1 text-xs uppercase tracking-wide">
        {label}
        {help &&
          (helpTo ? (
            <Link
              to={helpTo}
              title={help}
              aria-label={help}
              className="hover:text-foreground inline-flex"
            >
              <HelpCircle className="h-3 w-3" />
            </Link>
          ) : (
            <span title={help} aria-label={help} className="inline-flex cursor-help">
              <HelpCircle className="h-3 w-3" />
            </span>
          ))}
      </dt>
      <dd className="text-sm tabular-nums">{value}</dd>
    </div>
  );
}
