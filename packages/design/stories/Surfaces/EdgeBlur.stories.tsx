import type { Meta, StoryObj } from '@storybook/react';
import { Menu } from 'lucide-react';
import { EdgeBlur } from '../../src/components/surfaces/EdgeBlur';
import { IconButton } from '../../src/components/core/IconButton';
import { Panel } from '../../src/components/surfaces/Panel';

const meta = {
  title: 'Surfaces/EdgeBlur',
  component: EdgeBlur,
  tags: ['autodocs'],
  args: { height: 92 },
  parameters: { layout: 'fullscreen', viewport: { defaultViewport: 'mobile2' } },
} satisfies Meta<typeof EdgeBlur>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Scroll the cards up under the bar to see them frost toward the top edge. */
export const UnderTopBar: Story = {
  render: (args) => (
    <div style={{ height: 520, overflowY: 'auto', background: 'var(--gradient-page)' }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 1,
          height: 68,
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
        }}
      >
        <EdgeBlur {...args} style={{ zIndex: -1 }} />
        <IconButton icon={Menu} variant="float" size={44} label="Menu" />
      </header>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 12 }}>
        {Array.from({ length: 12 }, (_, i) => (
          <Panel key={i}>Card {i + 1} with some text to blur as it passes under the bar.</Panel>
        ))}
      </div>
    </div>
  ),
};
