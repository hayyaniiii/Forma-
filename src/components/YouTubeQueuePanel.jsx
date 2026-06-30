import { IconLoader2 } from '@tabler/icons-react';

export default function YouTubeQueuePanel({ youtubeState }) {
  const { items, converting } = youtubeState;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-discord-border bg-discord-panel p-5">
      <h3 className="mb-4 text-sm font-semibold text-discord-text flex items-center gap-2">
        Download Queue
        {converting && <IconLoader2 size={14} className="animate-spin text-discord-muted" />}
      </h3>

      <div className="flex-1 overflow-y-auto pr-2 space-y-4">
        {items.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-sm text-discord-muted opacity-60">
            <p>No active downloads</p>
          </div>
        )}

        {items.length > 0 && (
          <ul className="space-y-2">
            {items.map((it) => (
              <li key={it.id} className="rounded-lg bg-discord-input px-3 py-2.5">
                <div className="flex items-start justify-between gap-3">
                  <p className="min-w-0 flex-1 truncate text-sm text-discord-text">
                    {it.name}
                  </p>
                  <span
                    className={`shrink-0 text-xs ${
                      it.status === 'error'
                        ? 'text-discord-red'
                        : it.status === 'done'
                          ? 'text-discord-green'
                          : 'text-discord-muted'
                    }`}
                  >
                    {it.status === 'error' ? 'Failed' : it.status === 'done' ? 'Done' : 'Converting…'}
                    {it.status === 'converting' ? ` · ${it.progress}%` : ''}
                  </span>
                </div>
                {it.status === 'converting' && (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-discord-border">
                    <div className="shimmer-bar h-full rounded-full transition-all" style={{ width: `${it.progress}%` }} />
                  </div>
                )}
                {it.status === 'done' && (
                  <div className="mt-1 text-xs text-discord-green truncate">{it.filename}</div>
                )}
                {it.status === 'error' && (
                  <div className="mt-1 text-xs text-discord-red truncate" title={it.error}>{it.error}</div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
