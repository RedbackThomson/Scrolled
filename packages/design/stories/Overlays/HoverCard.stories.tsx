import type { Meta, StoryObj } from '@storybook/react';
import { FlaskConical, Ghost, Map as MapIcon } from 'lucide-react';
import { HoverCard } from '../../src/components/overlays/HoverCard';
import { Chip } from '../../src/components/core/Chip';

const meta = {
  title: 'Overlays/HoverCard',
  component: HoverCard,
  tags: ['autodocs'],
  args: {
    icon: FlaskConical,
    title: 'Blue Tonic',
    badge: (
      <Chip tone="hue" hue={15}>
        Use
      </Chip>
    ),
    children: (
      <>
        <span style={{ fontSize: 12.5, opacity: 0.85 }}>
          A tonic brewed from blue herbs. Recovers 100 MP.
        </span>
        <span style={{ fontSize: 12, color: 'var(--gold)' }}>100 mesos</span>
      </>
    ),
  },
  argTypes: { onSave: { action: 'save' }, icon: { control: false } },
} satisfies Meta<typeof HoverCard>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Item: Story = {};
export const Mob: Story = {
  args: {
    icon: Ghost,
    title: 'Frost Wisp',
    badge: <Chip tone="gold">Boss</Chip>,
    children: <span style={{ fontSize: 12.5 }}>Lvl 45 · HP 7,800 · EXP 1,056</span>,
  },
};
export const Map: Story = {
  args: {
    icon: MapIcon,
    title: 'Pine Grove I',
    badge: undefined,
    children: <span style={{ fontSize: 12.5, opacity: 0.8 }}>2 mobs · 1 NPC · 3 portals</span>,
  },
};
export const NoFooter: Story = { args: { onSave: null } };
export const WithStatsBelow: Story = {
  args: {
    icon: Ghost,
    title: 'Frost Wisp',
    badge: <Chip tone="gold">Boss</Chip>,
    children: undefined,
    below: (
      <div style={{ display: 'flex', gap: 4 }}>
        {[
          ['LVL', '45'],
          ['HP', '7,800'],
          ['EXP', '1,056'],
        ].map(([k, v]) => (
          <div
            key={k}
            style={{
              flex: 1,
              padding: '6px 8px',
              borderRadius: 10,
              background: 'rgba(255,255,255,.07)',
            }}
          >
            <div style={{ fontSize: 10.5, fontWeight: 800 }}>{k}</div>
            <div style={{ font: '600 15px var(--font-display)' }}>{v}</div>
          </div>
        ))}
      </div>
    ),
  },
};
export const GlyphTile: Story = {
  args: { icon: MapIcon, mediaSize: 40, mediaHue: 185, title: 'Pine Grove I', badge: undefined },
};
