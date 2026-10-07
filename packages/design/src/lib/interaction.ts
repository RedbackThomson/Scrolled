import { useState } from 'react';

export function useHoverPress() {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);
  return {
    hovered,
    pressed,
    bind: {
      onMouseEnter: () => setHovered(true),
      onMouseLeave: () => {
        setHovered(false);
        setPressed(false);
      },
      onMouseDown: () => setPressed(true),
      onMouseUp: () => setPressed(false),
    },
  };
}

export const SPRING =
  'transform var(--dur-base) var(--ease-spring), background var(--dur-fast), box-shadow var(--dur-fast)';

export type SlotTint = 'etc' | 'use' | 'equip' | 'cash' | 'mob' | 'neutral';
