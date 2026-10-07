import type { Meta, StoryObj } from '@storybook/react';
import { ErrorState } from '../../src/components/feedback/ErrorState';

const meta = {
  title: 'Feedback/ErrorState',
  component: ErrorState,
  tags: ['autodocs'],
  args: {
    title: "Couldn't load this mob",
    body: 'The library returned an error. Your data is safe.',
    details: 'SQLITE_BUSY: database is locked',
  },
  argTypes: { onRetry: { action: 'retry' } },
} satisfies Meta<typeof ErrorState>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithoutDetails: Story = { args: { details: undefined } };
