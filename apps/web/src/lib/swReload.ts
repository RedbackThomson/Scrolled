// Reload into the latest build, driving the waiting service worker to take
// control first. vite-plugin-pwa's built-in reload can silently never fire (the
// one-shot workbox `controlling` listener may already be consumed), so we skip
// waiting, reload on the next controller change, and fall back to a plain reload
// so the action always completes. Pass `updateServiceWorker` from
// `useRegisterSW()` — keeping the virtual PWA import out of this pure helper.

export function reloadForUpdate(
  updateServiceWorker: (reloadPage?: boolean) => Promise<void>,
): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('controllerchange', () => window.location.reload(), {
      once: true,
    });
  }
  void updateServiceWorker(true);
  window.setTimeout(() => window.location.reload(), 1500);
}
