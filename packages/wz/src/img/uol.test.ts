import { describe, it, expect } from 'vitest';
import type { WzProperty } from './property';
import { resolveUol } from './uol';

const intProp = (name: string, value: number): WzProperty => ({ type: 'int', name, value });
const subProp = (name: string, children: WzProperty[]): WzProperty => ({
  type: 'sub',
  name,
  children,
});
const uolProp = (name: string, target: string): WzProperty => ({
  type: 'uol',
  name,
  target,
});

describe('resolveUol — synthetic', () => {
  it('resolves a sibling reference', () => {
    const root: WzProperty[] = [
      subProp('info', [
        intProp('iconRef', 99),
        uolProp('icon', '../info/iconRef'),
      ]),
    ];
    const target = resolveUol(root, ['info', 'icon'], '../info/iconRef');
    expect(target?.type).toBe('int');
    expect(target && target.type === 'int' ? target.value : null).toBe(99);
  });

  it('walks up multiple levels with consecutive ..', () => {
    const root: WzProperty[] = [
      subProp('a', [
        subProp('b', [
          subProp('c', [
            uolProp('here', '../../../target'),
          ]),
        ]),
      ]),
      intProp('target', 7),
    ];
    const resolved = resolveUol(root, ['a', 'b', 'c', 'here'], '../../../target');
    expect(resolved?.type).toBe('int');
  });

  it('returns null when the path walks off the top', () => {
    const root: WzProperty[] = [intProp('x', 1)];
    expect(resolveUol(root, ['x'], '../../up-too-far')).toBeNull();
  });

  it('returns null on a missing segment', () => {
    const root: WzProperty[] = [subProp('a', [intProp('b', 1)])];
    expect(resolveUol(root, ['a', 'b'], '../missing')).toBeNull();
  });

  it('follows a UOL chain (sibling-level)', () => {
    const root: WzProperty[] = [
      subProp('group', [
        intProp('finalTarget', 42),
        uolProp('hop1', 'finalTarget'),
        uolProp('hop2', 'hop1'),
      ]),
    ];
    const resolved = resolveUol(root, ['group', 'hop2'], 'hop1');
    expect(resolved?.type).toBe('int');
    expect(resolved && resolved.type === 'int' ? resolved.value : null).toBe(42);
  });

  it('detects cycles and returns null', () => {
    const root: WzProperty[] = [
      subProp('group', [uolProp('a', 'b'), uolProp('b', 'a')]),
    ];
    expect(resolveUol(root, ['group', 'a'], 'b')).toBeNull();
  });
});
