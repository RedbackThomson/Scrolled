import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { RollingNumber } from '../../src/components/entity/RollingNumber';
import { StatTile } from '../../src/components/entity/StatTile';

const meta = {
  title: 'Entity/RollingNumber',
  component: RollingNumber,
  tags: ['autodocs'],
  args: { text: '7,800', delayMs: 0 },
  decorators: [
    (Story) => (
      <span style={{ font: '600 30px var(--font-display)' }}>
        <Story />
      </span>
    ),
  ],
} satisfies Meta<typeof RollingNumber>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

/** Tiles in a group roll 30ms apart. Replay remounts them. */
export const TileGroup: Story = { render: () => <TileGroupDemo /> };

function TileGroupDemo() {
  const [run, setRun] = useState(0);
  return (
    <div style={{ display: 'grid', gap: 12, font: '14px var(--font-body)' }}>
      <div key={run} style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 110px)', gap: 6 }}>
        <StatTile label="LVL" value="45" color="var(--stat-level)" />
        <StatTile label="HP" value="7,800" color="var(--stat-hp)" rollDelayMs={30} />
        <StatTile label="MP" value="150" color="var(--stat-mp)" rollDelayMs={60} />
        <StatTile label="EXP" value="1,056" color="var(--stat-exp)" rollDelayMs={90} />
      </div>
      <button type="button" onClick={() => setRun((n) => n + 1)} style={{ width: 'max-content' }}>
        Replay
      </button>
    </div>
  );
}
