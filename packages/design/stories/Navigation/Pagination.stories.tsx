import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Pagination } from '../../src/components/navigation/Pagination';

const meta = {
  title: 'Navigation/Pagination',
  component: Pagination,
  tags: ['autodocs'],
  args: { page: 1, pageSize: 12, total: 1269 },
  argTypes: { onPage: { action: 'page' } },
  decorators: [
    (Story) => (
      <div style={{ width: 760 }}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof Pagination>;
export default meta;
type Story = StoryObj<typeof meta>;

export const FirstPage: Story = {};
export const Middle: Story = { args: { page: 42 } };
export const LastPage: Story = { args: { page: 106 } };
export const Empty: Story = { args: { total: 0 } };
export const Interactive: Story = {
  render: function Render(args) {
    const [page, setPage] = useState(1);
    return <Pagination {...args} page={page} onPage={setPage} />;
  },
};
