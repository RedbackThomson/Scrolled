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
import {
  Table as TableFrame,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../src/components/data/Table';
import { Pagination } from '../../src/components/navigation/Pagination';
import { SectionHeader } from '../../src/components/surfaces/SectionHeader';
import { Segmented } from '../../src/components/forms/Segmented';
import { Button } from '../../src/components/core/Button';
import { IconButton } from '../../src/components/core/IconButton';
import { Chip } from '../../src/components/core/Chip';
import { SAMPLE_PRESETS } from '../samplePresets';
import { SAMPLE_WEAPONS } from '../sampleWeapons';
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
          <TableFrame>
            <TableHeader>
              <TableRow>
                <TableHead className="w-11" />
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="w-[60px]">ATK</TableHead>
                <TableHead className="w-[60px]">Slots</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {SAMPLE_WEAPONS.map((r) => (
                <TableRow key={r.id}>
                  <TableCell>
                    <SlotTile icon={Sword} tint="equip" />
                  </TableCell>
                  <TableCell className="font-semibold">{r.name}</TableCell>
                  <TableCell>One Handed Sword</TableCell>
                  <TableCell className="font-bold">{r.atk}</TableCell>
                  <TableCell>
                    <Chip>{r.slots}</Chip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </TableFrame>
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
