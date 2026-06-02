import { Gamepad2 } from 'lucide-react';
import { useSettingsSection } from '@/components/settings/SettingsScrollSpy';
import { BUILTIN_PROFILES } from '@/serverProfiles';
import { useServerProfile, useSetServerProfile } from '@/hooks/useServerProfile';
import { cn } from '@/lib/utils';

export function ServerProfileSection() {
  const sectionProps = useSettingsSection('server');
  const sp = useServerProfile();
  const setM = useSetServerProfile();

  return (
    <section {...sectionProps} className="scroll-mt-20 space-y-3">
      <div className="flex items-center gap-2">
        <Gamepad2 className="h-4 w-4" />
        <h2 className="text-lg font-semibold">Server</h2>
      </div>
      <div className="border-border bg-card text-card-foreground space-y-4 rounded-md border p-4">
        <p className="text-muted-foreground text-xs">
          Tailor displayed calculations to your server. A profile sets the EXP rate and how dropped
          equipment stat ranges are estimated.
        </p>

        <div className="space-y-2">
          {BUILTIN_PROFILES.map((p) => {
            const active = p.id === sp.profile.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setM.mutate(p.id)}
                aria-pressed={active}
                className={cn(
                  'flex w-full flex-col items-start gap-0.5 rounded-md border px-3 py-2 text-left transition',
                  active ? 'border-primary bg-primary/5' : 'border-border hover:bg-accent/40',
                )}
              >
                <span className="flex w-full items-center gap-2 text-sm font-medium">
                  {p.name}
                  {p.version && (
                    <span className="text-muted-foreground font-mono text-[10px] font-normal">
                      {p.version}
                    </span>
                  )}
                  {active && <span className="text-primary ml-auto text-xs">Active</span>}
                </span>
                {p.description && (
                  <span className="text-muted-foreground text-xs">{p.description}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
