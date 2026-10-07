import type { Meta, StoryObj } from '@storybook/react';
import { ElementChip } from '../../src/components/entity/ElementChip';

const ELEMENTS = ['ice', 'lightning', 'fire', 'poison', 'holy', 'dark', 'physical'] as const;

const meta = {
  title: 'Entity/ElementChip',
  component: ElementChip,
  tags: ['autodocs'],
  args: { element: 'fire', status: 'Weak' },
  argTypes: {
    element: { control: 'select', options: ELEMENTS },
    status: { control: 'select', options: [undefined, 'Weak', 'Strong', 'Immune'] },
  },
} satisfies Meta<typeof ElementChip>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Weak: Story = {};
export const Neutral: Story = { args: { element: 'ice', status: undefined } };
export const AllElements: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {ELEMENTS.map((e) => (
        <ElementChip key={e} element={e} />
      ))}
    </div>
  ),
};
