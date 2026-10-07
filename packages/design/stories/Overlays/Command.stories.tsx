import type { Meta, StoryObj } from '@storybook/react';
import { Bookmark, Package, Settings, Skull } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from '../../src/components/overlays/Command';

/** The primitives the app's command palette is built from. */
const meta = {
  title: 'Overlays/Command',
  component: Command,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div
        style={{ width: 460, border: 'var(--border-rim)', borderRadius: 18, overflow: 'hidden' }}
      >
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Command>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Command>
      <CommandInput placeholder="Search or jump to…" />
      <CommandList>
        <CommandEmpty>No results.</CommandEmpty>
        <CommandGroup heading="Browse">
          <CommandItem>
            <Package />
            Items
          </CommandItem>
          <CommandItem>
            <Skull />
            Mobs
          </CommandItem>
          <CommandItem>
            <Bookmark />
            Collections
          </CommandItem>
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Go to">
          <CommandItem>
            <Settings />
            Settings
            <CommandShortcut>⌘,</CommandShortcut>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </Command>
  ),
};
