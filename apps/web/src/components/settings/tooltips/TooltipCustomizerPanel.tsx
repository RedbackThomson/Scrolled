import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RotateCcw } from 'lucide-react';
import { cn } from '@scrolled/ui';
import { GenericHoverCard } from '@/components/entity-links';
import {
  TOOLTIP_REGISTRY,
  pruneOverrides,
  resolveModes,
  useTooltipFieldConfig,
  type FieldMode,
} from '@/components/entity-links/registry';
import { ENTITY_KINDS, iconForEntity, labelForEntityKind } from '@/lib/entityRoutes';
import { useFeatures, type Features } from '@/hooks/useFeatures';
import type { EntityKind } from '@/db';
import { FieldModeControl } from './FieldModeControl';
import { EntityPreviewPicker } from './EntityPreviewPicker';

const FEATURE_FOR: Record<EntityKind, keyof Features> = {
  item: 'hasItems',
  equip: 'hasEquips',
  mob: 'hasMobs',
  npc: 'hasNpcs',
  map: 'hasMaps',
  quest: 'hasQuests',
  questChain: 'hasQuestChains',
  skill: 'hasSkills',
};

export function TooltipCustomizerPanel() {
  const features = useFeatures();
  const available = useMemo(
    () => ENTITY_KINDS.filter((entity) => features[FEATURE_FOR[entity]] === true),
    [features],
  );
  const [selected, setSelected] = useState<EntityKind | null>(null);
  const entity = selected && available.includes(selected) ? selected : (available[0] ?? null);

  if (!features.ready) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }
  if (!entity) {
    return (
      <p className="text-muted-foreground text-sm">
        Load a library to customize tooltips.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-1.5">
        {available.map((e) => {
          const Icon = iconForEntity(e);
          const active = e === entity;
          return (
            <button
              key={e}
              type="button"
              onClick={() => setSelected(e)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors',
                active
                  ? 'border-primary bg-primary/10 text-foreground'
                  : 'border-border text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {labelForEntityKind(e)}
            </button>
          );
        })}
      </div>
      <TooltipEditor key={entity} entity={entity} />
    </div>
  );
}

function TooltipEditor({ entity }: { entity: EntityKind }) {
  const config = TOOLTIP_REGISTRY[entity];
  const { value: overrides, set, reset } = useTooltipFieldConfig(entity);
  const [pickedId, setPickedId] = useState<number | null>(null);

  const sampleQ = useQuery({
    queryKey: ['tooltip-sample', entity],
    queryFn: () => config.getSampleId?.() ?? Promise.resolve(null),
    staleTime: Infinity,
  });
  const previewId = pickedId ?? sampleQ.data ?? null;

  const modes = resolveModes(config, overrides);
  const isCustomized = Object.keys(overrides).length > 0;

  const setMode = (key: string, mode: FieldMode) => {
    void set(pruneOverrides(config, { ...overrides, [key]: mode }));
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2">
        <div className="border-border bg-muted/30 flex min-h-[8rem] items-center justify-center rounded-md border p-4">
          {previewId != null ? (
            <GenericHoverCard entity={entity} id={previewId} />
          ) : (
            <p className="text-muted-foreground text-sm">
              No {labelForEntityKind(entity, true).toLowerCase()} to preview.
            </p>
          )}
        </div>
        <EntityPreviewPicker entity={entity} onChange={setPickedId} />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium">Fields</h4>
          <button
            type="button"
            onClick={() => void reset()}
            disabled={!isCustomized}
            className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs disabled:opacity-40"
          >
            <RotateCcw className="h-3 w-3" />
            Reset to defaults
          </button>
        </div>
        <ul className="divide-border divide-y">
          {config.fields.map((field) => (
            <li key={field.key} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <div className="text-sm">{field.label}</div>
                {field.hint && (
                  <p className="text-muted-foreground mt-0.5 text-xs">{field.hint}</p>
                )}
              </div>
              <FieldModeControl value={modes[field.key]} onChange={(m) => setMode(field.key, m)} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
