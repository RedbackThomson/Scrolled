import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import {
  Bookmark,
  ChevronDown,
  LayoutGrid,
  ListFilter,
  SlidersHorizontal,
  Sword,
  Table2,
} from 'lucide-react';
import { EntityCard } from '../../src/components/entity/EntityCard';
import { SlotTile } from '../../src/components/entity/SlotTile';
import { PresetTile } from '../../src/components/data/PresetTile';
import { FilterChip } from '../../src/components/data/FilterChip';
import { DataTable } from '../../src/components/data/DataTable';
import { Pagination } from '../../src/components/navigation/Pagination';
import { SectionHeader } from '../../src/components/surfaces/SectionHeader';
import { Segmented } from '../../src/components/forms/Segmented';
import { Button } from '../../src/components/core/Button';
import { IconButton } from '../../src/components/core/IconButton';
import { Chip } from '../../src/components/core/Chip';
import { SAMPLE_PRESETS } from '../samplePresets';
import { SAMPLE_WEAPONS, type SampleWeapon } from '../sampleWeapons';
import { ScreenShell } from './ScreenShell';

function WeaponsPage({ initialView }: { initialView: 'table' | 'cards' }) {
  const [view, setView] = useState<string>(initialView);
  const [preset, setPreset] = useState(0);
  const [page, setPage] = useState(1);
  return (
    <ScreenShell active="weapons">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div>
          <SectionHeader level={1} title="Weapons" />
          <span style={{ color: 'var(--text-2)' }}>
            Filter by weapon type to see the stat columns most relevant to it.
          </span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,minmax(0,1fr))', gap: 10 }}>
          {SAMPLE_PRESETS.map(([icon, label, count, hue], k) => (
            <PresetTile
              key={label}
              icon={icon}
              label={label}
              count={count}
              hue={hue}
              active={preset === k}
              onClick={() => setPreset(k)}
            />
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button variant="secondary" icon={Bookmark} iconRight={ChevronDown}>
            Saved Searches
          </Button>
          <div style={{ flex: 1 }} />
          <Segmented
            value={view}
            onChange={setView}
            options={[
              { value: 'table', icon: Table2, title: 'Table' },
              { value: 'cards', icon: LayoutGrid, title: 'Cards' },
            ]}
          />
          <IconButton icon={ListFilter} label="Filter (F)" />
          <IconButton icon={SlidersHorizontal} label="Display" />
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <FilterChip label="Req Lvl" value="0 – 30" hue={148} />
          <FilterChip label="Class" value="Any" hue={300} />
          <FilterChip add />
        </div>
        {view === 'cards' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,minmax(0,1fr))', gap: 12 }}>
            {SAMPLE_WEAPONS.map((w) => (
              <EntityCard
                key={w.id}
                icon={Sword}
                name={w.name}
                subtitle="One Handed Sword"
                stats={[
                  { label: 'ATK', value: w.atk, color: 'var(--stat-hp)' },
                  { label: 'Slots', value: w.slots },
                  { label: 'Req Lv', value: 0 },
                  { label: 'Req DEX', value: 0 },
                ]}
                tags={['Any class', 'Regular']}
              />
            ))}
          </div>
        ) : (
          <DataTable<SampleWeapon>
            selectable
            columns={[
              {
                key: 'icon',
                label: '',
                width: '44px',
                render: () => <SlotTile icon={Sword} tint="equip" />,
              },
              {
                key: 'name',
                label: 'Name',
                render: (r) => <b style={{ fontWeight: 600 }}>{r.name}</b>,
              },
              { key: 't', label: 'Type', render: () => 'One Handed Sword' },
              { key: 'atk', label: 'ATK', width: '60px', render: (r) => <b>{r.atk}</b> },
              {
                key: 'slots',
                label: 'Slots',
                width: '60px',
                render: (r) => <Chip>{r.slots}</Chip>,
              },
            ]}
            rows={SAMPLE_WEAPONS}
          />
        )}
        <Pagination page={page} onPage={setPage} pageSize={8} total={1269} />
      </div>
    </ScreenShell>
  );
}

const meta = { title: 'Screens/Weapons', parameters: { layout: 'fullscreen' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const Cards: Story = { render: () => <WeaponsPage initialView="cards" /> };
export const Table: Story = { render: () => <WeaponsPage initialView="table" /> };
