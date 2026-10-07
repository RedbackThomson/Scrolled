import type { Meta, StoryObj } from '@storybook/react';
import { Archive } from 'lucide-react';
import { SwipeRow } from '../../src/components/data/SwipeRow';

const meta = {
  title: 'Data/SwipeRow',
  component: SwipeRow,
  tags: ['autodocs'],
  args: { onAction: () => {}, children: null },
  argTypes: { onAction: { action: 'action' } },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
} satisfies Meta<typeof SwipeRow>;
export default meta;
type Story = StoryObj<typeof meta>;

const ROWS = ['Thief claws 30–50', 'Cheap scrolls', 'Bosses under 70'];

export const List: Story = {
  render: (args) => (
    <ul
      style={{ maxWidth: 358, padding: 0, margin: 0, listStyle: 'none' }}
      className="border-border bg-card shadow-rim divide-y-2 divide-[var(--surface-sunken)] overflow-hidden rounded-[18px] border-2"
    >
      {ROWS.map((name) => (
        <li key={name}>
          <SwipeRow {...args}>
            <div
              style={{ minHeight: 58, display: 'flex', alignItems: 'center', padding: '0 16px' }}
            >
              <b>{name}</b>
            </div>
          </SwipeRow>
        </li>
      ))}
    </ul>
  ),
};
export const CustomAction: Story = {
  ...List,
  args: { actionLabel: 'Archive', actionIcon: Archive },
};
