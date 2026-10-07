import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useMotion, type Backdrop } from '@/stores/motion';

export interface ResolvedMotionPrefs {
  backdrop: Backdrop;
  drift: boolean;
  motion: boolean;
}

/** Motion settings with "follow the device" resolved against prefers-reduced-motion. */
export function useMotionPrefs(): ResolvedMotionPrefs {
  const reduced = useMediaQuery('(prefers-reduced-motion: reduce)');
  const backdrop = useMotion((s) => s.backdrop);
  const drift = useMotion((s) => s.drift);
  const motion = useMotion((s) => s.motion);
  return { backdrop, drift: drift ?? !reduced, motion: motion ?? !reduced };
}
