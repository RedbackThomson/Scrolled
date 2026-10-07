import type { ReactNode } from 'react';
import { Sidebar } from '../../src/components/navigation/Sidebar';
import { TopBar } from '../../src/components/navigation/TopBar';
import { CloudBackdrop } from '../../src/components/surfaces/CloudBackdrop';
import { SAMPLE_NAV } from '../sampleNav';

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
      <Sidebar items={SAMPLE_NAV} active={active} subtitle="Example dataset" />
      <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
        <TopBar />
        <main style={{ padding: '6px 24px 32px 12px' }}>{children}</main>
      </div>
    </div>
  );
}
