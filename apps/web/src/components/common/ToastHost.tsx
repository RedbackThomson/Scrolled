import { Toast } from '@scrolled/design';
import { UpdatePrompt } from '@/components/common/UpdatePrompt';
import { useToasts } from '@/stores/toasts';

/** Bottom-right stack of transient confirmations and the update prompt (bottom-centre on mobile). */
export function ToastHost() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex flex-col items-end gap-2 max-md:inset-x-4 max-md:items-center"
    >
      <UpdatePrompt />
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <Toast
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
