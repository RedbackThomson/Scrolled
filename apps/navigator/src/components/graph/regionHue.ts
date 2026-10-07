import type { GroupId } from '@scrolled/nav-graph';

/** A stable hue per region, so a region keeps its colour across sessions and layouts. */
export function regionHue(groupId: GroupId): number {
  let h = 0;
  for (let i = 0; i < groupId.length; i++) h = (h * 31 + groupId.charCodeAt(i)) >>> 0;
  return h % 360;
}
