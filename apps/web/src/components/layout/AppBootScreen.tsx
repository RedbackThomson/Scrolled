import { Loader2 } from 'lucide-react';

/** Full-screen placeholder while the library status resolves and setup redirect runs. */
export function AppBootScreen() {
  return (
    <div
      className="bg-background text-foreground fixed inset-0 z-50 flex flex-col items-center justify-center"
      aria-busy
      role="status"
    >
      <div className="flex flex-col items-center gap-5">
        <p className="text-2xl font-semibold tracking-tight">Scrolled</p>
        <Loader2 className="text-primary h-7 w-7 animate-spin" aria-hidden />
        <p className="text-muted-foreground sr-only">Loading</p>
      </div>
    </div>
  );
}
