import { Monitor, Moon, Sun } from 'lucide-react';
import { Button, useTheme, type ThemeMode } from '@scrolled/ui';

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
    <Button
      variant="ghost"
      size="icon"
      aria-label={`${LABELS[mode]} (click to change)`}
      onClick={cycle}
    >
      <Icon className="h-4 w-4" aria-hidden />
    </Button>
  );
}
