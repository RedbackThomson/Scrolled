import type { Meta, StoryObj } from '@storybook/react';
import { FlaskConical, Gem, Sword } from 'lucide-react';
import { ListCard } from '../../src/components/surfaces/ListCard';
import { EntityRow } from '../../src/components/entity/EntityRow';

const meta = {
  title: 'Surfaces/ListCard',
  component: ListCard,
  tags: ['autodocs'],
  args: {},
  argTypes: {},
} satisfies Meta<typeof ListCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithRows: Story = {
  render: () => (
    <div style={{ width: 520 }}>
      <ListCard>
        <EntityRow first icon={Gem} tint="etc" name="Iron Ore" meta="Etc" />
        <EntityRow icon={FlaskConical} tint="use" name="Red Tonic" meta="Use" />
        <EntityRow icon={Sword} tint="equip" name="Bronze Sword" meta="Weapon" />
      </ListCard>
    </div>
  ),
};
