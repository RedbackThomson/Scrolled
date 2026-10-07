import type { Meta, StoryObj } from '@storybook/react';
import { HopLoader } from '../../src/components/feedback/HopLoader';
import { SlotTile } from '../../src/components/entity/SlotTile';
import { Skull } from 'lucide-react';

const meta = {
  title: 'Feedback/HopLoader',
  component: HopLoader,
  tags: ['autodocs'],
  args: { label: 'Loading', size: 64 },
  argTypes: { size: { control: { type: 'range', min: 32, max: 120 } } },
} satisfies Meta<typeof HopLoader>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Mascot: Story = {};
export const EntitySprite: Story = {
  args: { label: 'Loading mob', children: <SlotTile icon={Skull} tint="mob" size={56} /> },
};
