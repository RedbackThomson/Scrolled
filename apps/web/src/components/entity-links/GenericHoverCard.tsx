import { Fragment, type ReactNode } from 'react';
import { HoverCard, HoverCardSurface } from '@scrolled/design';
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
    // Tiles size to their values and share the row, so a big number (12,500,000
    // HP) widens its own tile instead of being truncated.
    return (
      <dl key={`grid-${index}`} className="flex flex-wrap gap-1">
        {block.fields.map((f) => (
          <div
            key={f.key}
            className="flex min-w-[56px] flex-auto flex-col rounded-[10px] bg-white/[.07] px-2 py-1.5"
          >
            <dt
              className="whitespace-nowrap text-[10.5px] font-extrabold uppercase"
              style={{
                color: f.tone === undefined ? 'var(--text-2)' : `oklch(0.78 0.13 ${f.tone})`,
              }}
            >
              {f.short ?? f.label}
            </dt>
            <dd className="font-display whitespace-nowrap text-[15px] font-semibold tabular-nums">
              {f.render(ctx)}
            </dd>
          </div>
        ))}
      </dl>
    );
  }
  if (block.kind === 'inline') {
    return (
      <div
        key={`inline-${index}`}
        className="text-muted-foreground flex flex-wrap items-center gap-x-1 text-xs"
      >
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

  if (recordQ.isLoading || !recordQ.data) {
    return (
      <HoverCardSurface>
        <p className="text-muted-foreground p-3 text-xs">
          {recordQ.isLoading ? 'Loading…' : `${config.idPrefix} ${id} not found.`}
        </p>
      </HoverCardSurface>
    );
  }

  const ctx: AnyCtx = { id, record: recordQ.data, extra, showIds };
  const modes = resolveModes(config, overrides);
  const visible = config.fields.filter((f) => {
    const mode = modes[f.key];
    return mode === 'always' || (mode === 'whenPresent' && f.isPresent(ctx));
  });
  const metaBlocks = buildMetaBlocks(visible.filter((f) => f.zone === 'meta'));
  // Stat tiles get the card's full width: beside the sprite there's too little
  // room for three tiles once one holds a long number.
  const statBlocks = metaBlocks.filter((b) => b.kind === 'grid');
  const headerBlocks = metaBlocks.filter((b) => b.kind !== 'grid');
  const bodyFields = visible.filter((f) => f.zone === 'body');

  const tile = config.iconTile ?? {};
  return (
    <HoverCard
      media={config.renderIcon(recordQ.data, id)}
      mediaSize={tile.size}
      mediaHue={tile.hue}
      title={
        <>
          {config.renderName(recordQ.data, id)}
          {showIds && (
            <div className="text-muted-foreground font-mono text-[10px] font-normal">
              {config.idPrefix} #{id}
            </div>
          )}
        </>
      }
      below={
        statBlocks.length + bodyFields.length > 0 && (
          <>
            {statBlocks.length > 0 && (
              <div className="space-y-1">
                {statBlocks.map((block, i) => renderMetaBlock(block, ctx, i))}
              </div>
            )}
            {bodyFields.map((f) => (
              <Fragment key={f.key}>{f.render(ctx)}</Fragment>
            ))}
          </>
        )
      }
      footer={
        <HoverCardSaveFooter
          entityType={entity}
          entityId={id}
          entityName={config.nameOf(recordQ.data, id)}
        />
      }
    >
      {headerBlocks.map((block, i) => renderMetaBlock(block, ctx, i))}
    </HoverCard>
  );
}
