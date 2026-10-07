import { Check } from 'lucide-react';
import { ConfettiBurst, Scrolly } from '@scrolled/design';

/** Cheering mascot with a check badge and a one-time diamond burst, for finished setup steps. */
export function SetupCelebration() {
  return (
    <div className="relative shrink-0">
      <Scrolly pose="cheer" size={64} />
      <span
        aria-hidden
        className="text-primary-foreground animate-pop absolute -bottom-1 -right-1 grid h-6 w-6 place-items-center rounded-full bg-[image:var(--gradient-accent)] shadow-[0_0_0_3px_var(--surface-card)]"
        style={{ animationDelay: '250ms' }}
      >
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
      <ConfettiBurst trigger={1} count={12} radius={70} shapes="diamonds" durationMs={900} />
    </div>
  );
}
