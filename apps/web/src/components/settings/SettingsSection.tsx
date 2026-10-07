import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { Panel, SectionHeader } from '@scrolled/design';

interface SettingsSectionProps {
  /** Anchor id, so `/settings/<group>#<id>` lands on the section. */
  id: string;
  icon: LucideIcon;
  title: ReactNode;
  children: ReactNode;
}

/** One headed section of a settings group page. */
export function SettingsSection({ id, icon, title, children }: SettingsSectionProps) {
  return (
    <section id={id} className="scroll-mt-24 space-y-3">
      <SectionHeader icon={icon} title={title} />
      {children}
    </section>
  );
}

interface SettingsCardProps {
  children: ReactNode;
  /** Settings rows split by a rule, each with its own vertical padding. */
  rows?: boolean;
  /** Space between children when not `rows`, in px. */
  gap?: number;
}

/** The rimmed card holding a settings section's controls. */
export function SettingsCard({ children, rows, gap = 16 }: SettingsCardProps) {
  return rows ? (
    <Panel as="div" padding="0 20px" gap={0} className="divide-border divide-y text-sm [&>*]:py-4">
      {children}
    </Panel>
  ) : (
    <Panel as="div" padding={20} gap={gap}>
      {children}
    </Panel>
  );
}
