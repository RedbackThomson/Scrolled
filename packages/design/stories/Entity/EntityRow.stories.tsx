import type { Meta, StoryObj } from '@storybook/react';
import { CreditCard, Crown, FlaskConical, Gem, Ghost, Map as MapIcon, Sword } from 'lucide-react';
import { EntityRow } from '../../src/components/entity/EntityRow';
import { ListCard } from '../../src/components/surfaces/ListCard';
import { Chip } from '../../src/components/core/Chip';

const wrap = [
  (Story: () => JSX.Element) => (
    <div style={{ width: 560 }}>
      <ListCard>
        <Story />
      </ListCard>
    </div>
  ),
];
const DROPS = [
  { icon: Gem, name: 'Iron Ore', meta: 'Etc', tint: 'etc' },
  { icon: FlaskConical, name: 'Blue Tonic', meta: 'Use', tint: 'use' },
  { icon: Sword, name: 'Gilded Dagger', meta: 'Weapon', tint: 'equip' },
  { icon: CreditCard, name: 'Gift Card - 100 Points', meta: 'Cash', tint: 'cash' },
] as const;

const meta = {
  title: 'Entity/EntityRow',
  component: EntityRow,
  tags: ['autodocs'],
  args: { icon: Gem, tint: 'etc', name: 'Iron Ore', meta: 'Etc', first: true },
  argTypes: {
    tint: { control: 'select', options: ['etc', 'use', 'equip', 'cash', 'mob', 'neutral'] },
    onClick: { action: 'clicked' },
  },
} satisfies Meta<typeof EntityRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Item: Story = { decorators: wrap };
export const Selected: Story = {
  decorators: wrap,
  args: { icon: FlaskConical, tint: 'use', name: 'Blue Tonic', meta: 'Use', selected: true },
};
export const MapWithSubtitle: Story = {
  decorators: wrap,
  args: {
    icon: MapIcon,
    tint: undefined,
    hue: 185,
    name: 'Quiet Grove I',
    subtitle: 'Street name',
    meta: '×12',
  },
};
export const WithTrailing: Story = {
  decorators: wrap,
  args: {
    icon: Ghost,
    tint: 'mob',
    name: 'Frost Wisp',
    meta: 'Lvl 45',
    trailing: (
      <Chip tone="gold" icon={Crown}>
        Boss
      </Chip>
    ),
  },
};
export const DropsList: Story = {
  render: () => (
    <div style={{ width: 560 }}>
      <ListCard>
        {DROPS.map((d, i) => (
          <EntityRow
            key={d.name}
            first={i === 0}
            icon={d.icon}
            tint={d.tint}
            name={d.name}
            meta={d.meta}
            onClick={() => {}}
          />
        ))}
      </ListCard>
    </div>
  ),
};
