import type { Meta, StoryObj } from '@storybook/react';
import { LayoutDashboard, RefreshCw, Sparkles, TriangleAlert, WifiOff } from 'lucide-react';
import { Banner } from '../../src/components/feedback/Banner';
import { Button } from '../../src/components/core/Button';

const ICONS = {
  none: undefined,
  'refresh-cw': RefreshCw,
  'triangle-alert': TriangleAlert,
  'wifi-off': WifiOff,
  'layout-dashboard': LayoutDashboard,
  sparkles: Sparkles,
};

const meta = {
  title: 'Feedback/Banner',
  component: Banner,
  tags: ['autodocs'],
  args: {
    tone: 'warn',
    icon: RefreshCw,
    title: 'Data update available',
    body: '2026-07-02 → 2026-09-21',
    action: <Button size="sm">Update</Button>,
  },
  argTypes: {
    tone: { control: 'inline-radio', options: ['info', 'warn', 'danger', 'dark'] },
    icon: { control: 'select', options: Object.keys(ICONS), mapping: ICONS },
  },
  decorators: [
    (Story) => (
      <div style={{ width: 720 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Banner>;
export default meta;
type Story = StoryObj<typeof meta>;

export const DataUpdate: Story = {};
export const SyncBlocked: Story = {
  args: {
    tone: 'danger',
    icon: TriangleAlert,
    title: 'Update needed',
    body: 'A newer version is required to sync. Refresh the page to update.',
    action: (
      <Button size="sm" icon={RefreshCw}>
        Sync now
      </Button>
    ),
  },
};
export const Offline: Story = {
  args: {
    tone: 'info',
    icon: WifiOff,
    title: 'Offline mode',
    body: 'Everything still works while offline. The app will check for new versions once you reconnect.',
    action: undefined,
  },
};
export const EditingHome: Story = {
  args: {
    tone: 'dark',
    icon: LayoutDashboard,
    title: 'Editing your home page',
    body: "Drag sections to reorder, or hide what you don't use.",
    action: <Button size="sm">Done</Button>,
  },
};
export const NewVersion: Story = {
  args: {
    tone: 'dark',
    icon: Sparkles,
    title: 'A new version of Scrolled is ready',
    body: 'Reload to update. Your library stays as it is.',
    action: <Button size="sm">Reload</Button>,
  },
};
