import type { Meta, StoryObj } from '@storybook/react';
import { Sword } from 'lucide-react';
import { DataTable, type DataTableColumn } from '../../src/components/data/DataTable';
import { SlotTile } from '../../src/components/entity/SlotTile';
import { Chip } from '../../src/components/core/Chip';
import { Pagination } from '../../src/components/navigation/Pagination';
import { SAMPLE_WEAPONS, type SampleWeapon } from '../sampleWeapons';

const ROWS = SAMPLE_WEAPONS.slice(0, 6);
const COLS: DataTableColumn<SampleWeapon>[] = [
  { key: 'icon', label: '', width: '44px', render: () => <SlotTile icon={Sword} tint="equip" /> },
  { key: 'name', label: 'Name', render: (r) => <b style={{ fontWeight: 600 }}>{r.name}</b> },
  { key: 't', label: 'Type', render: () => 'One Handed Sword' },
  {
    key: 'c',
    label: 'Cash',
    width: '80px',
    render: () => <span style={{ color: 'var(--text-2)' }}>Regular</span>,
  },
  { key: 'l', label: 'Req Lvl', width: '70px', render: () => 0 },
  { key: 'atk', label: 'ATK', width: '60px', render: (r) => <b>{r.atk}</b> },
  { key: 'slots', label: 'Slots', width: '60px', render: (r) => <Chip>{r.slots}</Chip> },
];

const meta = {
  title: 'Data/DataTable',
  component: DataTable<SampleWeapon>,
  tags: ['autodocs'],
  args: { columns: COLS, rows: ROWS },
  argTypes: { columns: { control: false }, rows: { control: false } },
  decorators: [
    (Story) => (
      <div style={{ width: 900 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DataTable<SampleWeapon>>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Weapons: Story = {};
export const Selectable: Story = { args: { selectable: true, selected: ['Parasol Saber'] } };
export const WithPagination: Story = {
  args: { footer: <Pagination page={1} pageSize={6} total={1269} /> },
};
export const Empty: Story = { args: { rows: [] } };
