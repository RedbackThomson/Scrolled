import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

// Same hues as the map viewer's markers.
export function CountPill({
  icon: Icon,
  hue,
  children,
}: {
  icon: LucideIcon;
  hue: number;
  children: ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[.08] py-[3px] pl-1 pr-2.5 text-[11.5px] font-bold">
      <span
        className="grid h-[18px] w-[18px] place-items-center rounded-full text-white"
        style={{ background: `oklch(0.66 0.16 ${hue})` }}
      >
        <Icon className="h-2.5 w-2.5" aria-hidden />
      </span>
      {children}
    </span>
  );
}
