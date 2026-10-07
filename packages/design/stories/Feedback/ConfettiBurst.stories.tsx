import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Bookmark } from 'lucide-react';
import { ConfettiBurst } from '../../src/components/feedback/ConfettiBurst';
import { Button } from '../../src/components/core/Button';

const meta = {
  title: 'Feedback/ConfettiBurst',
  component: ConfettiBurst,
  tags: ['autodocs'],
  args: { trigger: 0, variant: 'save' },
  argTypes: { variant: { control: 'inline-radio', options: ['save', 'celebrate'] } },
  render: (args) => <BurstDemo {...args} />,
} satisfies Meta<typeof ConfettiBurst>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Save: Story = {};
export const Celebrate: Story = { args: { variant: 'celebrate' } };

function BurstDemo({ variant }: { variant?: 'save' | 'celebrate' }) {
  const [trigger, setTrigger] = useState(0);
  return (
    <div style={{ padding: 80 }}>
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <Button icon={Bookmark} onClick={() => setTrigger((n) => n + 1)}>
          {variant === 'celebrate' ? 'Celebrate' : 'Save'}
        </Button>
        <ConfettiBurst variant={variant} trigger={trigger} />
      </span>
    </div>
  );
}
