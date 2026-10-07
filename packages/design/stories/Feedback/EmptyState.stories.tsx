import type { Meta, StoryObj } from '@storybook/react';
import {
  ArrowLeft,
  ArrowRight,
  CloudOff,
  Copy,
  Plus,
  RefreshCw,
  SearchX,
  Upload,
} from 'lucide-react';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { Button } from '../../src/components/core/Button';

const ICONS = { none: undefined, 'search-x': SearchX, 'cloud-off': CloudOff };

const meta = {
  title: 'Feedback/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
  args: {
    mascot: 'sleepy',
    title: 'No collections yet',
    body: 'No collections yet. Click "New collection" to create one, "Import" to restore from a previous export, or save items directly from any entity page.',
    actions: (
      <>
        <Button icon={Plus}>New collection</Button>
        <Button variant="secondary" icon={Upload}>
          Import
        </Button>
      </>
    ),
  },
  argTypes: {
    mascot: { control: 'select', options: [undefined, 'idle', 'wave', 'read', 'sleepy', 'cheer'] },
    icon: { control: 'select', options: Object.keys(ICONS), mapping: ICONS },
  },
} satisfies Meta<typeof EmptyState>;
export default meta;
type Story = StoryObj<typeof meta>;

export const NoCollections: Story = {};
export const NoResults: Story = {
  args: {
    mascot: undefined,
    icon: SearchX,
    hue: 20,
    title: 'Nothing matches these filters',
    body: 'Try widening Req Lvl or removing a chip.',
    actions: (
      <Button variant="secondary" size="sm">
        Clear all filters
      </Button>
    ),
  },
};
export const NotFound: Story = {
  args: {
    mascot: 'wave',
    title: 'Page not found',
    body: "The page you were looking for doesn't exist.",
    actions: <Button icon={ArrowLeft}>Back home</Button>,
  },
};
export const Error: Story = {
  args: {
    mascot: undefined,
    icon: CloudOff,
    hue: 25,
    title: "Couldn't load this mob",
    body: 'The library returned an error. Your data is safe.',
    actions: (
      <>
        <Button icon={RefreshCw}>Try again</Button>
        <Button variant="secondary" icon={Copy}>
          Copy details
        </Button>
      </>
    ),
  },
};
export const SetupComplete: Story = {
  args: {
    mascot: 'cheer',
    title: 'Your wiki is ready',
    body: '28,000+ entries indexed',
    actions: <Button icon={ArrowRight}>Start exploring</Button>,
  },
};
