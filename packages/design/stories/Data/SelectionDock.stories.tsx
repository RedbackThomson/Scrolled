import type { Meta, StoryObj } from '@storybook/react';
import { SelectionDock } from '../../src/components/data/SelectionDock';

const meta = {
  title: 'Data/SelectionDock',
  component: SelectionDock,
  tags: ['autodocs'],
  args: {
    count: 4,
    total: 38,
    allMatching: false,
    onSelectAll: () => {},
    onAdd: () => {},
    onClear: () => {},
  },
  argTypes: {
    onSelectAll: { action: 'select all' },
    onAdd: { action: 'add' },
    onClear: { action: 'clear' },
  },
  decorators: [
    // The transform contains the dock's fixed positioning so each story keeps its own.
    (Story) => (
      <div style={{ minHeight: 160, transform: 'translateZ(0)' }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SelectionDock>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Some: Story = {};
export const AllMatching: Story = { args: { count: 38, allMatching: true } };
export const WithCompare: Story = { args: { onCompare: () => {} } };
export const PickerOpen: Story = { args: { addOpen: true } };
export const Mobile: Story = {
  args: { variant: 'mobile' },
  parameters: { viewport: { defaultViewport: 'mobile2' } },
};
