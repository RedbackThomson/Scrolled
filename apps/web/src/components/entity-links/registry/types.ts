import type { ReactNode } from 'react';
import type { EntityKind } from '@/db';

export type FieldMode = 'always' | 'never' | 'whenPresent';

/** Order used by the settings 3-way control. */
export const FIELD_MODES: readonly FieldMode[] = ['always', 'whenPresent', 'never'];

/**
 * Where a field sits in the fixed tooltip skeleton and how the shell lays it
 * out. `meta` fields render in the column beside the icon; `body` fields render
 * full-width below the header. `metaVariant` groups consecutive meta fields:
 * `gridCell` runs merge into one reflowing stat grid, `inline` runs join on one
 * line separated by " · ", and `line` renders standalone (and breaks a run).
 */
export type MetaVariant = 'gridCell' | 'inline' | 'line';

export interface FieldCtx<TRecord, TExtra> {
  id: number;
  record: TRecord;
  extra: TExtra;
  /** The global "Show entity IDs" toggle, for fields that inline the id. */
  showIds: boolean;
}

export interface TooltipField<TRecord, TExtra> {
  /** Stable id persisted in user config. Renaming needs a migration map. */
  key: string;
  /** Settings-UI label ("Attack", "Element resistances"). */
  label: string;
  /** Optional longer help text under the settings control. */
  hint?: string;
  zone: 'meta' | 'body';
  /** Required for `zone: 'meta'`; ignored otherwise. */
  metaVariant?: MetaVariant;
  /** Short header shown as the `<dt>` for `gridCell` fields (e.g. "Lvl").
   *  Falls back to `label`. */
  short?: string;
  defaultMode: FieldMode;
  /** True when the field has meaningful content for this record. */
  isPresent: (ctx: FieldCtx<TRecord, TExtra>) => boolean;
  /** For `gridCell`, return the `<dd>` value; for `inline`/`line`/`body`,
   *  return the whole element. Called only when the field is shown. */
  render: (ctx: FieldCtx<TRecord, TExtra>) => ReactNode;
}

export type EmptyExtra = Record<string, never>;

export interface TooltipEntityConfig<TRecord, TExtra = EmptyExtra> {
  entity: EntityKind;
  /** Word used in the id line, loading/not-found copy (e.g. "Chain"). */
  idPrefix: string;
  fetch: (id: number) => Promise<TRecord | null>;
  queryKey: (id: number) => readonly unknown[];
  /** Hook for secondary data (npc maps, quest chain, jobs map). Must obey the
   *  rules of hooks — the shell keys `GenericHoverCard` by entity so the hook
   *  set stays stable across an entity switch. */
  useExtraData?: (id: number) => TExtra;
  /** Fixed anchors — never customizable. */
  renderIcon: (record: TRecord, id: number) => ReactNode;
  renderName: (record: TRecord, id: number) => ReactNode;
  /** Resolve a representative id to seed the settings preview, or null when
   *  the library holds none of this type. */
  getSampleId?: () => Promise<number | null>;
  fields: TooltipField<TRecord, TExtra>[];
}

// The registry aggregates heterogeneous per-entity configs (each strongly
// typed against its own record) into one map, so the value type must erase the
// record/extra generics. `any` is confined to this aggregation boundary; the
// per-entity configs and the generic renderer's ctx are typed at their edges.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyTooltipEntityConfig = TooltipEntityConfig<any, any>;
