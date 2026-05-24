import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// @testing-library/react's automatic cleanup hooks into `globalThis.afterEach`,
// which only exists when vitest is configured with `globals: true`. This repo
// uses `globals: false`, so wire it up explicitly here.
afterEach(() => {
  cleanup();
});
