import { Monitor, Moon, Palette, Sun } from 'lucide-react';
import { AccentPicker } from '@/components/common/AccentPicker';
import { useSettingsSection } from '@/components/settings/useSettingsSection';
import { useShowEntityIds } from '@/stores/showEntityIds';
import { useHideMinorPortals } from '@/stores/hideMinorPortals';
import { Segmented, Switch, useTheme, type ThemeMode } from '@scrolled/design';

const THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] satisfies { value: ThemeMode; label: string; icon: typeof Sun }[];

export function AppearanceSection() {
  const sectionProps = useSettingsSection('appearance');
  const mode = useTheme((s) => s.mode);
  const setMode = useTheme((s) => s.setMode);
  const showIds = useShowEntityIds((s) => s.enabled);
  const setShowIds = useShowEntityIds((s) => s.setEnabled);
  const hideMinorPortals = useHideMinorPortals((s) => s.enabled);
  const setHideMinorPortals = useHideMinorPortals((s) => s.setEnabled);

  return (
    <section {...sectionProps} className="scroll-mt-24 space-y-3">
      <div className="text-muted-foreground flex items-center gap-2">
        <Palette className="h-4 w-4" />
        <h2 className="font-display text-foreground text-[17px] font-semibold">Appearance</h2>
      </div>
      <div className="border-border bg-card text-card-foreground shadow-rim divide-border divide-y rounded-xl border-2 px-5 text-sm [&>*]:py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-bold">Theme</div>
            <p className="text-muted-foreground mt-0.5 text-[12.5px]">
              Choose how the app looks. System follows your device's setting.
            </p>
          </div>
          <Segmented
            options={THEMES}
            value={mode}
            onChange={(v) => setMode(THEMES.find((t) => t.value === v)?.value ?? 'system')}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-bold">Accent</div>
            <p className="text-muted-foreground mt-0.5 text-[12.5px]">
              The highlight color for buttons, links, and selections.
            </p>
          </div>
          <AccentPicker />
        </div>
        <Switch
          label="Show entity IDs"
          description="Show the numeric ID next to entity names in detail pages, hover previews, lists, and search results."
          checked={showIds}
          onChange={setShowIds}
        />
        <Switch
          label="Hide minor portals"
          description="Trim a map's Portals list to the ones you can travel through. Hides spawn points, staff-only portals, and dead-end teleports."
          checked={hideMinorPortals}
          onChange={setHideMinorPortals}
        />
      </div>
    </section>
  );
}
