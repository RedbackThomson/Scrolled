import { useEffect, useState, type ReactNode } from 'react';
import { List, Loader2 } from 'lucide-react';
import { Modal } from '@/components/collections';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@scrolled/design';
import { useIsMobile } from '@/hooks/useIsMobile';
import { GraphicViewerCanvas } from './GraphicViewerCanvas';
import { GraphicViewerLayerControls } from './GraphicViewerLayerControls';
import type { GraphicViewerView, LayerDescriptor, LayerVisibility } from './types';

interface SidebarCtx {
  visible: LayerVisibility;
  enableLayer: (key: string) => void;
  /** Present only inside the mobile sheet — lets the sidebar auto-dismiss it. */
  closeMobile?: () => void;
}

interface OverlayCtx {
  view: GraphicViewerView;
  visible: LayerVisibility;
  /** Reveal the browse sidebar — opens the bottom sheet on mobile; on desktop
   *  the sidebar is always visible, so this is a no-op there. */
  openSidebar: () => void;
}

interface GraphicViewerModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  /** Leading header tile, usually a 38px SlotTile. */
  icon?: ReactNode;
  /** Data still loading — shows a spinner instead of the canvas. */
  isLoading?: boolean;
  loadingMessage?: string;
  image: Uint8Array | null;
  ariaLabel: string;
  imageUnavailableMessage?: string;
  imageLoadingMessage?: string;
  scrollKey?: string | number | null;
  /** Toggleable overlay layers; omit for a viewer with no layer bar. */
  layers?: LayerDescriptor[];
  /** Chrome overlaid at the top-left of the canvas (e.g. a back control). */
  toolbar?: ReactNode;
  /** Desktop sidebar + mobile-sheet body. Omit for a canvas-only viewer. */
  sidebar?: (ctx: SidebarCtx) => ReactNode;
  mobileSheetTitle?: string;
  overlays: (ctx: OverlayCtx) => ReactNode;
}

function seedVisibility(layers: LayerDescriptor[] | undefined): LayerVisibility {
  const out: LayerVisibility = {};
  for (const l of layers ?? []) out[l.key] = true;
  return out;
}

export function GraphicViewerModal({
  open,
  onClose,
  title,
  description,
  icon,
  isLoading,
  loadingMessage = 'Loading…',
  image,
  ariaLabel,
  imageUnavailableMessage,
  imageLoadingMessage,
  scrollKey,
  layers,
  toolbar,
  sidebar,
  mobileSheetTitle = 'Browse',
  overlays,
}: GraphicViewerModalProps) {
  const isMobile = useIsMobile();
  const [visible, setVisible] = useState<LayerVisibility>(() => seedVisibility(layers));
  const [browserOpen, setBrowserOpen] = useState(false);

  // Reconcile visibility when the layer set changes — keep existing toggles,
  // default any newly-introduced layer to on.
  const layerKeys = (layers ?? []).map((l) => l.key).join('|');
  useEffect(() => {
    setVisible((prev) => {
      const next: LayerVisibility = {};
      for (const l of layers ?? []) next[l.key] = prev[l.key] ?? true;
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerKeys]);

  // Close the mobile browser sheet when the modal closes.
  useEffect(() => {
    if (!open) setBrowserOpen(false);
  }, [open]);

  const enableLayer = (key: string) => {
    setVisible((v) => (v[key] ? v : { ...v, [key]: true }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      icon={icon}
      panelClassName="w-[95vw] h-[90vh] max-w-[1600px] max-md:h-[100dvh] max-md:w-screen max-md:max-w-none max-md:rounded-none"
      bodyClassName="flex min-h-0 flex-1 flex-col"
    >
      {isLoading ? (
        <div className="bg-muted text-muted-foreground flex flex-1 items-center justify-center gap-2 text-[13px]">
          <Loader2 className="text-primary h-4 w-4 animate-spin" /> {loadingMessage}
        </div>
      ) : (
        <div className="relative flex min-h-0 min-w-0 flex-1">
          {!isMobile && sidebar && sidebar({ visible, enableLayer })}
          <div className="relative flex min-h-0 min-w-0 flex-1">
            {toolbar && <div className="absolute left-4 top-4 z-20">{toolbar}</div>}
            <GraphicViewerCanvas
              image={image}
              ariaLabel={ariaLabel}
              unavailableMessage={imageUnavailableMessage}
              loadingMessage={imageLoadingMessage}
              scrollKey={scrollKey}
            >
              {(view) => overlays({ view, visible, openSidebar: () => setBrowserOpen(true) })}
            </GraphicViewerCanvas>
            {layers && layers.length > 0 && (
              <div className="absolute bottom-4 left-4 right-20 z-10 md:right-16">
                <GraphicViewerLayerControls layers={layers} value={visible} onChange={setVisible} />
              </div>
            )}
            {isMobile && sidebar && (
              <>
                <button
                  type="button"
                  onClick={() => setBrowserOpen(true)}
                  aria-label={mobileSheetTitle}
                  className="bg-primary text-primary-foreground shadow-float focus-visible:ring-primary/30 absolute bottom-4 right-4 z-10 inline-flex h-12 w-12 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-4"
                >
                  <List className="h-5 w-5" aria-hidden />
                </button>
                <Sheet open={browserOpen} onOpenChange={setBrowserOpen}>
                  <SheetContent side="bottom" className="bg-card flex h-[70dvh] flex-col p-0">
                    <SheetHeader className="border-muted border-b-2 px-4 py-3">
                      <SheetTitle className="font-display text-[17px]">{mobileSheetTitle}</SheetTitle>
                    </SheetHeader>
                    <div className="flex min-h-0 flex-1 flex-col">
                      {sidebar({ visible, enableLayer, closeMobile: () => setBrowserOpen(false) })}
                    </div>
                  </SheetContent>
                </Sheet>
              </>
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}
