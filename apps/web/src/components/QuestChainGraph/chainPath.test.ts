import { describe, expect, it } from 'vitest';
import { shortestPathTo } from './chainPath';

const e = (fromQuestId: number, toQuestId: number) => ({ fromQuestId, toQuestId });

describe('shortestPathTo', () => {
  it('takes the fewest hops from any start', () => {
    const edges = [e(1, 2), e(2, 3), e(3, 4), e(1, 4), e(9, 4)];
    const path = shortestPathTo(4, [1, 9], edges);
    expect([...path.edgeKeys]).toHaveLength(1);
    expect(path.questIds.has(4)).toBe(true);
  });

  it('walks back through intermediate quests', () => {
    const path = shortestPathTo(3, [1], [e(1, 2), e(2, 3)]);
    expect([...path.questIds].sort()).toEqual([1, 2, 3]);
    expect([...path.edgeKeys].sort()).toEqual(['1-2', '2-3']);
  });

  it('survives cycles and self-loops', () => {
    const path = shortestPathTo(3, [1], [e(1, 2), e(2, 1), e(2, 2), e(2, 3)]);
    expect([...path.edgeKeys].sort()).toEqual(['1-2', '2-3']);
  });

  it('is just the target when no start reaches it', () => {
    const path = shortestPathTo(7, [1], [e(7, 1)]);
    expect([...path.questIds]).toEqual([7]);
    expect(path.edgeKeys.size).toBe(0);
  });

  it('is just the target when it is a start', () => {
    const path = shortestPathTo(1, [1], [e(1, 2)]);
    expect([...path.questIds]).toEqual([1]);
  });
});
