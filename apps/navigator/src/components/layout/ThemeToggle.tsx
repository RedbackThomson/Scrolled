import { Monitor, Moon, Sun } from 'lucide-react';
import { useTheme, type ThemeMode } from '@scrolled/design';

const ICONS: Record<ThemeMode, typeof Sun> = {
  light: Sun,
  dark: Moon,
  system: Monitor,
};

const LABELS: Record<ThemeMode, string> = {
  light: 'Theme: light',
  dark: 'Theme: dark',
  system: 'Theme: follow system',
};

export function ThemeToggle() {
  const mode = useTheme((s) => s.mode);
  const cycle = useTheme((s) => s.cycle);
  const Icon = ICONS[mode];

  return (
    <button
      type="button"
      aria-label={`${LABELS[mode]} (click to change)`}
      onClick={cycle}
      className="bg-card text-foreground shadow-float ease-spring focus-visible:ring-primary/30 grid h-[38px] w-[38px] flex-none place-items-center rounded-full transition-transform duration-300 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 max-md:h-11 max-md:w-11"
    >
      <Icon className="h-4 w-4" aria-hidden />
    </button>
  );
}
