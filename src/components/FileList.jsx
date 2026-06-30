import {
  IconFile,
  IconFileMusic,
  IconFileTypePdf,
  IconPhoto,
  IconVideo,
} from '@tabler/icons-react';
import { formatBytes } from '../utils';
import StatusBadge from './StatusBadge';

function FileIcon({ ext }) {
  const s = 20;
  if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext)) return <IconVideo size={s} />;
  if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) return <IconFileMusic size={s} />;
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'].includes(ext))
    return <IconPhoto size={s} />;
  if (ext === 'pdf') return <IconFileTypePdf size={s} />;
  return <IconFile size={s} />;
}

export default function FileList({ files, onRemove, onClear }) {
  if (!files.length) return null;

  return (
    <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-discord-border bg-discord-panel">
      <div className="flex items-center justify-between border-b border-discord-border px-4 py-3">
        <span className="text-sm font-medium text-discord-secondary">
          {files.length} file{files.length !== 1 ? 's' : ''} queued
        </span>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-discord-muted transition-ui hover:text-discord-text"
        >
          Clear all
        </button>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto p-2">
        {files.map((f) => (
          <li
            key={f.id}
            className="animate-file-in group mb-1 rounded-lg px-3 py-2.5 transition-ui hover:bg-discord-input"
          >
            <div className="flex items-start gap-3">
              <span className="mt-0.5 text-discord-muted">
                <FileIcon ext={f.ext} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate font-mono text-sm text-discord-text">{f.name}</p>
                  <StatusBadge status={f.status} error={f.error} fileBadge={f.fileBadge} />
                </div>
                <p className="text-xs text-discord-muted">
                  {formatBytes(f.size)} · .{f.ext}
                </p>
                {f.status === 'converting' && (
                  <div className="mt-2 h-2 overflow-hidden rounded-full bg-discord-border">
                    <div
                      className="shimmer-bar h-full rounded-full transition-all"
                      style={{ width: `${f.progress}%` }}
                    />
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onRemove(f.id)}
                className="no-drag shrink-0 rounded px-2 py-1 text-lg text-discord-muted opacity-0 transition-ui hover:bg-discord-elevated hover:text-discord-red group-hover:opacity-100"
              >
                ×
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
