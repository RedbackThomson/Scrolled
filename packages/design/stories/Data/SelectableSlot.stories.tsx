import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Sword } from 'lucide-react';
import { SelectableSlot } from '../../src/components/data/SelectableSlot';
import { SAMPLE_WEAPONS } from '../sampleWeapons';

const meta = {
  title: 'Data/SelectableSlot',
  component: SelectableSlot,
  tags: ['autodocs'],
  args: { icon: Sword, tint: 'equip', label: 'Bronze Sword', selected: false, onToggle: () => {} },
  argTypes: {
    onToggle: { action: 'toggle' },
    size: { control: { type: 'range', min: 36, max: 60 } },
  },
} satisfies Meta<typeof SelectableSlot>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Hover or focus it to see the dashed + target. */
export const Idle: Story = {};
export const Selected: Story = { args: { selected: true } };
/** Touch selection mode: every unselected slot shows its outline. */
export const Selecting: Story = { args: { selecting: true } };
export const Card: Story = { args: { size: 60, selected: true } };

/** Click to toggle, shift-click to select a range. */
export const Rows: Story = {
  render: function Render() {
    const [selected, setSelected] = useState<Set<number>>(new Set([1, 2]));
    const [last, setLast] = useState<number | null>(null);
    const toggle = (i: number, shift: boolean) => {
      setSelected((prev) => {
        const next = new Set(prev);
        const on = !prev.has(i);
        const [a, b] = shift && last != null ? [Math.min(last, i), Math.max(last, i)] : [i, i];
        for (let k = a; k <= b; k++) {
          if (on) next.add(k);
          else next.delete(k);
        }
        return next;
      });
      setLast(i);
    };
    return (
      <div
        style={{
          width: 420,
          borderRadius: 18,
          border: 'var(--border-rim)',
          overflow: 'hidden',
          background: 'var(--surface-card)',
        }}
      >
        {SAMPLE_WEAPONS.map((w, i) => (
          <div
            key={w.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '8px 14px',
              borderTop: i ? '2px solid var(--surface-sunken)' : 'none',
              background: selected.has(i) ? 'var(--accent-glow)' : 'transparent',
            }}
          >
            <SelectableSlot
              icon={Sword}
              tint="equip"
              label={w.name}
              selected={selected.has(i)}
              onToggle={(e) => toggle(i, e.shiftKey)}
            />
            <b style={{ flex: 1 }}>{w.name}</b>
            <span style={{ color: 'var(--text-2)' }}>ATK {w.atk}</span>
          </div>
        ))}
      </div>
    );
  },
};
