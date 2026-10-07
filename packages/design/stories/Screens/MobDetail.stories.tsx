import type { Meta, StoryObj } from '@storybook/react';
import {
  ArrowDownUp,
  BookmarkPlus,
  Crown,
  CreditCard,
  FlaskConical,
  Gem,
  Ghost,
  Hammer,
  MapPin,
  Package,
  Pin,
  Sword,
  type LucideIcon,
} from 'lucide-react';
import { SlotTile } from '../../src/components/entity/SlotTile';
import { EntityRow } from '../../src/components/entity/EntityRow';
import { StatTile } from '../../src/components/entity/StatTile';
import { ElementChip, type ElementChipProps } from '../../src/components/entity/ElementChip';
import { ListCard } from '../../src/components/surfaces/ListCard';
import { Panel } from '../../src/components/surfaces/Panel';
import { SectionHeader } from '../../src/components/surfaces/SectionHeader';
import { Button } from '../../src/components/core/Button';
import { Chip } from '../../src/components/core/Chip';
import type { SlotTint } from '../../src/lib/interaction';
import { ScreenShell } from './ScreenShell';

const DROPS: [LucideIcon, string, string, SlotTint][] = [
  [Gem, 'Iron Ore', 'Etc', 'etc'],
  [FlaskConical, 'Blue Tonic', 'Use', 'use'],
  [Pin, 'Sharp Needle', 'Etc', 'etc'],
  [Sword, 'Gilded Dagger', 'Weapon', 'equip'],
  [Hammer, 'Spiked Mace', 'Weapon', 'equip'],
  [Sword, 'Wolf Fang Blade', 'Weapon', 'equip'],
  [CreditCard, 'Gift Card - 100 Points', 'Cash', 'cash'],
];

const ELEMENTS: ElementChipProps['element'][] = [
  'ice',
  'lightning',
  'fire',
  'poison',
  'holy',
  'dark',
  'physical',
];

const meta = { title: 'Screens/Mob detail', parameters: { layout: 'fullscreen' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const FrostWisp: Story = {
  render: () => (
    <ScreenShell active="mobs">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0,1fr) 288px',
          gap: 24,
          alignItems: 'start',
        }}
      >
        <article style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <SlotTile icon={Ghost} tint="mob" size={116} spotlight rimmed />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <SectionHeader level={1} title="Frost Wisp" />
                <Chip tone="gold" icon={Crown}>
                  Boss
                </Chip>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button icon={BookmarkPlus}>Save</Button>
                <Button variant="secondary" icon={MapPin}>
                  Show on map
                </Button>
              </div>
            </div>
          </div>
          <SectionHeader
            icon={Package}
            title="Drops"
            count={35}
            action={
              <Button variant="secondary" size="sm" icon={ArrowDownUp}>
                Sort
              </Button>
            }
          />
          <ListCard>
            {DROPS.map(([icon, name, meta, tint], i) => (
              <EntityRow
                key={name}
                first={i === 0}
                icon={icon}
                tint={tint}
                name={name}
                meta={meta}
              />
            ))}
          </ListCard>
        </article>
        <Panel>
          <h3 style={{ margin: 0, font: 'var(--type-panel-title)' }}>Stats</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            <StatTile label="Level" value="45" color="var(--stat-level)" />
            <StatTile label="HP" value="7,800" color="var(--stat-hp)" />
            <StatTile label="MP" value="150" color="var(--stat-mp)" />
            <StatTile label="EXP" value="1,056" color="var(--stat-exp)" />
          </div>
          <h3 style={{ margin: 0, font: 'var(--type-panel-title)' }}>Elements</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {ELEMENTS.map((e) => (
              <ElementChip key={e} element={e} />
            ))}
          </div>
        </Panel>
      </div>
    </ScreenShell>
  ),
};
