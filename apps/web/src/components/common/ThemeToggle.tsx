import { Moon, Sun } from 'lucide-react';
import { Button } from '@scrolled/ui';
import { useTheme } from '@scrolled/ui';

export function ThemeToggle() {
  const theme = useTheme((s) => s.theme);
  const toggle = useTheme((s) => s.toggle);
  const Icon = theme === 'dark' ? Sun : Moon;
  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}
