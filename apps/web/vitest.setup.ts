import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// @testing-library/react's automatic cleanup hooks into `globalThis.afterEach`,
// which only exists when vitest is configured with `globals: true`. This repo
// uses `globals: false`, so wire it up explicitly here.
afterEach(() => {
  cleanup();
});

// jsdom doesn't ship ResizeObserver, but cmdk subscribes to one on mount.
// A no-op stub is enough — none of our tests assert on resize behaviour.
if (typeof globalThis.ResizeObserver === 'undefined') {
  globalThis.ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  } as unknown as typeof ResizeObserver;
}

// jsdom doesn't implement Element.scrollIntoView either; cmdk calls it
// when keyboard-navigating its list. Same no-op approach.
if (typeof Element !== 'undefined' && !Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = function () {};
}
