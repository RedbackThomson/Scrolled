import { Gamepad2 } from 'lucide-react';
import { useSettingsSection } from '@/components/settings/useSettingsSection';
import { SettingsCard, SettingsSection } from '@/components/settings/SettingsSection';
import { BUILTIN_PROFILES } from '@scrolled/game-db/serverProfiles';
import { useServerProfile, useSetServerProfile } from '@/hooks/useServerProfile';
import { cn } from '@scrolled/design';

export function ServerProfileSection() {
  const sectionProps = useSettingsSection('server');
  const sp = useServerProfile();
  const setM = useSetServerProfile();

  return (
    <SettingsSection {...sectionProps} icon={Gamepad2} title="Server">
      <SettingsCard>
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
      </SettingsCard>
    </SettingsSection>
  );
}
