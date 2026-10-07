import type { ReactNode } from 'react';
import {
  Bookmark,
  House,
  Map as MapIcon,
  Package,
  ScrollText,
  Shield,
  Skull,
  Sparkles,
  Sun,
  Swords,
  Users,
} from 'lucide-react';
import { Logo } from '../../src/components/brand/Logo';
import { IconButton } from '../../src/components/core/IconButton';
import { StatusDot } from '../../src/components/feedback/StatusDot';
import { SearchPill } from '../../src/components/forms/SearchPill';
import { NavItem } from '../../src/components/navigation/NavItem';
import { CloudBackdrop } from '../../src/components/surfaces/CloudBackdrop';

const NAV = [
  { key: 'home', icon: House, label: 'Home' },
  { key: 'items', icon: Package, label: 'Items', children: true },
  { key: 'equips', icon: Shield, label: 'Equips', children: true },
  { key: 'weapons', icon: Swords, label: 'Weapons', children: true },
  { key: 'mobs', icon: Skull, label: 'Mobs' },
  { key: 'npcs', icon: Users, label: 'NPCs' },
  { key: 'maps', icon: MapIcon, label: 'Maps' },
  { key: 'quests', icon: ScrollText, label: 'Quests', children: true },
  { key: 'skills', icon: Sparkles, label: 'Skills' },
  { key: 'collections', icon: Bookmark, label: 'Collections', children: true },
];

/** A static stand-in for the app shell, so screen stories render in context. */
export function ScreenShell({ active, children }: { active: string; children: ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        minHeight: 820,
        background: 'var(--gradient-page)',
        backgroundColor: 'var(--surface-page)',
        overflow: 'hidden',
      }}
    >
      <CloudBackdrop />
      <aside className="relative flex w-[228px] flex-none flex-col gap-3.5 px-3 py-4">
        <div className="px-2 py-0.5">
          <Logo size={34} subtitle="Example dataset" />
        </div>
        <nav className="space-y-0.5">
          {NAV.map((it) => (
            <NavItem
              key={it.key}
              icon={it.icon}
              label={it.label}
              active={it.key === active}
              onToggle={it.children ? () => {} : undefined}
            />
          ))}
        </nav>
        <div className="flex-1" />
        <div className="bg-card shadow-float flex items-center gap-2 rounded-[18px] px-3.5 py-2.5">
          <StatusDot status="ok" label="Database OK" />
          <span className="flex-1" />
          <span className="text-muted-foreground text-[10.5px]">Pre-alpha</span>
        </div>
      </aside>
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <header className="flex h-[68px] items-center gap-3 pl-3 pr-6">
          <SearchPill />
          <div className="flex-1" />
          <IconButton icon={Sun} label="Toggle theme" variant="float" size={38} />
        </header>
        <main style={{ padding: '6px 24px 32px 12px' }}>{children}</main>
      </div>
    </div>
  );
}
