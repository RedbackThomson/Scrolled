import { Fragment, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HoverCardSaveFooter } from '@/components/collections';
import { useShowEntityIds } from '@/stores/showEntityIds';
import type { EntityKind } from '@/db';
import { TOOLTIP_REGISTRY } from './registry';
import { resolveModes } from './registry/defaults';
import { useTooltipFieldConfig } from './registry/useTooltipFieldConfig';
import type { AnyTooltipEntityConfig, FieldCtx, TooltipField } from './registry/types';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyField = TooltipField<any, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyCtx = FieldCtx<any, any>;

const EMPTY_EXTRA = Object.freeze({});

type MetaBlock =
  | { kind: 'grid'; fields: AnyField[] }
  | { kind: 'inline'; fields: AnyField[] }
  | { kind: 'line'; field: AnyField };

function buildMetaBlocks(fields: AnyField[]): MetaBlock[] {
  const blocks: MetaBlock[] = [];
  for (const field of fields) {
    const variant = field.metaVariant ?? 'line';
    const last = blocks[blocks.length - 1];
    if (variant === 'gridCell') {
      if (last?.kind === 'grid') last.fields.push(field);
      else blocks.push({ kind: 'grid', fields: [field] });
    } else if (variant === 'inline') {
      if (last?.kind === 'inline') last.fields.push(field);
      else blocks.push({ kind: 'inline', fields: [field] });
    } else {
      blocks.push({ kind: 'line', field });
    }
  }
  return blocks;
}

function renderMetaBlock(block: MetaBlock, ctx: AnyCtx, index: number): ReactNode {
  if (block.kind === 'grid') {
    const cols = Math.min(block.fields.length, 4);
    return (
      <dl
        key={`grid-${index}`}
        className="text-muted-foreground grid gap-1 text-[11px]"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {block.fields.map((f) => (
          <div key={f.key}>
            <dt className="uppercase tracking-wide">{f.short ?? f.label}</dt>
            <dd className="text-foreground">{f.render(ctx)}</dd>
          </div>
        ))}
      </dl>
    );
  }
  if (block.kind === 'inline') {
    return (
      <div key={`inline-${index}`} className="text-muted-foreground text-[11px]">
        {block.fields.map((f, i) => (
          <Fragment key={f.key}>
            {i > 0 && ' · '}
            {f.render(ctx)}
          </Fragment>
        ))}
      </div>
    );
  }
  return <Fragment key={block.field.key}>{block.field.render(ctx)}</Fragment>;
}

export function GenericHoverCard({ entity, id }: { entity: EntityKind; id: number }) {
  const config: AnyTooltipEntityConfig = TOOLTIP_REGISTRY[entity];
  const showIds = useShowEntityIds((s) => s.enabled);
  const { value: overrides } = useTooltipFieldConfig(entity);

  const recordQ = useQuery({
    queryKey: config.queryKey(id),
    queryFn: () => config.fetch(id),
    staleTime: 5 * 60_000,
  });

  // GenericHoverCard is keyed by `entity` at every call site (and in the
  // settings preview), so `config` — and thus which extra-data hook runs — is
  // fixed for the component's lifetime; the hook set never changes across a
  // render.
  const extra = config.useExtraData ? config.useExtraData(id) : EMPTY_EXTRA;

  if (recordQ.isLoading) {
    return <p className="text-muted-foreground text-xs">Loading…</p>;
  }
  if (!recordQ.data) {
    return (
      <p className="text-muted-foreground text-xs">
        {config.idPrefix} {id} not found.
      </p>
    );
  }

  const ctx: AnyCtx = { id, record: recordQ.data, extra, showIds };
  const modes = resolveModes(config, overrides);
  const visible = config.fields.filter((f) => {
    const mode = modes[f.key];
    return mode === 'always' || (mode === 'whenPresent' && f.isPresent(ctx));
  });
  const metaBlocks = buildMetaBlocks(visible.filter((f) => f.zone === 'meta'));
  const bodyFields = visible.filter((f) => f.zone === 'body');

  return (
    <div className="w-72 max-w-[calc(100vw-1rem)] space-y-1.5">
      <div className="flex gap-3">
        {config.renderIcon(recordQ.data, id)}
        <div className="min-w-0 flex-1 space-y-1.5">
          <div>
            {config.renderName(recordQ.data, id)}
            {showIds && (
              <div className="text-muted-foreground font-mono text-[10px]">
                {config.idPrefix} #{id}
              </div>
            )}
          </div>
          {metaBlocks.map((block, i) => renderMetaBlock(block, ctx, i))}
        </div>
      </div>
      {bodyFields.map((f) => (
        <Fragment key={f.key}>{f.render(ctx)}</Fragment>
      ))}
      <HoverCardSaveFooter entityType={entity} entityId={id} />
    </div>
  );
}
