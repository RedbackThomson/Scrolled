import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, RefreshCw, Search } from 'lucide-react';
import { Banner, Button, Chip, SlotTile, useTheme, type ThemeMode } from '@scrolled/design';
import {
  getSettingsGroups,
  searchSettings,
  type SettingsGroupId,
} from '@/components/settings/settingsGroups';
import { useDatasetUpdate } from '@/hooks/dataset/useDatasetUpdate';
import { usePageTitle } from '@/hooks/usePageTitle';
import { ACCENTS } from '@/lib/accents';
import { useAccent } from '@/stores/accent';
import { appConfig } from '@/config';

export default function SettingsIndex() {
  usePageTitle('Settings');
  const groups = getSettingsGroups();
  const dataset = useDatasetUpdate();
  const [query, setQuery] = useState('');
  const searching = query.trim() !== '';
  const hits = searchSettings(query);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold leading-none md:text-4xl">Settings</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {appConfig.features.enableUserImport
              ? 'Manage your library, appearance, and server preferences.'
              : 'Manage your appearance and preferences.'}
          </p>
        </div>
        <label className="border-border bg-card text-muted-foreground shadow-float focus-within:ring-primary/30 inline-flex h-10 w-full items-center gap-2 rounded-full border-2 px-4 text-sm font-semibold focus-within:ring-4 sm:w-64">
          <Search className="h-4 w-4 shrink-0" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a setting…"
            aria-label="Find a setting"
            className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
      </header>

      {dataset.mode === 'offer' && (
        <Banner
          tone="warn"
          icon={RefreshCw}
          title="A data update is available"
          body={`Version ${dataset.latestVersion} is ready to install. You're on ${dataset.installedVersion}.`}
          action={
            <Button size="sm" onClick={dataset.apply} disabled={dataset.applying}>
              {dataset.applying ? 'Updating…' : 'Update'}
            </Button>
          }
        />
      )}

      {searching ? (
        hits.length > 0 ? (
          <ul className="border-border bg-card shadow-rim divide-border divide-y overflow-hidden rounded-[20px] border-2">
            {hits.map(({ group, section }) => (
              <li key={section.id}>
                <Link
                  to={`/settings/${group.id}#${section.id}`}
                  className="hover:bg-muted focus-visible:bg-muted flex items-center gap-3 px-4 py-3 transition-colors focus-visible:outline-none"
                >
                  <SlotTile icon={group.icon} hue={group.hue} size={32} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-bold">{section.label}</span>
                    <span className="text-muted-foreground block text-[12.5px]">{group.label}</span>
                  </span>
                  <ChevronRight className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground py-6 text-center text-sm">
            No settings match “{query.trim()}”.
          </p>
        )
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {groups.map((g) => (
            <li key={g.id}>
              <Link
                to={`/settings/${g.id}`}
                className="border-border bg-card shadow-rim ease-spring hover:border-primary/40 focus-visible:ring-primary/30 group flex h-full flex-col gap-4 rounded-[20px] border-2 p-5 transition-[transform,border-color] duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4"
              >
                <div className="flex items-center gap-3.5">
                  <SlotTile icon={g.icon} hue={g.hue} size={48} />
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-[19px] font-semibold leading-tight">
                      {g.label}
                    </h2>
                    <p className="text-muted-foreground mt-0.5 text-[13px]">{g.description}</p>
                  </div>
                  <ChevronRight
                    className="text-muted-foreground group-hover:text-foreground h-5 w-5 shrink-0 transition-colors"
                    aria-hidden
                  />
                </div>
                <ul className="text-muted-foreground flex flex-wrap gap-x-2 gap-y-1 text-[13px] font-semibold">
                  {g.sections.map((section, i) => (
                    <li key={section.id}>
                      {i > 0 && (
                        <span aria-hidden className="mr-2">
                          ·
                        </span>
                      )}
                      {section.label}
                    </li>
                  ))}
                </ul>
                <GroupSummary id={g.id} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const THEME_LABELS: Record<ThemeMode, string> = {
  light: 'Light theme',
  dark: 'Dark theme',
  system: 'System theme',
};

function GroupSummary({ id }: { id: SettingsGroupId }) {
  const mode = useTheme((s) => s.mode);
  const accent = useAccent((s) => s.accent);
  if (id !== 'look') return null;
  const accentLabel = ACCENTS.find((a) => a.name === accent)?.label;
  return (
    <div className="mt-auto flex flex-wrap gap-1.5">
      <Chip>{THEME_LABELS[mode]}</Chip>
      {accentLabel && <Chip>{accentLabel} accent</Chip>}
    </div>
  );
}
