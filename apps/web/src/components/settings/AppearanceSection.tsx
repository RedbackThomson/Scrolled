import { Monitor, Moon, Palette, Sun, Wind } from 'lucide-react';
import { AccentPicker } from '@/components/common/AccentPicker';
import { useSettingsSection } from '@/components/settings/useSettingsSection';
import { SettingsCard, SettingsSection } from '@/components/settings/SettingsSection';
import { useShowEntityIds } from '@/stores/showEntityIds';
import { useHideMinorPortals } from '@/stores/hideMinorPortals';
import { useMotionPrefs } from '@/hooks/useMotionPrefs';
import { useMotion } from '@/stores/motion';
import { SectionHeader, Segmented, Switch, type ThemeMode, useTheme } from '@scrolled/design';

const THEMES = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] satisfies { value: ThemeMode; label: string; icon: typeof Sun }[];

const BACKDROPS = [
  { value: 'sky', label: 'Sky' },
  { value: 'clouds', label: 'Sky + clouds' },
];

export function AppearanceSection() {
  const sectionProps = useSettingsSection('appearance');
  const mode = useTheme((s) => s.mode);
  const setMode = useTheme((s) => s.setMode);
  const showIds = useShowEntityIds((s) => s.enabled);
  const setShowIds = useShowEntityIds((s) => s.setEnabled);
  const hideMinorPortals = useHideMinorPortals((s) => s.enabled);
  const setHideMinorPortals = useHideMinorPortals((s) => s.setEnabled);
  const motionPrefs = useMotionPrefs();
  const setBackdrop = useMotion((s) => s.setBackdrop);
  const setDrift = useMotion((s) => s.setDrift);
  const setMotion = useMotion((s) => s.setMotion);

  return (
    <SettingsSection {...sectionProps} icon={Palette} title="Appearance">
      <SettingsCard rows>
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
      </SettingsCard>
      <SectionHeader level={3} icon={Wind} title="Motion" className="pt-2" />
      <SettingsCard rows>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="font-bold">Backdrop</div>
            <p className="text-muted-foreground mt-0.5 text-[12.5px]">
              What sits behind every page.
            </p>
          </div>
          <Segmented
            options={BACKDROPS}
            value={motionPrefs.backdrop}
            onChange={(v) => setBackdrop(v === 'sky' ? 'sky' : 'clouds')}
          />
        </div>
        {motionPrefs.backdrop === 'clouds' && (
          <Switch
            label="Drifting clouds"
            description="Let the clouds float slowly across the sky."
            checked={motionPrefs.drift}
            onChange={setDrift}
          />
        )}
        <Switch
          label="Interface motion"
          description="Animate hovers, pop-ups, and pages as they appear."
          checked={motionPrefs.motion}
          onChange={setMotion}
        />
      </SettingsCard>
      <p className="text-muted-foreground px-1 text-[12.5px]">
        Both start off if your system is set to reduce motion.
      </p>
    </SettingsSection>
  );
}
