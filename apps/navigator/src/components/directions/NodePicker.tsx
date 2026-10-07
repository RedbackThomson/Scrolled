import { useMemo, useState } from 'react';
import {
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  cn,
} from '@scrolled/design';
import { ChevronDown } from 'lucide-react';
import type { AreaNode, NavGraph, NodeId } from '@scrolled/nav-graph';

export interface NodePickerProps {
  label: string;
  /** Matches the endpoint's colour on the graph: emerald start, sky end. */
  tone: 'from' | 'to';
  graph: NavGraph;
  value: NodeId | null;
  onChange: (id: NodeId | null) => void;
}

const DOT = {
  from: 'bg-[oklch(0.68_0.15_155)]',
  to: 'bg-[oklch(0.68_0.13_230)]',
};

export function NodePicker({ label, tone, graph, value, onChange }: NodePickerProps) {
  const [open, setOpen] = useState(false);
  const nodes = useMemo(() => sortedNodes(graph), [graph]);
  const current = value ? graph.nodes.get(value) : undefined;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="bg-card text-foreground shadow-float ease-spring focus-visible:ring-primary/30 flex h-10 w-full min-w-0 items-center gap-2 rounded-full pl-3.5 pr-3 text-left transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 max-md:h-11"
      >
        <span
          aria-hidden
          className={cn('h-2.5 w-2.5 flex-none rounded-full ring-2 ring-white', DOT[tone])}
        />
        <span className="text-muted-foreground flex-none text-[12px] font-bold">{label}</span>
        <span
          className={cn(
            'min-w-0 flex-1 truncate text-[13.5px] font-semibold',
            !current && 'text-muted-foreground',
          )}
        >
          {current?.name ?? 'Pick a place'}
        </span>
        <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
      </button>
      <CommandDialog open={open} onOpenChange={setOpen} label={`${label} picker`}>
        <CommandInput placeholder={`Find ${label.toLowerCase()}…`} />
        <CommandList>
          <CommandEmpty>No matches.</CommandEmpty>
          {nodes.map((node) => (
            <CommandItem
              key={node.id}
              value={`${node.name} ${node.id}`}
              onSelect={() => {
                onChange(node.id);
                setOpen(false);
              }}
            >
              <span className="flex flex-col">
                <span className="text-sm">{node.name}</span>
                {node.group ? (
                  <span className="text-muted-foreground text-xs">
                    {graph.groups.get(node.group)?.name ?? node.group}
                  </span>
                ) : null}
              </span>
            </CommandItem>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}

function sortedNodes(graph: NavGraph): AreaNode[] {
  return [...graph.nodes.values()].sort((a, b) => a.name.localeCompare(b.name));
}
