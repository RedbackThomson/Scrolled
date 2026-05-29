import { HoverPopover } from '@/components/common/HoverPopover';
import { useServerProfile } from '@/hooks/useServerProfile';

/**
 * Renders an EXP value adjusted by the active server profile's EXP rate. Pass
 * the canonical (base) EXP from the WZ data; the multiplier is applied at
 * render time so every EXP display stays in sync with the selected profile.
 *
 * When the profile applies a non-1 rate, the shown value is the multiplied
 * one and hovering/focusing it reveals the base value and where the multiplier
 * comes from — so the adjustment is discoverable without cluttering the number.
 */
export function ExpValue({ exp }: { exp: number | null }) {
  const { applyExp, expRate, profile } = useServerProfile();
  if (exp === null) return <>—</>;
  const adjusted = applyExp(exp) ?? exp;

  // No multiplier in play — the displayed value is the real value, nothing to
  // disambiguate.
  if (expRate === 1) return <>{adjusted.toLocaleString()}</>;

  return (
    <HoverPopover
      // The EXP value most often sits in a right-side infobox aside, so the
      // tooltip is right-edge-anchored (extending leftward) to keep it on screen.
      align="end"
      triggerClassName="decoration-muted-foreground/40 cursor-help underline decoration-dotted underline-offset-2"
      triggerProps={{ tabIndex: '0' }}
      content={
        <div className="whitespace-nowrap text-xs">
          <div className="font-medium">{exp.toLocaleString()} base EXP</div>
          <div className="text-muted-foreground mt-0.5">
            {profile.name} profile · {expRate}× server rate
          </div>
        </div>
      }
    >
      {adjusted.toLocaleString()}
    </HoverPopover>
  );
}
