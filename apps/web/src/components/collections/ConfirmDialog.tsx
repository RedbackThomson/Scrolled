import { Trash2 } from 'lucide-react';
import { Button, SlotTile } from '@scrolled/design';
import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

const DANGER_HUE = 25;

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  pending,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      headerless
      panelClassName="w-full max-w-sm"
      bodyClassName="flex flex-col items-center gap-3 px-6 pb-4 pt-6 text-center"
      footer={
        <>
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="danger"
            className="flex-1"
            onClick={onConfirm}
            disabled={pending}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <SlotTile hue={DANGER_HUE} icon={Trash2} size={56} rimmed />
      <h2 className="font-display text-[19px] font-semibold leading-tight">{title}</h2>
      {message && <p className="text-muted-foreground text-[13px]">{message}</p>}
    </Modal>
  );
}
