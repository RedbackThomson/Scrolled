import { describe, expect, it } from 'vitest';
import type { WzNodeTree } from '@/parser';
import {
  childToNumber,
  childToString,
  indexChildrenByName,
  nodeToNumber,
  scalarToNumber,
  scalarToString,
} from './wzCoerce';

const leaf = (name: string, scalar: string | number | null): WzNodeTree =>
  ({ name, scalar, children: [] }) as unknown as WzNodeTree;

describe('scalarToNumber', () => {
  it('passes through numbers and parses numeric strings', () => {
    expect(scalarToNumber(42)).toBe(42);
    expect(scalarToNumber('7')).toBe(7);
    expect(scalarToNumber('-3.5')).toBe(-3.5);
  });
  it('returns null for non-numeric, empty, or missing values', () => {
    expect(scalarToNumber('abc')).toBeNull();
    expect(scalarToNumber(null)).toBeNull();
    expect(scalarToNumber(undefined)).toBeNull();
  });
});

describe('scalarToString', () => {
  it('returns strings, null otherwise', () => {
    expect(scalarToString('hi')).toBe('hi');
    expect(scalarToString(5)).toBeNull();
    expect(scalarToString(undefined)).toBeNull();
  });
});

describe('nodeToNumber', () => {
  it('reads a node scalar, tolerating an absent node', () => {
    expect(nodeToNumber(leaf('hp', '120'))).toBe(120);
    expect(nodeToNumber(undefined)).toBeNull();
  });
});

describe('tree-child helpers', () => {
  const parent = {
    name: 'info',
    children: [leaf('level', '15'), leaf('name', 'Slime'), leaf('bad', 'x')],
  } as unknown as WzNodeTree;

  it('childToNumber / childToString resolve named children', () => {
    expect(childToNumber(parent, 'level')).toBe(15);
    expect(childToString(parent, 'name')).toBe('Slime');
    expect(childToNumber(parent, 'bad')).toBeNull();
    expect(childToNumber(parent, 'missing')).toBeNull();
    expect(childToNumber(undefined, 'level')).toBeNull();
  });

  it('indexChildrenByName builds a name lookup', () => {
    const idx = indexChildrenByName(parent.children);
    expect(idx.get('name')?.scalar).toBe('Slime');
    expect(idx.size).toBe(3);
  });
});
