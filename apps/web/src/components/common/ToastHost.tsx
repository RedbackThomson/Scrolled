import { Toast } from '@scrolled/design';
import { UpdatePrompt } from '@/components/common/UpdatePrompt';
import { useToasts } from '@/stores/toasts';
import { useIsMobile } from '@/hooks/useIsMobile';

/** Bottom-right stack of transient confirmations and the update prompt (bottom-centre on mobile). */
export function ToastHost() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  const isMobile = useIsMobile();
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2 max-md:inset-x-3 max-md:bottom-[calc(12px+env(safe-area-inset-bottom))] max-md:items-stretch"
    >
      <UpdatePrompt />
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <Toast
            block={isMobile}
            icon={t.icon}
            action={t.action?.label}
            onAction={() => {
              t.action?.run();
              dismiss(t.id);
            }}
            onExpire={() => dismiss(t.id)}
          >
            {t.message}
          </Toast>
        </div>
      ))}
    </div>
  );
}
