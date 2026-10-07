import type { Meta, StoryObj } from '@storybook/react';
import { BarChart3, Info, ListChecks } from 'lucide-react';
import { Panel } from '../../src/components/surfaces/Panel';
import { InfoList, InfoRow } from '../../src/components/surfaces/InfoRow';
import { Button } from '../../src/components/core/Button';

const ICONS = { none: undefined, 'bar-chart-3': BarChart3, info: Info, 'list-checks': ListChecks };

const meta = {
  title: 'Surfaces/Panel',
  component: Panel,
  tags: ['autodocs'],
  args: {
    title: 'Info',
    variant: 'rim',
    children: (
      <InfoList>
        <InfoRow label="Street" value="Harbor Road" />
        <InfoRow label="Mob rate" value="1.00" />
      </InfoList>
    ),
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['rim', 'float', 'sunken'] },
    as: { control: 'inline-radio', options: ['section', 'aside', 'div'] },
    gap: { control: { type: 'range', min: 0, max: 32 } },
    padding: { control: { type: 'range', min: 0, max: 32 } },
    icon: { control: 'select', options: Object.keys(ICONS), mapping: ICONS },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 300 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Panel>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Rim: Story = {};
export const Float: Story = {
  args: { variant: 'float', title: undefined, children: 'Floats on the backdrop' },
};
export const Sunken: Story = {
  args: { variant: 'sunken', title: undefined, children: 'Inset group' },
};
export const WithAction: Story = {
  args: {
    title: 'Stats',
    icon: BarChart3,
    count: 4,
    action: (
      <Button variant="ghost" size="sm">
        Copy
      </Button>
    ),
  },
};

/** A detail-page aside: the panel is the landmark and holds headed groups. */
export const Aside: Story = {
  args: { as: 'aside', title: undefined, gap: 16 },
};
