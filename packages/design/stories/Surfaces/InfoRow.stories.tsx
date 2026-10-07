import type { Meta, StoryObj } from '@storybook/react';
import { InfoList, InfoRow } from '../../src/components/surfaces/InfoRow';

const meta = {
  title: 'Surfaces/InfoRow',
  component: InfoRow,
  tags: ['autodocs'],
  args: { label: 'Street', value: 'Harbor Road' },
  argTypes: {},
  decorators: [
    (Story) => (
      <div style={{ width: 280 }}>
        <InfoList>
          <Story />
        </InfoList>
      </div>
    ),
  ],
} satisfies Meta<typeof InfoRow>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Mono: Story = { args: { label: 'ID', value: '1000001', mono: true } };

/** Rows in an `InfoList` share the sunken divider. */
export const List: Story = {
  render: () => (
    <>
      <InfoRow label="Street" value="Harbor Road" />
      <InfoRow label="Mob rate" value="1.00" />
      <InfoRow label="ID" value="100000000" mono />
    </>
  ),
};
