import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Bookmark, ScrollText, Star, type LucideIcon } from 'lucide-react';
import { Popover, PopoverItem } from '../../src/components/overlays/Popover';
import { Button } from '../../src/components/core/Button';
import { Checkbox } from '../../src/components/forms/Checkbox';
import { SlotTile } from '../../src/components/entity/SlotTile';
import { SearchPill } from '../../src/components/forms/SearchPill';

const meta = {
  title: 'Overlays/Popover',
  component: Popover,
  tags: ['autodocs'],
  args: { width: 300, arrow: 'top' },
  argTypes: { arrow: { control: 'inline-radio', options: [undefined, 'top'] } },
} satisfies Meta<typeof Popover>;
export default meta;
type Story = StoryObj<typeof meta>;

const CLASSES = ['Beginner', 'Warrior', 'Magician', 'Bowman', 'Thief', 'Pirate'];

export const EnumFilter: Story = {
  render: function Render(args) {
    const [selected, setSelected] = useState(['Thief']);
    return (
      <Popover
        {...args}
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setSelected([])}>
              Clear
            </Button>
            <Button size="sm">Apply</Button>
          </>
        }
      >
        <div style={{ padding: 6 }}>
          {CLASSES.map((c) => {
            const on = selected.includes(c);
            return (
              <PopoverItem
                key={c}
                active={on}
                onClick={() => setSelected((x) => (on ? x.filter((y) => y !== c) : [...x, c]))}
                icon={<Checkbox checked={on} />}
              >
                {c}
              </PopoverItem>
            );
          })}
        </div>
      </Popover>
    );
  },
};

const COLLECTIONS: [LucideIcon, number, string, boolean][] = [
  [ScrollText, 295, 'Quests worth doing: levels 51-60', true],
  [Bookmark, 235, 'Favourite', false],
  [Star, 80, 'Favourites', true],
];

export const CollectionPicker: Story = {
  render: (args) => (
    <Popover {...args} width={330}>
      <div style={{ padding: 10 }}>
        <SearchPill tone="sunken" placeholder="Find a collection…" shortcut={null} width="100%" />
      </div>
      <div style={{ padding: '0 6px 6px' }}>
        {COLLECTIONS.map(([icon, hue, name, on]) => (
          <PopoverItem
            key={name}
            icon={<SlotTile icon={icon} hue={hue} size={28} />}
            trailing={<Checkbox checked={on} />}
          >
            {name}
          </PopoverItem>
        ))}
      </div>
    </Popover>
  ),
};
