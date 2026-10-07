import { Minus, Plus, Scan } from 'lucide-react';
import { Panel, useReactFlow } from '@xyflow/react';
import { IconButton } from '@scrolled/design';

/** Floating zoom stack: zoom in, zoom out, fit the whole graph. */
export function ZoomControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  return (
    <Panel position="bottom-left">
      <div className="bg-card shadow-float flex flex-col gap-0.5 rounded-full p-1">
        <IconButton
          icon={Plus}
          label="Zoom in"
          variant="ghost"
          size={32}
          onClick={() => void zoomIn()}
        />
        <IconButton
          icon={Minus}
          label="Zoom out"
          variant="ghost"
          size={32}
          onClick={() => void zoomOut()}
        />
        <IconButton
          icon={Scan}
          label="Fit to view"
          variant="ghost"
          size={32}
          onClick={() => void fitView()}
        />
      </div>
    </Panel>
  );
}
