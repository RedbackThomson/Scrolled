import { useMemo, useState } from 'react';
import {
  Button,
  CommandDialog,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from '@scrolled/ui';
import { ChevronDown } from 'lucide-react';
import type { AreaNode, NavGraph, NodeId } from '@scrolled/nav-graph';

export interface NodePickerProps {
  label: string;
  graph: NavGraph;
  value: NodeId | null;
  onChange: (id: NodeId | null) => void;
}

export function NodePicker({ label, graph, value, onChange }: NodePickerProps) {
  const [open, setOpen] = useState(false);
  const nodes = useMemo(() => sortedNodes(graph), [graph]);
  const current = value ? graph.nodes.get(value) : undefined;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="h-auto w-full justify-between gap-2 py-2"
      >
        <span className="flex min-w-0 flex-col items-start leading-tight">
          <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wider">
            {label}
          </span>
          <span className="truncate text-sm">{current?.name ?? 'Pick a place'}</span>
        </span>
        <ChevronDown className="text-muted-foreground h-4 w-4 shrink-0" aria-hidden />
      </Button>
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
