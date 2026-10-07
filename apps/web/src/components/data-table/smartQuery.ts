// Type-to-filter: turns the end of the facet bar's text into filter
// suggestions. Deterministic and local — each parser reads the last few
// tokens, so "atk > 20" and "one handed" parse as phrases, and applying
// a suggestion removes exactly the text it consumed.

import { Filter, Gauge, Sigma, TextSearch, ToggleRight, type LucideIcon } from 'lucide-react';
import type { ColumnFilter } from '@/db';
import type { FilterableCol } from './Filterable';
import { columnHue } from './filterSummary';
import type { FacetDef } from './presets';

export const NAME_COLUMN = 'name';
const MAX_SUGGESTIONS = 6;
// Enough for a two-word column name plus an operator and value: "req lvl >= 30".
const MAX_TAIL_TOKENS = 4;
const MIN_PREFIX = 2;
const LEVEL_HUE = 148;

export interface FilterSuggestion {
  id: string;
  columnId: string;
  columnLabel: string;
  valueLabel: string;
  filter: ColumnFilter;
  hue: number;
  icon: LucideIcon;
  /** The text left in the field once this applies */
  remainder: string;
}

type Match = Omit<FilterSuggestion, 'id' | 'remainder'> & { key: string };
type Parser = (phrase: string) => Match[];

/** Tokens with their start offsets; a quoted string is one token. */
function tokenize(text: string): { token: string; start: number }[] {
  return [...text.matchAll(/"[^"]*"?|\S+/g)].map((m) => ({ token: m[0], start: m.index ?? 0 }));
}

const unquote = (s: string) => s.replace(/^"|"$/g, '');
const compact = (s: string) => s.toLowerCase().replace(/[\s._-]+/g, '');

function aliasesFor(col: FilterableCol, facet: FacetDef | undefined): string[] {
  return [...new Set([col.id, col.label, facet?.label].filter(Boolean).map((s) => compact(s!)))];
}

function rangeFilter(min: number | undefined, max: number | undefined): ColumnFilter {
  return { kind: 'range', min, max };
}

function rangeLabel(min: number | undefined, max: number | undefined): string {
  if (min !== undefined && max !== undefined) return min === max ? `${min}` : `${min} – ${max}`;
  return min !== undefined ? `${min}+` : `≤ ${max}`;
}

const RANGE = /^(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)$|^(\d+(?:\.\d+)?)\+$/i;

function parseRange(s: string): { min?: number; max?: number } | null {
  const m = s.trim().match(RANGE);
  if (!m) return null;
  if (m[3] !== undefined) return { min: Number(m[3]) };
  const a = Number(m[1]);
  const b = Number(m[2]);
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

function levelParser(col: FilterableCol, label: string): Parser {
  return (phrase) => {
    const range = parseRange(phrase.replace(/^(lv|lvl|level)\.?\s*/i, ''));
    if (!range) return [];
    return [
      {
        key: `${col.id}:${range.min}-${range.max}`,
        columnId: col.id,
        columnLabel: label,
        valueLabel: rangeLabel(range.min, range.max),
        filter: rangeFilter(range.min, range.max),
        hue: LEVEL_HUE,
        icon: Gauge,
      },
    ];
  };
}

const OPS = '>=|<=|>|<|='; // longest first so ">=" isn't read as ">"

function numberParser(col: FilterableCol, label: string, hue: number, aliases: string[]): Parser {
  const compare = new RegExp(`^(.+?)\\s*(${OPS})\\s*(\\d+(?:\\.\\d+)?)$`);
  const aliasRange = /^(.+?)\s+(\d.*)$/;
  const countOf = /^(\d+(?:\.\d+)?)\s+(.+)$/;
  return (phrase) => {
    let min: number | undefined;
    let max: number | undefined;
    let valueLabel: string;
    const c = phrase.match(compare);
    const r = phrase.match(aliasRange);
    const n = phrase.match(countOf);
    if (c && aliases.includes(compact(c[1]!))) {
      const v = Number(c[3]);
      const op = c[2]!;
      if (op === '>') min = v + 1;
      else if (op === '>=') min = v;
      else if (op === '<') max = v - 1;
      else if (op === '<=') max = v;
      else min = max = v;
      valueLabel = `${op} ${v}`;
    } else if (r && aliases.includes(compact(r[1]!)) && parseRange(r[2]!)) {
      ({ min, max } = parseRange(r[2]!)!);
      valueLabel = rangeLabel(min, max);
    } else if (n && aliases.includes(compact(n[2]!))) {
      min = max = Number(n[1]);
      valueLabel = `${min}`;
    } else {
      return [];
    }
    return [
      {
        key: `${col.id}:${min}-${max}`,
        columnId: col.id,
        columnLabel: label,
        valueLabel,
        filter: rangeFilter(min, max),
        hue,
        icon: Sigma,
      },
    ];
  };
}

function enumParser(col: FilterableCol, label: string, hue: number): Parser {
  const options = (col.enumOptions ?? []).map((value) => {
    const text = col.enumLabel?.(value) ?? value;
    return { value, text, lower: text.toLowerCase() };
  });
  return (phrase) => {
    const q = unquote(phrase).toLowerCase();
    if (q.length < MIN_PREFIX) return [];
    return options
      .filter((o) => o.lower.startsWith(q) || o.lower.split(/\s+/).some((w) => w.startsWith(q)))
      .map((o) => ({
        key: `${col.id}:${o.value}`,
        columnId: col.id,
        columnLabel: label,
        valueLabel: o.text,
        filter: { kind: 'enum', values: [o.value] },
        hue,
        icon: col.icon ?? Filter,
      }));
  };
}

function booleanParser(col: FilterableCol, label: string, hue: number): Parser {
  const labels = col.booleanLabels ?? { trueLabel: col.label, falseLabel: `Not ${col.label}` };
  const options = [
    { n: 1, text: labels.trueLabel },
    { n: 0, text: labels.falseLabel },
  ];
  return (phrase) => {
    const q = unquote(phrase).toLowerCase();
    if (q.length < MIN_PREFIX) return [];
    return options
      .filter((o) => o.text.toLowerCase().startsWith(q))
      .map((o) => ({
        key: `${col.id}:${o.n}`,
        columnId: col.id,
        columnLabel: label,
        valueLabel: o.text,
        filter: rangeFilter(o.n, o.n),
        hue,
        icon: ToggleRight,
      }));
  };
}

const isLevelColumn = (col: FilterableCol, facet: FacetDef | undefined) =>
  !!facet?.aroundMyLevel || /level/i.test(col.id);

/** Parsers for every filterable column, pinned facets first so their suggestions rank higher. */
export function buildParsers(
  filterable: readonly FilterableCol[],
  facets: readonly FacetDef[],
): Parser[] {
  const facetById = new Map(facets.map((f) => [f.columnId, f]));
  const ordered = [
    ...facets.flatMap((f) => filterable.filter((c) => c.id === f.columnId)),
    ...filterable.filter((c) => !facetById.has(c.id)),
  ];
  // Bare ranges like "30-50" go to one column only: the page's level facet.
  const levelCol = ordered.find(
    (c) => c.type === 'number' && isLevelColumn(c, facetById.get(c.id)),
  );
  const parsers: Parser[] = [];
  for (const col of ordered) {
    if (col.id === NAME_COLUMN) continue;
    const facet = facetById.get(col.id);
    const label = facet?.label ?? col.label;
    const hue = facet?.hue ?? columnHue(col.id);
    if (col.type === 'enum') parsers.push(enumParser(col, label, hue));
    else if (col.type === 'boolean') parsers.push(booleanParser(col, label, hue));
    else if (col.type === 'number') {
      if (col === levelCol) parsers.push(levelParser(col, label));
      parsers.push(numberParser(col, label, hue, aliasesFor(col, facet)));
    }
  }
  return parsers;
}

/** Suggestions for the end of `text`, longest phrase first, ending with "Name contains". */
export function suggest(text: string, parsers: readonly Parser[]): FilterSuggestion[] {
  const trimmed = text.trimEnd();
  if (!trimmed.trim()) return [];
  const tokens = tokenize(trimmed);
  const seen = new Set<string>();
  const out: FilterSuggestion[] = [];
  for (let k = Math.min(MAX_TAIL_TOKENS, tokens.length); k >= 1; k--) {
    const start = tokens[tokens.length - k]!.start;
    const phrase = trimmed.slice(start);
    const remainder = trimmed.slice(0, start).trimEnd();
    for (const parse of parsers) {
      for (const m of parse(phrase)) {
        if (seen.has(m.key)) continue;
        seen.add(m.key);
        const { key, ...rest } = m;
        out.push({ ...rest, id: key, remainder });
      }
    }
  }
  const name = unquote(trimmed.trim());
  return [
    ...out.slice(0, MAX_SUGGESTIONS - 1),
    {
      id: `${NAME_COLUMN}:${name}`,
      columnId: NAME_COLUMN,
      columnLabel: 'Name contains',
      valueLabel: `“${name}”`,
      filter: { kind: 'string', mode: 'contains', value: name },
      hue: 235,
      icon: TextSearch,
      remainder: trimmed,
    },
  ];
}

export interface FilterHints {
  /** "Try:" examples for the empty field */
  examples: string[];
  placeholder: string;
}

/** Examples and placeholder drawn from the page's own facets, so each page suggests what it can parse. */
export function filterHints(
  filterable: readonly FilterableCol[],
  facets: readonly FacetDef[],
): FilterHints {
  const byId = new Map(filterable.map((c) => [c.id, c]));
  const pinned = facets.flatMap((f) => {
    const col = byId.get(f.columnId);
    return col ? [{ col, facet: f }] : [];
  });
  const firstEnum = pinned.find(({ col }) => col.type === 'enum' && col.enumOptions?.length);
  const option = firstEnum?.col.enumOptions?.[0];
  const firstBoolean = pinned.find(({ col }) => col.type === 'boolean');
  const word = option
    ? (firstEnum.col.enumLabel?.(option) ?? option).split(/\s+/)[0]!.toLowerCase()
    : firstBoolean
      ? (firstBoolean.col.booleanLabels?.trueLabel ?? firstBoolean.col.label).toLowerCase()
      : undefined;
  const level = pinned.find(({ col, facet }) => col.type === 'number' && isLevelColumn(col, facet));
  const number = pinned.find(
    ({ col, facet }) => col.type === 'number' && !isLevelColumn(col, facet),
  );
  const range = level ? '30-50' : undefined;
  const compare = number ? `${compact(number.facet.label)} > 20` : undefined;

  const examples = [word && range ? `${word} ${range}` : range, word, compare].filter(
    (x): x is string => !!x,
  );
  const quoted = [word, range ?? compare].filter(Boolean).map((x) => `“${x}”`);
  return {
    examples,
    placeholder:
      quoted.length > 0 ? `Filter by name, or type ${quoted.join(', ')}…` : 'Filter by name…',
  };
}
