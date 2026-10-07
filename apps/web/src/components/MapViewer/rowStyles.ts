import { cn } from '@scrolled/design';

export function sidebarRowClass(selected: boolean) {
  return cn(
    'ease-spring flex min-h-[46px] w-full items-center gap-2.5 rounded-[11px] px-1.5 py-1 text-left text-[13px] font-semibold transition-[padding,background-color] duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50',
    selected ? 'bg-muted ring-primary/50 ring-2 ring-inset' : 'hover:bg-accent hover:pl-2.5',
  );
}
