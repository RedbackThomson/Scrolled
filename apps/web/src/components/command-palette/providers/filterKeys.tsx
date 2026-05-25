import { iconForEntity, labelForEntityKind } from '@/lib/entityRoutes';
import { filterKeyHintsFor, parseFilterQuery, type FilterKeyHint } from '@/lib/filterGrammar';
import { useCommandPalette } from '@/lib/useCommandPalette';

const VALUE_HINT: Record<FilterKeyHint['kind'], string> = {
  number: 'N',
  boolean: 'bool',
  enum: 'enum',
  string: 'text',
};

/**
 * Once the typed query parses to an entity scope (e.g. `equips `), show a
 * compact row of the filter keys that entity accepts so the user doesn't
 * have to read `lib/filterGrammar.ts` to discover that `level:` exists.
 * `?` remains the place for operator syntax and worked examples; this row
 * answers the narrower question "which keys are available right now?".
 */
export function FilterKeysHintProvider() {
  const query = useCommandPalette((s) => s.query);
  const parsed = parseFilterQuery(query);
  if (!parsed.entity) return null;

  const hints = filterKeyHintsFor(parsed.entity);
  if (hints.length === 0) return null;

  const Icon = iconForEntity(parsed.entity);
  const entityLabel = labelForEntityKind(parsed.entity, true);

  return (
    <div className="border-border flex items-center gap-2 border-b px-3 py-2">
      <Icon className="text-muted-foreground h-3.5 w-3.5 shrink-0" aria-hidden />
      <span className="text-muted-foreground text-[10px] font-medium uppercase tracking-wide">
        {entityLabel} filters
      </span>
      <div className="flex min-w-0 flex-wrap gap-1">
        {hints.map((h) => (
          <kbd
            key={h.aliases.join('|')}
            className="bg-muted text-muted-foreground inline-flex h-5 select-none items-center rounded border px-1.5 font-mono text-[10px]"
          >
            {h.aliases.join('|')}:{VALUE_HINT[h.kind]}
          </kbd>
        ))}
      </div>
    </div>
  );
}
