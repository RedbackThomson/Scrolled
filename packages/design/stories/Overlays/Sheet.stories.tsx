import type { Meta, StoryObj } from '@storybook/react';
import { Sheet } from '../../src/components/overlays/Sheet';
import { Button } from '../../src/components/core/Button';

const meta = {
  title: 'Overlays/Sheet',
  component: Sheet,
  tags: ['autodocs'],
  args: {
    title: 'Filter',
    action: <a href="#">Clear all</a>,
    children: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          ['Class', 'Thief'],
          ['Req Lvl', '30 – 50'],
        ].map(([k, v]) => (
          <div
            key={k}
            style={{
              display: 'flex',
              minHeight: 48,
              alignItems: 'center',
              padding: '0 14px',
              borderRadius: 16,
              background: 'var(--surface-sunken)',
            }}
          >
            <b style={{ flex: 1 }}>{k}</b>
            {v}
          </div>
        ))}
      </div>
    ),
    footer: (
      <Button size="lg" fullWidth>
        Show 38 weapons
      </Button>
    ),
  },
  argTypes: {},
  decorators: [
    (Story) => (
      <div style={{ width: 390, paddingTop: 200 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Sheet>;
export default meta;
type Story = StoryObj<typeof meta>;

export const MobileFilter: Story = {};
