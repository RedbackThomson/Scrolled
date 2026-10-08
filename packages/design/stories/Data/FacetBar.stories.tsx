import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Gauge, Layers, TextSearch, Users } from 'lucide-react';
import { FacetBar, type FacetBarFacet } from '../../src/components/data/FacetBar';
import { SuggestionList, type SuggestionItem } from '../../src/components/data/SuggestionList';
import { Histogram } from '../../src/components/data/Histogram';
import { RangeSlider } from '../../src/components/forms/RangeSlider';
import { Popover } from '../../src/components/overlays/Popover';
import { SAMPLE_LEVEL_BINS } from '../samplePresets';

const FACETS: FacetBarFacet[] = [
  { id: 'type', label: 'Type', hue: 235 },
  { id: 'class', label: 'Class', hue: 300 },
  { id: 'level', label: 'Req Lvl', hue: 148 },
  { id: 'atk', label: 'ATK', hue: 185 },
  { id: 'element', label: 'Element', hue: 35 },
];

const ENUMS: Record<string, string[]> = {
  type: ['Claw', 'Dagger', 'Bow', 'Staff', 'Wand'],
  class: ['Thief', 'Warrior', 'Bowman', 'Magician', 'Pirate'],
};

function suggestFor(token: string): SuggestionItem[] {
  const t = token.trim().toLowerCase();
  if (!t) return [];
  const out: SuggestionItem[] = [];
  const range = t.match(/^(\d{1,3})\s*-\s*(\d{1,3})$/);
  if (range)
    out.push({
      id: `level:${t}`,
      icon: Gauge,
      hue: 148,
      label: 'Req Lvl',
      value: `${range[1]} – ${range[2]}`,
      count: '212 weapons',
    });
  if (t.length >= 2)
    for (const [id, values] of Object.entries(ENUMS))
      for (const v of values)
        if (v.toLowerCase().startsWith(t))
          out.push({
            id: `${id}:${v}`,
            icon: id === 'type' ? Layers : Users,
            hue: id === 'type' ? 235 : 300,
            label: id === 'type' ? 'Type' : 'Class',
            value: v,
            count: `${(v.length * 7) % 60} weapons`,
          });
  out.push({
    id: `q:${t}`,
    icon: TextSearch,
    hue: 235,
    label: 'Name contains',
    value: `“${token.trim()}”`,
    count: '3 weapons',
  });
  return out.slice(0, 6);
}

function Demo({
  initial,
  initialQuery = '',
}: {
  initial: Record<string, string>;
  initialQuery?: string;
}) {
  const [values, setValues] = useState(initial);
  const [query, setQuery] = useState(initialQuery);
  const [focused, setFocused] = useState(initialQuery !== '');
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState<string | null>(null);
  const [level, setLevel] = useState<[number, number]>([30, 50]);
  const [chips, setChips] = useState([{ id: 'slots', label: 'Slots', value: '7', hue: 260 }]);

  const token = query.split(/\s+/).pop() ?? '';
  const items = suggestFor(token);
  const apply = (item: SuggestionItem) => {
    const [col] = item.id.split(':');
    if (col !== 'q') setValues((x) => ({ ...x, [col]: String(item.value) }));
    setQuery(query.slice(0, query.length - token.length).trimEnd());
    setActive(0);
  };

  return (
    <div style={{ width: 960, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <FacetBar
        facets={FACETS.map((f) => ({ ...f, valueLabel: values[f.id] }))}
        chips={chips}
        query={query}
        onQueryChange={(q) => {
          setQuery(q);
          setActive(0);
        }}
        openId={open}
        onOpenFacet={(id) => setOpen(open === id ? null : id)}
        onOpenMore={() => setOpen(open === 'more' ? null : 'more')}
        onClear={(id) => {
          setValues(({ [id]: _, ...rest }) => rest);
          setChips((c) => c.filter((x) => x.id !== id));
        }}
        shortcut="/"
        inputProps={{
          onFocus: () => setFocused(true),
          onBlur: () => setFocused(false),
          onKeyDown: (e) => {
            if (e.key === 'ArrowDown') setActive((i) => Math.min(items.length - 1, i + 1));
            else if (e.key === 'ArrowUp') setActive((i) => Math.max(0, i - 1));
            else if (e.key === 'Enter' && items[active]) apply(items[active]);
            else return;
            e.preventDefault();
          },
        }}
      >
        {focused && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 120,
              width: 440,
              zIndex: 5,
            }}
          >
            <SuggestionList
              items={items}
              activeIndex={active}
              onHighlight={setActive}
              onSelect={apply}
              examples={query === '' ? ['claw 30-50', 'thief', 'atk > 20', '7 slots'] : undefined}
            />
          </div>
        )}
        {open === 'level' && (
          <Popover
            arrow="top"
            arrowLeft={200}
            style={{
              position: 'absolute',
              top: 'calc(100% + 12px)',
              right: 120,
              width: 330,
              borderRadius: 18,
              zIndex: 5,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <b style={{ font: '600 16px var(--font-display)' }}>Req Lvl</b>
                <span style={{ fontSize: 12.5, color: 'var(--text-2)' }}>38 match</span>
              </div>
              <Histogram bins={SAMPLE_LEVEL_BINS} min={0} max={140} range={level} />
              <RangeSlider
                min={0}
                max={140}
                value={level}
                label="Req Lvl"
                onChange={(v) => {
                  setLevel(v);
                  setValues((x) => ({ ...x, level: `${v[0]} – ${v[1]}` }));
                }}
                quickRanges={[
                  { label: 'Beginner (0–10)', value: [0, 10] },
                  { label: 'First Job (10–30)', value: [10, 30] },
                  { label: 'Second Job (30–70)', value: [30, 70] },
                ]}
              />
            </div>
          </Popover>
        )}
      </FacetBar>
    </div>
  );
}

const meta = {
  title: 'Data/FacetBar',
  component: FacetBar,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta<typeof FacetBar>;
export default meta;
type Story = StoryObj<typeof meta>;

const noop = () => {};
const base = {
  facets: FACETS,
  query: '',
  onQueryChange: noop,
  onOpenFacet: noop,
  onClear: noop,
  onOpenMore: noop,
};

export const Empty: Story = {
  args: base,
  decorators: [
    (Story) => (
      <div style={{ width: 960 }}>
        <Story />
      </div>
    ),
  ],
};

/** Two active facets while typing "thi"; ↑/↓ and ↵ pick a suggestion. Backspace in the empty field walks back through active facets. */
export const ActiveAndTyping: Story = {
  args: base,
  render: () => <Demo initial={{ type: 'Claw', class: 'Thief' }} initialQuery="thi" />,
};

/** Click Req Lvl for its histogram popover; drag the thumbs or pick a quick range. */
export const ValuePopover: Story = {
  args: base,
  render: () => <Demo initial={{ type: 'Claw' }} />,
  decorators: [
    (Story) => (
      <div style={{ minHeight: 420 }}>
        <Story />
      </div>
    ),
  ],
};
