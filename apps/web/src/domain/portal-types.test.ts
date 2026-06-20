import { describe, expect, it } from 'vitest';
import type { MapPortalRecord } from '@/db';
import { isUsefulPortal, PORTAL_TYPE } from './portal-types';

const THIS_MAP = 100000000;
const NO_TARGET = 999999999;

function portal(overrides: Partial<MapPortalRecord>): MapPortalRecord {
  return {
    mapId: THIS_MAP,
    idx: 0,
    portalName: 'west00',
    targetMapId: 200000000,
    targetPortal: 'east00',
    x: 0,
    y: 0,
    portalType: PORTAL_TYPE.REGULAR,
    script: null,
    ...overrides,
  };
}

describe('isUsefulPortal', () => {
  it('keeps inter-map doorways', () => {
    expect(isUsefulPortal(portal({}), THIS_MAP)).toBe(true);
  });

  it('keeps working in-map teleports', () => {
    expect(
      isUsefulPortal(portal({ targetMapId: THIS_MAP, targetPortal: 'tp01' }), THIS_MAP),
    ).toBe(true);
  });

  it('keeps scripted portals', () => {
    expect(
      isUsefulPortal(portal({ targetMapId: null, targetPortal: null, script: 'onEnter' }), THIS_MAP),
    ).toBe(true);
  });

  it('hides spawn points', () => {
    expect(
      isUsefulPortal(portal({ portalName: 'sp', portalType: PORTAL_TYPE.SPAWN }), THIS_MAP),
    ).toBe(false);
  });

  it('hides GM portals even when they target another map', () => {
    expect(isUsefulPortal(portal({ portalName: 'gm0' }), THIS_MAP)).toBe(false);
    expect(isUsefulPortal(portal({ portalName: 'gm' }), THIS_MAP)).toBe(false);
  });

  it('hides dead-end teleports with no destination', () => {
    expect(
      isUsefulPortal(portal({ portalName: 'tp', targetMapId: NO_TARGET }), THIS_MAP),
    ).toBe(false);
    expect(
      isUsefulPortal(portal({ portalName: 'tp', targetMapId: null, targetPortal: null }), THIS_MAP),
    ).toBe(false);
  });
});
