import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { RangeSlider } from '../../src/components/forms/RangeSlider';
import { Histogram } from '../../src/components/data/Histogram';
import { SAMPLE_LEVEL_BINS } from '../samplePresets';

const meta = {
  title: 'Forms/RangeSlider',
  component: RangeSlider,
  tags: ['autodocs'],
  args: { min: 0, max: 200, value: [30, 50] },
  argTypes: {},
  decorators: [
    (Story) => (
      <div style={{ width: 280 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof RangeSlider>;
export default meta;
type Story = StoryObj<typeof meta>;

export const ReqLevel: Story = {};
export const WideRange: Story = { args: { value: [10, 160] } };

const QUICK = [
  { label: 'Around my level (42)', value: [37, 47] as [number, number] },
  { label: '30 – 50', value: [30, 50] as [number, number] },
  { label: 'Starter (0–10)', value: [0, 10] as [number, number] },
];

/** Drag a thumb, use the arrow keys, type a bound, or pick a quick range. */
export const Interactive: Story = {
  render: function Render(args) {
    const [value, setValue] = useState<[number, number]>([30, 50]);
    return <RangeSlider {...args} value={value} onChange={setValue} label="Req Lvl" />;
  },
  args: { max: 140, quickRanges: QUICK },
};

export const WithHistogram: Story = {
  render: function Render() {
    const [value, setValue] = useState<[number, number]>([30, 50]);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Histogram bins={SAMPLE_LEVEL_BINS} min={0} max={140} range={value} />
        <RangeSlider
          min={0}
          max={140}
          value={value}
          onChange={setValue}
          quickRanges={QUICK}
          label="Req Lvl"
        />
      </div>
    );
  },
};
