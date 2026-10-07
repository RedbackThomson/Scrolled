import { Logo, Scrolly } from '@scrolled/design';

/** Full-screen placeholder while the library status resolves and setup redirect runs. */
export function AppBootScreen() {
  return (
    <div
      className="text-foreground fixed inset-0 z-50 flex flex-col items-center justify-center bg-[var(--surface-page)] bg-[image:var(--gradient-page)]"
      aria-busy
      role="status"
    >
      <div className="flex flex-col items-center gap-5">
        <Logo size={44} />
        <Scrolly pose="read" size={84} />
        <p className="text-muted-foreground sr-only">Loading</p>
      </div>
    </div>
  );
}
