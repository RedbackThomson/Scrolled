import type { Meta, StoryObj } from '@storybook/react';
import { Map as MapIcon, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../src/components/overlays/Dialog';
import { Button } from '../../src/components/core/Button';
import { TextArea, TextField } from '../../src/components/forms/TextField';
import { SlotTile } from '../../src/components/entity/SlotTile';

const meta = {
  title: 'Overlays/Dialog',
  component: Dialog,
  tags: ['autodocs'],
  args: { defaultOpen: true },
  parameters: {
    layout: 'fullscreen',
    docs: { story: { inline: false, iframeHeight: 560 } },
  },
} satisfies Meta<typeof Dialog>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Form: Story = {
  render: (args) => (
    <Dialog {...args}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>New collection</DialogTitle>
        </DialogHeader>
        <DialogBody className="flex flex-col gap-3">
          <TextField label="Name" placeholder="e.g. Boss drops to farm" />
          <TextArea label="Description" hint="Optional" />
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary">Cancel</Button>
          <Button>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};

export const WithIcon: Story = {
  render: (args) => (
    <Dialog {...args}>
      <DialogContent>
        <DialogHeader>
          <SlotTile icon={MapIcon} hue={185} size={38} />
          <div className="flex flex-col">
            <DialogTitle>Pine Grove I</DialogTitle>
            <DialogDescription>Street name</DialogDescription>
          </div>
        </DialogHeader>
        <DialogBody>Map viewer content</DialogBody>
      </DialogContent>
    </Dialog>
  ),
};

export const Confirm: Story = {
  render: (args) => (
    <Dialog {...args}>
      <DialogContent className="max-w-[420px]" showCloseButton={false}>
        <DialogBody className="flex flex-col items-center gap-2.5 text-center">
          <SlotTile icon={Trash2} hue={25} size={56} />
          <DialogTitle className="text-xl">Delete “Leveling 30-51”?</DialogTitle>
          <DialogDescription className="text-[13.5px]">
            This removes the collection and its 21 members from this device.
          </DialogDescription>
        </DialogBody>
        <DialogFooter>
          <Button variant="secondary" fullWidth>
            Keep it
          </Button>
          <Button variant="danger" fullWidth>
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  ),
};
