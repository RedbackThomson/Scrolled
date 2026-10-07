import type { Meta, StoryObj } from '@storybook/react';
import { Histogram } from '../../src/components/data/Histogram';
import { SAMPLE_LEVEL_BINS } from '../samplePresets';

const meta = {
  title: 'Data/Histogram',
  component: Histogram,
  tags: ['autodocs'],
  args: { bins: SAMPLE_LEVEL_BINS, min: 0, max: 140, range: [30, 50], height: 54 },
  decorators: [
    (Story) => (
      <div style={{ width: 300 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Histogram>;
export default meta;
type Story = StoryObj<typeof meta>;

export const InRange: Story = {};
export const NoRange: Story = { args: { range: undefined } };
export const OpenEnded: Story = { args: { range: [60, undefined] } };
export const Sheet: Story = { args: { height: 70 } };
