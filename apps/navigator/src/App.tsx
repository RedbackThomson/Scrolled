import { NuqsAdapter } from 'nuqs/adapters/react';

import { AppShell } from '@/components/layout/AppShell';
import { GraphCanvas } from '@/components/graph/GraphCanvas';
import { DirectionsBar } from '@/components/directions/DirectionsBar';
import { DirectionsPanel } from '@/components/directions/DirectionsPanel';
import { useNavGraph } from '@/hooks/useNavGraph';

export function App() {
  return (
    <NuqsAdapter>
      <AppShell>
        <NavigatorBody />
      </AppShell>
    </NuqsAdapter>
  );
}

function NavigatorBody() {
  const graph = useNavGraph();
  return (
    <div className="flex h-full flex-col">
      <DirectionsBar graph={graph} />
      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="min-h-0 min-w-0 flex-1">
          <GraphCanvas graph={graph} />
        </div>
        <DirectionsPanel graph={graph} />
      </div>
    </div>
  );
}
