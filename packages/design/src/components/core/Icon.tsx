import type { CSSProperties } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface IconProps {
  icon: LucideIcon;
  size?: number;
  color?: string;
  style?: CSSProperties;
}

export function Icon({ icon: Glyph, size = 16, color = 'currentColor', style }: IconProps) {
  return <Glyph aria-hidden size={size} color={color} style={{ flex: 'none', ...style }} />;
}
