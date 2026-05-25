import { Filter } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  CommandGroup,
  CommandItem as CommandItemPrimitive,
} from '@/components/ui/command';
import { iconForEntity, labelForEntityKind } from '@/lib/entityRoutes';
import { buildFilterUrl, parseFilterQuery } from '@/lib/filterGrammar';
import { useCommandPalette } from '@/lib/useCommandPalette';

function describeParams(params: Record<string, string>): string {
  const parts: string[] = [];
  for (const [k, v] of Object.entries(params)) {
    if (k === 'boss') {
      parts.push(v === '1' ? 'boss' : 'non-boss');
    } else if (k.startsWith('f_') && k.endsWith('_min')) {
      const col = k.slice(2, -4);
      const max = params[`f_${col}_max`];
      if (max != null && max !== v) parts.push(`${col} ${v}–${max}`);
      else if (max === v) parts.push(`${col} = ${v}`);
      else parts.push(`${col} ≥ ${v}`);
    } else if (k.startsWith('f_') && k.endsWith('_max')) {
      const col = k.slice(2, -4);
      if (params[`f_${col}_min`] != null) continue;
      parts.push(`${col} ≤ ${v}`);
    } else if (k.startsWith('f_')) {
      parts.push(`${k.slice(2)}: ${v}`);
    } else {
      parts.push(`${k}: ${v}`);
    }
  }
  return parts.join(', ');
}

export function FilterProvider() {
  const navigate = useNavigate();
  const setOpen = useCommandPalette((s) => s.setOpen);
  const query = useCommandPalette((s) => s.query);

  const parsed = parseFilterQuery(query);
  if (!parsed.entity || !parsed.hasFilters) return null;

  const url = buildFilterUrl(parsed.entity, parsed.params);
  const Icon = iconForEntity(parsed.entity);
  const summary = describeParams(parsed.params);
  const entityLabel = labelForEntityKind(parsed.entity, true);

  return (
    <CommandGroup heading="Filter">
      <CommandItemPrimitive
        value="filter-go"
        keywords={[entityLabel, summary]}
        onSelect={() => {
          navigate(url);
          setOpen(false);
        }}
      >
        <Filter className="text-muted-foreground h-4 w-4" />
        <span className="min-w-0 flex-1 truncate">
          Filter {entityLabel}: <span className="text-muted-foreground">{summary}</span>
        </span>
        <Icon className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
      </CommandItemPrimitive>
    </CommandGroup>
  );
}
