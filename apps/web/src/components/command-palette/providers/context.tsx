import { CommandGroup, CommandItem as CommandItemPrimitive } from '@/components/ui/command';
import { useCommandPalette } from '@/lib/useCommandPalette';
import type { CommandItem } from '../types';

function matches(query: string, item: CommandItem): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const hay = [item.label, ...(item.keywords ?? [])].join(' ').toLowerCase();
  return hay.includes(q);
}

export function ContextProvider() {
  const contextItems = useCommandPalette((s) => s.contextItems);
  const query = useCommandPalette((s) => s.query);
  const setOpen = useCommandPalette((s) => s.setOpen);

  const visible = contextItems.filter((i) => matches(query, i));
  if (visible.length === 0) return null;

  return (
    <CommandGroup heading="On this page">
      {visible.map((item) => {
        const Icon = item.icon;
        return (
          <CommandItemPrimitive
            key={item.id}
            value={item.value ?? item.id}
            keywords={item.keywords}
            onSelect={async () => {
              await item.onSelect();
              setOpen(false);
            }}
          >
            {Icon && <Icon className="text-muted-foreground h-4 w-4" />}
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.hint && (
              <span className="text-muted-foreground shrink-0 text-xs">{item.hint}</span>
            )}
            {item.shortcut && (
              <span className="text-muted-foreground shrink-0 font-mono text-xs">
                {item.shortcut}
              </span>
            )}
          </CommandItemPrimitive>
        );
      })}
    </CommandGroup>
  );
}
