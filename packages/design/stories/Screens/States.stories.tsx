import type { Meta, StoryObj } from '@storybook/react';
import { ArrowLeft, Plus, Upload } from 'lucide-react';
import { EmptyState } from '../../src/components/feedback/EmptyState';
import { Skeleton } from '../../src/components/feedback/Skeleton';
import { Button } from '../../src/components/core/Button';
import { ScreenShell } from './ScreenShell';

const meta = { title: 'Screens/States', parameters: { layout: 'fullscreen' } } satisfies Meta;
export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyCollections: Story = {
  render: () => (
    <ScreenShell active="collections">
      <EmptyState
        mascot="sleepy"
        title="No collections yet"
        body='No collections yet. Click "New collection" to create one, "Import" to restore from a previous export, or save items directly from any entity page.'
        actions={
          <>
            <Button icon={Plus}>New collection</Button>
            <Button variant="secondary" icon={Upload}>
              Import
            </Button>
          </>
        }
      />
    </ScreenShell>
  ),
};
export const Loading: Story = {
  render: () => (
    <ScreenShell active="mobs">
      <div style={{ maxWidth: 640 }}>
        <Skeleton rows={6} />
      </div>
    </ScreenShell>
  ),
};
export const NotFound: Story = {
  render: () => (
    <ScreenShell active="home">
      <EmptyState
        mascot="wave"
        title="Page not found"
        body="The page you were looking for doesn't exist."
        actions={<Button icon={ArrowLeft}>Back home</Button>}
      />
    </ScreenShell>
  ),
};
