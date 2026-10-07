import type { Meta, StoryObj } from '@storybook/react';
import { Map as MapIcon, Trash2 } from 'lucide-react';
import { Dialog } from '../../src/components/overlays/Dialog';
import { Button } from '../../src/components/core/Button';
import { TextField } from '../../src/components/forms/TextField';
import { SlotTile } from '../../src/components/entity/SlotTile';

const meta = {
  title: 'Overlays/Dialog',
  component: Dialog,
  tags: ['autodocs'],
  args: {
    title: 'New collection',
    inline: true,
    width: 480,
    children: (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <TextField label="Name" placeholder="e.g. Boss drops to farm" />
        <TextField label="Description" hint="Optional" multiline />
      </div>
    ),
    footer: (
      <>
        <Button variant="secondary">Cancel</Button>
        <Button>Create</Button>
      </>
    ),
  },
  argTypes: { onClose: { action: 'close' } },
} satisfies Meta<typeof Dialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Form: Story = {};
export const WithIcon: Story = {
  args: {
    title: 'Pine Grove I',
    subtitle: 'Street name',
    icon: <SlotTile icon={MapIcon} hue={185} size={38} />,
    footer: undefined,
    children: 'Map viewer content',
  },
};
export const Confirm: Story = {
  args: {
    title: undefined,
    width: 420,
    children: (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 10,
          textAlign: 'center',
          padding: '6px 4px',
        }}
      >
        <SlotTile icon={Trash2} hue={25} size={56} />
        <span style={{ font: '600 20px var(--font-display)' }}>Delete “Leveling 30-51”?</span>
        <span style={{ fontSize: 13.5, color: 'var(--text-2)' }}>
          This removes the collection and its 21 members from this device.
        </span>
      </div>
    ),
    footer: (
      <>
        <Button variant="secondary" fullWidth>
          Keep it
        </Button>
        <Button variant="danger" fullWidth>
          Delete
        </Button>
      </>
    ),
  },
};
export const Modal: Story = {
  args: { inline: false },
  parameters: { layout: 'fullscreen' },
  decorators: [
    (Story) => (
      <div style={{ height: 520 }}>
        <Story />
      </div>
    ),
  ],
};
