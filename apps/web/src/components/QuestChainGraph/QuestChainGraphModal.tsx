import { Modal } from '@/components/collections/Modal';
import type {
  QuestChainEdgeRecord,
  QuestChainMemberWithName,
  QuestChainRecord,
} from '@/db';
import { QuestChainGraphCanvas } from './QuestChainGraphCanvas';

interface Props {
  open: boolean;
  onClose: () => void;
  chain: QuestChainRecord;
  members: readonly QuestChainMemberWithName[];
  edges: readonly QuestChainEdgeRecord[];
}

/**
 * Full-viewport modal hosting the chain's dagre-laid-out graph. Modelled on
 * `MapViewerModal` — a big panel with the canvas filling everything, plus
 * a thin title bar with the chain's summary.
 */
export function QuestChainGraphModal({ open, onClose, chain, members, edges }: Props) {
  const description = [
    `${chain.size} quests`,
    `${chain.maxDepth} stages`,
    chain.rootCount > 1 ? `${chain.rootCount} starts` : null,
    chain.hasCycles ? 'contains loop' : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={chain.name}
      description={description}
      panelClassName="flex h-[min(90vh,900px)] w-[min(95vw,1200px)] max-w-none flex-col"
      bodyClassName="flex-1 overflow-hidden p-0"
    >
      <QuestChainGraphCanvas members={members} edges={edges} />
    </Modal>
  );
}
