import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, RefreshCw } from 'lucide-react';
import { Banner, Button, SearchPill, SlotTile } from '@scrolled/design';
import { getSettingsGroups, searchSettings } from '@/components/settings/settingsGroups';
import { useDatasetUpdate } from '@/hooks/dataset/useDatasetUpdate';
import { usePageTitle } from '@/hooks/usePageTitle';
import { appConfig } from '@/config';
import { popIn } from '@/lib/popIn';
import { GroupSummary } from '@/components/settings/GroupSummary';
import { Attribution } from '@/components/settings/Attribution';

export default function SettingsIndex() {
  usePageTitle('Settings');
  const groups = getSettingsGroups();
  const dataset = useDatasetUpdate();
  const [query, setQuery] = useState('');
  const searching = query.trim() !== '';
  const hits = searchSettings(query);

  return (
    // 96px: the 68px top bar plus the shell's top and bottom content padding.
    <div className="flex min-h-[calc(100dvh-96px)] flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-semibold leading-none md:text-4xl">Settings</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            {appConfig.features.enableUserImport
              ? 'Manage your library, appearance, and server preferences.'
              : 'Manage your appearance and preferences.'}
          </p>
        </div>
        <div className="w-full sm:w-64">
          <SearchPill
            value={query}
            onChange={setQuery}
            placeholder="Find a setting…"
            aria-label="Find a setting"
            width="100%"
          />
        </div>
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
          {groups.map((g, i) => (
            <li key={g.id} {...popIn(i)}>
              <Link
                to={`/settings/${g.id}`}
                className="border-border bg-card shadow-rim ease-spring hover:border-primary/40 focus-visible:ring-primary/30 group flex h-full flex-col gap-4 rounded-[20px] border-2 p-5 transition-[transform,border-color] duration-300 hover:-translate-y-[3px] focus-visible:outline-none focus-visible:ring-4"
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

      <Attribution />
    </div>
  );
}
