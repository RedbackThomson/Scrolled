import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Breadcrumb, SlotTile } from '@scrolled/design';
import { getSettingsGroups, isSettingsGroupId } from '@/components/settings/settingsGroups';
import { SETTINGS_SECTIONS } from '@/components/settings/settingsSections';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function SettingsGroup() {
  const { group: groupId } = useParams<{ group: string }>();
  const group = isSettingsGroupId(groupId)
    ? getSettingsGroups().find((g) => g.id === groupId)
    : undefined;
  const location = useLocation();
  const navigate = useNavigate();
  usePageTitle(group ? `${group.label} settings` : 'Settings');

  // Sections render on mount, so a `#section` link can be honoured right away.
  useEffect(() => {
    const id = location.hash.slice(1);
    if (id) document.getElementById(id)?.scrollIntoView({ block: 'start' });
  }, [location.hash, groupId]);

  if (!group) return <Navigate to="/settings" replace />;

  return (
    <div className="space-y-8">
      <header className="space-y-4">
        <Breadcrumb
          items={[
            { label: 'Settings', onClick: () => navigate('/settings') },
            { label: group.label },
          ]}
        />
        <div className="flex items-center gap-4">
          <SlotTile icon={group.icon} hue={group.hue} size={52} />
          <div>
            <h1 className="font-display text-2xl font-semibold leading-none md:text-4xl">
              {group.label}
            </h1>
            <p className="text-muted-foreground mt-2 text-sm">{group.description}</p>
          </div>
        </div>
      </header>

      {group.sections.map((section) => {
        const Section = SETTINGS_SECTIONS[section.id];
        return Section ? <Section key={section.id} /> : null;
      })}
    </div>
  );
}
