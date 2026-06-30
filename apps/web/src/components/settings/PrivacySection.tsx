import { useState } from 'react';
import { Shield } from 'lucide-react';
import { useSettingsSection } from '@/components/settings/SettingsScrollSpy';
import { isAnalyticsAvailable, isAnalyticsOptedOut, setAnalyticsOptOut } from '@/analytics';
import { cn } from '@scrolled/ui';

export function PrivacySection() {
  if (!isAnalyticsAvailable()) return null;
  return <PrivacySectionInner />;
}

function PrivacySectionInner() {
  const sectionProps = useSettingsSection('privacy');
  const [optedOut, setOptedOut] = useState(() => isAnalyticsOptedOut());
  const onToggle = (next: boolean) => {
    setAnalyticsOptOut(next);
    setOptedOut(next);
  };
  return (
    <section {...sectionProps} className="scroll-mt-20 space-y-3">
      <div className="flex items-center gap-2">
        <Shield className="h-4 w-4" />
        <h2 className="text-lg font-semibold">Privacy</h2>
      </div>
      <div className="border-border bg-card text-card-foreground rounded-md border p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Anonymous pageview analytics</div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              The hosted version of this app counts page visits via a third-party beacon. No
              identifiers, no event payloads, no game data — just which page was viewed. Disable to
              skip the beacon on this device. Reload to apply.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={!optedOut}
            onClick={() => onToggle(!optedOut)}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors',
              optedOut ? 'bg-muted' : 'bg-primary',
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                optedOut ? 'translate-x-0.5' : 'translate-x-4',
              )}
            />
          </button>
        </div>
      </div>
    </section>
  );
}
