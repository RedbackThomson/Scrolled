import { afterEach, describe, expect, it } from 'vitest';
import { showToast, useToasts } from './toasts';

afterEach(() => useToasts.setState({ toasts: [] }));

describe('toast store', () => {
  it('adds and dismisses toasts', () => {
    showToast({ message: 'Saved' });
    const [t] = useToasts.getState().toasts;
    expect(t.message).toBe('Saved');
    useToasts.getState().dismiss(t.id);
    expect(useToasts.getState().toasts).toEqual([]);
  });

  it('keeps only the newest few', () => {
    for (const message of ['a', 'b', 'c', 'd']) showToast({ message });
    expect(useToasts.getState().toasts.map((t) => t.message)).toEqual(['b', 'c', 'd']);
  });
});
