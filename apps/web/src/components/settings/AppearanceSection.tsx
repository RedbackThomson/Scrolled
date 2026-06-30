import { Moon, Sun } from 'lucide-react';
import { AccentPicker } from '@/components/common/AccentPicker';
import { useSettingsSection } from '@/components/settings/SettingsScrollSpy';
import { useShowEntityIds } from '@/stores/showEntityIds';
import { useHideMinorPortals } from '@/stores/hideMinorPortals';
import { useTheme } from '@scrolled/ui';
import { cn } from '@scrolled/ui';

export function AppearanceSection() {
  const sectionProps = useSettingsSection('appearance');
  const theme = useTheme((s) => s.theme);
  const setTheme = useTheme((s) => s.set);
  const showIds = useShowEntityIds((s) => s.enabled);
  const setShowIds = useShowEntityIds((s) => s.setEnabled);
  const hideMinorPortals = useHideMinorPortals((s) => s.enabled);
  const setHideMinorPortals = useHideMinorPortals((s) => s.setEnabled);

  return (
    <section {...sectionProps} className="scroll-mt-20 space-y-3">
      <div className="flex items-center gap-2">
        {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
        <h2 className="text-lg font-semibold">Appearance</h2>
      </div>
      <div className="border-border bg-card text-card-foreground space-y-4 rounded-md border p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Theme</div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Choose how the app looks. Defaults to your system preference on first load.
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs">
            {(['light', 'dark'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTheme(t)}
                className={
                  theme === t
                    ? 'bg-primary text-primary-foreground rounded px-2.5 py-1.5 capitalize'
                    : 'text-muted-foreground hover:text-foreground rounded px-2.5 py-1.5 capitalize'
                }
              >
                {t}
              </button>
            ))}
          </div>
        </div>
        <div className="border-border flex items-center justify-between gap-3 border-t pt-4">
          <div>
            <div className="text-sm font-medium">Accent</div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              The highlight color for buttons, links, and selections.
            </p>
          </div>
          <AccentPicker />
        </div>
        <div className="border-border flex items-start justify-between gap-3 border-t pt-4">
          <div>
            <div className="text-sm font-medium">Show entity IDs</div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Show the numeric ID next to entity names in detail pages, hover previews, lists, and
              search results.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={showIds}
            onClick={() => setShowIds(!showIds)}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors',
              showIds ? 'bg-primary' : 'bg-muted',
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                showIds ? 'translate-x-4' : 'translate-x-0.5',
              )}
            />
          </button>
        </div>
        <div className="border-border flex items-start justify-between gap-3 border-t pt-4">
          <div>
            <div className="text-sm font-medium">Hide minor portals</div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Trim a map's Portals list to the ones you can travel through. Hides spawn points,
              staff-only portals, and dead-end teleports.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={hideMinorPortals}
            onClick={() => setHideMinorPortals(!hideMinorPortals)}
            className={cn(
              'relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors',
              hideMinorPortals ? 'bg-primary' : 'bg-muted',
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform',
                hideMinorPortals ? 'translate-x-4' : 'translate-x-0.5',
              )}
            />
          </button>
        </div>
      </div>
    </section>
  );
}
