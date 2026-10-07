import { Moon, Sun } from 'lucide-react';
import { IconButton, useTheme } from '@scrolled/design';

export function ThemeToggle() {
  const theme = useTheme((s) => s.theme);
  const toggle = useTheme((s) => s.toggle);
  const Icon = theme === 'dark' ? Sun : Moon;
  return (
    <IconButton
      icon={Icon}
      variant="float"
      size={38}
      label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      onClick={toggle}
    />
  );
}
