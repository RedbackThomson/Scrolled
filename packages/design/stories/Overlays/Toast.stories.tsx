import type { Meta, StoryObj } from '@storybook/react';
import { Check, RefreshCw } from 'lucide-react';
import { Toast } from '../../src/components/overlays/Toast';

const ICONS = { check: Check, 'refresh-cw': RefreshCw };

const meta = {
  title: 'Overlays/Toast',
  component: Toast,
  tags: ['autodocs'],
  args: {
    children: (
      <>
        Added to <b>Favourites</b>
      </>
    ),
    action: 'Undo',
    icon: Check,
    duration: 4200,
  },
  argTypes: {
    onAction: { action: 'undo' },
    icon: { control: 'select', options: Object.keys(ICONS), mapping: ICONS },
  },
} satisfies Meta<typeof Toast>;
export default meta;
type Story = StoryObj<typeof meta>;

export const WithUndo: Story = {};
export const NoAction: Story = {
  args: { action: undefined, duration: 0, icon: RefreshCw, children: 'Library updated' },
};
