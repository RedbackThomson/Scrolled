import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Flame, Gauge, TextSearch, Users, Wand2 } from 'lucide-react';
import { SuggestionList, type SuggestionItem } from '../../src/components/data/SuggestionList';

const FIRE: SuggestionItem[] = [
  { id: 'weak', icon: Flame, hue: 35, label: 'Weak against', value: 'Fire', count: '14 weapons' },
  {
    id: 'name',
    icon: TextSearch,
    hue: 300,
    label: 'Name contains',
    value: '“fire”',
    count: '3 weapons',
  },
  { id: 'magic', icon: Wand2, hue: 255, label: 'Magic element', value: 'Fire', count: '8 weapons' },
];

const EXAMPLES = ['claw 30-50', 'thief', 'atk > 20', '7 slots'];

const meta = {
  title: 'Data/SuggestionList',
  component: SuggestionList,
  tags: ['autodocs'],
  args: { items: FIRE, activeIndex: 0 },
  argTypes: { onSelect: { action: 'select' } },
  decorators: [
    (Story) => (
      <div style={{ width: 440 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof SuggestionList>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Typing: Story = {
  render: function Render(args) {
    const [active, setActive] = useState(0);
    return <SuggestionList {...args} activeIndex={active} onHighlight={setActive} />;
  },
};
export const EmptyField: Story = { args: { items: [], examples: EXAMPLES } };
export const WithExamples: Story = { args: { examples: EXAMPLES } };
export const Ranges: Story = {
  args: {
    items: [
      {
        id: 'lvl',
        icon: Gauge,
        hue: 148,
        label: 'Req Lvl',
        value: '30 – 50',
        count: '212 weapons',
      },
      { id: 'class', icon: Users, hue: 300, label: 'Class', value: 'Thief', count: '96 weapons' },
    ],
  },
};
export const Touch: Story = {
  args: { size: 'lg', bare: true, activeIndex: -1 },
  decorators: [
    (Story) => (
      <div style={{ width: 360 }}>
        <Story />
      </div>
    ),
  ],
};
