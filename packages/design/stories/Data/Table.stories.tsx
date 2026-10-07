import type { Meta, StoryObj } from '@storybook/react';
import { Sword } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../src/components/data/Table';
import { SlotTile } from '../../src/components/entity/SlotTile';
import { Chip } from '../../src/components/core/Chip';

const ROWS: [string, number, number, number][] = [
  ['Sword', 17, 7, 0],
  ['Gladius', 41, 7, 30],
  ['Paper Blade', 19, 7, 10],
];

/** The table primitive list pages are built on. */
const meta = {
  title: 'Data/Table',
  component: Table,
  tags: ['autodocs'],
} satisfies Meta<typeof Table>;
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-12" />
          <TableHead>Name</TableHead>
          <TableHead>Atk</TableHead>
          <TableHead>Slots</TableHead>
          <TableHead>Req Lv</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {ROWS.map(([name, atk, slots, lv]) => (
          <TableRow key={name}>
            <TableCell>
              <SlotTile icon={Sword} tint="equip" size={36} />
            </TableCell>
            <TableCell className="font-semibold">{name}</TableCell>
            <TableCell className="font-bold tabular-nums">{atk}</TableCell>
            <TableCell>
              <Chip>{slots}</Chip>
            </TableCell>
            <TableCell>{lv}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
};
