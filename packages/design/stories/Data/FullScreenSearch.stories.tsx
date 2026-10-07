import { useState } from 'react';
import { Shield, TrendingUp } from 'lucide-react';
import type { Meta, StoryObj } from '@storybook/react';
import {
  FullScreenSearch,
  FullScreenSearchSection,
} from '../../src/components/data/FullScreenSearch';
import { FacetPill } from '../../src/components/data/FacetPill';
import { SuggestionList } from '../../src/components/data/SuggestionList';

const meta = {
  title: 'Data/FullScreenSearch',
  component: FullScreenSearch,
  tags: ['autodocs'],
  args: { value: '', onChange: () => {}, onClose: () => {}, placeholder: 'Filter weapons…' },
  argTypes: { onClose: { action: 'close' }, onSubmit: { action: 'submit' } },
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile2' },
    docs: { story: { inline: false, iframeHeight: 720 } },
  },
} satisfies Meta<typeof FullScreenSearch>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  render: function Render(args) {
    const [value, setValue] = useState(args.value);
    return <FullScreenSearch {...args} value={value} onChange={setValue} />;
  },
};

export const WithSuggestions: Story = {
  render: function Render(args) {
    const [value, setValue] = useState('thief 30');
    return (
      <FullScreenSearch
        {...args}
        value={value}
        onChange={setValue}
        chips={<FacetPill label="Type" hue={235} valueLabel="Claw" size="lg" />}
      >
        <FullScreenSearchSection title="Filter by">
          <SuggestionList
            items={[
              {
                id: 'class',
                icon: Shield,
                label: 'Class',
                value: 'Thief',
                count: '38 weapons',
                hue: 300,
              },
              {
                id: 'lvl',
                icon: TrendingUp,
                label: 'Req Lvl',
                value: '30',
                count: '6 weapons',
                hue: 148,
              },
            ]}
            activeIndex={0}
            size="lg"
            bare
          />
        </FullScreenSearchSection>
      </FullScreenSearch>
    );
  },
};
