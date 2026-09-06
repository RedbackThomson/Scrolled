import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { HelpCircle, Pencil, Plus, RotateCcw, X } from 'lucide-react';
import { getDbClient } from '@/db';
import { EntityAvatar } from '@/components/entity-display/EntityAvatar';
import { useMagicStats } from './useMagicStats';
import { useMagicLoadout } from './useMagicLoadout';
import { DEFAULT_MAGIC_STATS, type MagicStats } from './magicStats';

const FIELD =
  'border-border bg-background focus-visible:ring-primary/60 h-8 w-full rounded-md border px-2 text-sm focus-visible:outline-none focus-visible:ring-2';

export function MagicStatsPanel() {
  const stats = useMagicStats();
  if (stats.loading) {
    return <p className="text-muted-foreground text-sm">Loading…</p>;
  }
  return <MagicStatsForm value={stats.value} onChange={stats.set} onReset={stats.reset} />;
}

function MagicStatsForm({
  value,
  onChange,
  onReset,
}: {
  value: MagicStats;
  onChange: (next: MagicStats) => Promise<void>;
  onReset: () => Promise<void>;
}) {
  const [form, setForm] = useState<MagicStats>(value);
  const loadout = useMagicLoadout();

  const patch = (next: Partial<MagicStats>) => {
    const merged = { ...form, ...next };
    setForm(merged);
    void onChange(merged);
  };

  const reset = () => {
    setForm(DEFAULT_MAGIC_STATS);
    void onReset();
  };

  return (
    <div className="border-border bg-card text-card-foreground space-y-4 rounded-md border p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm font-medium">Magic damage</div>
          <p className="text-muted-foreground mt-0.5 text-xs">
            Pick your weapon and attacking spell and enter your stats. Each monster page then shows
            the minimum magic attack needed to defeat it in a single hit.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="text-muted-foreground hover:text-foreground inline-flex shrink-0 items-center gap-1 text-xs"
        >
          <RotateCcw className="h-3 w-3" /> Reset
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Attacking spell">
          <EntityPicker
            kind="skill"
            noun="spell"
            valueId={form.skillId}
            onSelect={(id) => patch({ skillId: id })}
            onClear={() => patch({ skillId: null })}
            footer={
              form.skillId !== null ? (
                <SpellLevelSelect
                  skillId={form.skillId}
                  level={form.skillLevel}
                  onChange={(n) => patch({ skillLevel: n })}
                />
              ) : null
            }
          />
        </Field>
        <Field label="Weapon">
          <EntityPicker
            kind="weapon"
            noun="weapon"
            valueId={form.weaponId}
            onSelect={(id) => patch({ weaponId: id })}
            onClear={() => patch({ weaponId: null })}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Total INT">
          <NumberInput value={form.totalInt} min={0} onChange={(n) => patch({ totalInt: n })} />
        </Field>
        <Field label="Character Lvl">
          <NumberInput
            value={form.characterLevel}
            min={1}
            onChange={(n) => patch({ characterLevel: n })}
          />
        </Field>
        <Field label="Element Amplification %" hint="100 = none">
          <NumberInput
            value={form.amplificationPct}
            min={0}
            onChange={(n) => patch({ amplificationPct: n })}
          />
        </Field>
      </div>

      {loadout.missingBasePower && (
        <p className="text-muted-foreground text-xs">
          That spell has no magic attack at level {form.skillLevel} — pick an attacking spell or a
          different level.
        </p>
      )}
      {loadout.loadout && (
        <p className="text-muted-foreground text-xs">
          Using spell power {loadout.basePower}
          {loadout.spellElement ? ` · ${loadout.spellElement}` : ''}
          {loadout.loadout.hits > 1 ? ` · ${loadout.loadout.hits} hits` : ''}
          {loadout.loadout.wandBonus !== 1
            ? ` · weapon ×${loadout.loadout.wandBonus.toFixed(2)}`
            : ''}
          .
        </p>
      )}
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-1">
      <span className="text-muted-foreground flex items-center gap-1 text-xs uppercase tracking-wide">
        {label}
        {hint && (
          <span title={hint} aria-label={hint} className="inline-flex cursor-help">
            <HelpCircle className="h-3 w-3" />
          </span>
        )}
      </span>
      {children}
    </label>
  );
}

function NumberInput({
  value,
  min = 0,
  onChange,
}: {
  value: number;
  min?: number;
  onChange: (n: number) => void;
}) {
  // Local text so the field can be emptied/retyped; clamping happens on blur
  // rather than on each keystroke (which would snap `""` back to the minimum).
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);

  return (
    <input
      type="text"
      inputMode="numeric"
      value={text}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw !== '' && !/^\d+$/.test(raw)) return;
        setText(raw);
        if (raw !== '') onChange(Number(raw));
      }}
      onBlur={() => {
        const n = Number(text);
        const next = text === '' || !Number.isFinite(n) ? min : Math.max(min, n);
        setText(String(next));
        onChange(next);
      }}
      className={FIELD}
    />
  );
}

function EntityPicker({
  kind,
  noun,
  valueId,
  onSelect,
  onClear,
  footer,
}: {
  kind: 'weapon' | 'skill';
  noun: string;
  valueId: number | null;
  onSelect: (id: number) => void;
  onClear: () => void;
  footer?: ReactNode;
}) {
  const client = useMemo(() => getDbClient(), []);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const entity = kind === 'weapon' ? 'equip' : 'skill';

  const selectedQ = useQuery<string | null>({
    queryKey: ['picker-selected', kind, valueId],
    queryFn: async () => {
      const rec =
        kind === 'weapon'
          ? await client.getEquip(valueId as number)
          : await client.getSkill(valueId as number);
      return rec?.name ?? null;
    },
    enabled: valueId !== null,
  });

  const q = query.trim();
  const resultsQ = useQuery<{ id: number; name: string }[]>({
    queryKey: ['picker', kind, q],
    queryFn: async () => {
      const page =
        kind === 'weapon'
          ? await client.listEquips({ kind: 'weapon', search: q, limit: 8 })
          : await client.listSkills({ search: q, limit: 8 });
      return page.rows.map((r) => ({ id: r.id, name: r.name ?? `#${r.id}` }));
    },
    enabled: open && q.length > 0,
  });

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const openSearch = () => {
    setQuery('');
    setOpen(true);
  };

  return (
    <div className="relative" ref={containerRef}>
      {valueId !== null ? (
        <div className="border-border bg-background space-y-2 rounded-md border p-2">
          <div className="flex items-center gap-2.5">
            <EntityAvatar entity={entity} id={valueId} size={36} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{selectedQ.data ?? `#${valueId}`}</div>
              <div className="text-muted-foreground font-mono text-[11px]">#{valueId}</div>
            </div>
            <button
              type="button"
              onClick={openSearch}
              aria-label={`Change ${noun}`}
              title={`Change ${noun}`}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={onClear}
              aria-label={`Clear ${noun}`}
              title={`Clear ${noun}`}
              className="text-muted-foreground hover:text-foreground shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          {footer && <div className="border-border/70 border-t pt-2">{footer}</div>}
        </div>
      ) : (
        <button
          type="button"
          onClick={openSearch}
          className="border-border hover:border-foreground/30 hover:bg-muted/40 text-muted-foreground flex w-full items-center gap-2.5 rounded-md border border-dashed p-2 text-left transition"
        >
          <span className="bg-muted flex h-9 w-9 shrink-0 items-center justify-center rounded-md">
            <Plus className="h-4 w-4" />
          </span>
          <span className="text-sm">Select a {noun}</span>
        </button>
      )}

      {open && (
        <div className="border-border bg-card text-card-foreground absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-md border shadow-md">
          <div className="border-border/70 border-b p-1.5">
            <input
              type="text"
              value={query}
              autoFocus
              placeholder={`Search ${noun}s…`}
              autoComplete="off"
              onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}
              onChange={(e) => setQuery(e.target.value)}
              className={FIELD}
            />
          </div>
          <ul className="max-h-56 overflow-auto py-1">
            {q.length === 0 ? (
              <li className="text-muted-foreground px-2 py-1.5 text-xs">Type to search…</li>
            ) : resultsQ.data?.length ? (
              resultsQ.data.map((r) => (
                <li key={r.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      onSelect(r.id);
                      setOpen(false);
                      setQuery('');
                    }}
                    className="hover:bg-muted flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm"
                  >
                    <EntityAvatar entity={entity} id={r.id} size={22} />
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  </button>
                </li>
              ))
            ) : (
              <li className="text-muted-foreground px-2 py-1.5 text-xs">
                {resultsQ.isLoading ? 'Searching…' : 'No matches'}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}

function SpellLevelSelect({
  skillId,
  level,
  onChange,
}: {
  skillId: number;
  level: number;
  onChange: (n: number) => void;
}) {
  const client = useMemo(() => getDbClient(), []);
  const levelsQ = useQuery<number[]>({
    queryKey: ['db', 'skill', skillId, 'level-numbers'],
    queryFn: async () => {
      const rows = await client.getSkillLevels(skillId);
      return rows.map((r) => r.level).sort((a, b) => a - b);
    },
  });
  const levels = levelsQ.data ?? [];

  // Keep the stored level valid for the chosen spell: clamp into range when the
  // level table loads or the spell changes.
  useEffect(() => {
    if (levels.length === 0) return;
    const min = levels[0]!;
    const max = levels[levels.length - 1]!;
    const valid = levels.includes(level) ? level : Math.min(max, Math.max(min, level));
    if (valid !== level) onChange(valid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelsQ.data, skillId]);

  return (
    <label className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground text-xs uppercase tracking-wide">Level</span>
      <select
        value={levels.includes(level) ? level : ''}
        disabled={levels.length === 0}
        onChange={(e) => onChange(Number(e.target.value))}
        className="border-border bg-background focus-visible:ring-primary/60 h-7 rounded-md border px-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 disabled:opacity-50"
      >
        {levels.length === 0 && <option value="">—</option>}
        {levels.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}
