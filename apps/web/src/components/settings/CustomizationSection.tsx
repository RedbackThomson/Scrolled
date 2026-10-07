import { useQueryClient } from '@tanstack/react-query';
import { SlidersHorizontal } from 'lucide-react';
import { useSettingsSection } from '@/components/settings/useSettingsSection';
import { SettingsCard, SettingsSection } from '@/components/settings/SettingsSection';
import { resetAllTooltips } from '@/components/entity-links/registry';
import { TooltipCustomizerPanel } from '@/components/settings/tooltips/TooltipCustomizerPanel';
import { MagicStatsPanel } from '@/components/settings/MagicStatsPanel';

export function CustomizationSection() {
  const sectionProps = useSettingsSection('customization');
  const qc = useQueryClient();

  const handleResetAll = () => {
    if (window.confirm('Reset every tooltip to its default fields?')) {
      void resetAllTooltips(qc);
    }
  };

  return (
    <SettingsSection {...sectionProps} icon={SlidersHorizontal} title="Customization">
      <SettingsCard>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-sm font-medium">Tooltips</div>
            <p className="text-muted-foreground mt-0.5 text-xs">
              Choose which fields appear in the hover preview for each type. Pick an entity to see a
              live preview, then set each field to always show, show only when it has a value, or
              never show.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetAll}
            className="text-muted-foreground hover:text-foreground shrink-0 text-xs"
          >
            Reset all tooltips
          </button>
        </div>
        <TooltipCustomizerPanel />
      </SettingsCard>
      <MagicStatsPanel />
    </SettingsSection>
  );
}
