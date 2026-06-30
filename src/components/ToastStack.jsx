import { IconCheck, IconX } from '@tabler/icons-react';

export default function ToastStack({ toasts, onDismiss }) {
  if (!toasts.length) return null;

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-[100] flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className="animate-toast pointer-events-auto flex items-center gap-2 rounded-lg border border-discord-border bg-discord-panel px-4 py-3 text-sm shadow-lg"
        >
          {t.type === 'success' ? (
            <IconCheck size={18} className="text-discord-green" />
          ) : (
            <IconX size={18} className="text-discord-red" />
          )}
          <span className="text-discord-text">{t.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(t.id)}
            className="ml-2 text-discord-muted hover:text-discord-text"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
