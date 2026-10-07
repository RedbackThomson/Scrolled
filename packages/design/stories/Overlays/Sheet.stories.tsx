import type { Meta, StoryObj } from '@storybook/react';
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '../../src/components/overlays/Sheet';
import { Button } from '../../src/components/core/Button';

const meta = {
  title: 'Overlays/Sheet',
  component: Sheet,
  tags: ['autodocs'],
  args: { defaultOpen: true },
  parameters: {
    layout: 'fullscreen',
    viewport: { defaultViewport: 'mobile2' },
    docs: { story: { inline: false, iframeHeight: 560 } },
  },
} satisfies Meta<typeof Sheet>;
export default meta;
type Story = StoryObj<typeof meta>;

export const MobileFilter: Story = {
  render: (args) => (
    <Sheet {...args}>
      <SheetContent side="bottom" showCloseButton={false} className="mx-auto max-w-[390px]">
        <SheetHeader className="flex-row items-center justify-between space-y-0">
          <SheetTitle>Filter</SheetTitle>
          <a href="#">Clear all</a>
        </SheetHeader>
        <div className="flex flex-col gap-2 px-4 py-3">
          {[
            ['Class', 'Thief'],
            ['Req Lvl', '30 – 50'],
          ].map(([k, v]) => (
            <div key={k} className="bg-muted flex min-h-12 items-center rounded-lg px-3.5">
              <b className="flex-1">{k}</b>
              {v}
            </div>
          ))}
        </div>
        <SheetFooter className="pb-6">
          <Button size="lg" fullWidth>
            Show 38 weapons
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  ),
};

export const Drawer: Story = {
  render: (args) => (
    <Sheet {...args}>
      <SheetContent side="left" className="w-[300px]">
        <SheetHeader>
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>
      </SheetContent>
    </Sheet>
  ),
};
