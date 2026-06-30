import { useEffect, useRef } from 'react';
import { IconLoader2 } from '@tabler/icons-react';

function trackStatusLabel(track) {
  if (track.error) return 'Failed';
  if (track.done) return track.status === 'Skipped' ? 'Skipped' : 'Done';
  return track.status || 'Starting…';
}

export default function SpotifyQueuePanel({ spotifyState }) {
  const { items, activePlaylist, tracks, overall, downloading, status, error, zipPath, outputFolder } = spotifyState;
  const listEndRef = useRef(null);

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tracks]);

  const showPlaylistPanel = activePlaylist != null;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-2xl border border-discord-border bg-discord-panel p-5">
      <h3 className="mb-4 text-sm font-semibold text-discord-text flex items-center gap-2">
        Download Queue
        {downloading && <IconLoader2 size={14} className="animate-spin text-discord-muted" />}
      </h3>

      <div className="flex-1 overflow-y-auto pr-2 space-y-4">
        {!showPlaylistPanel && items.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-sm text-discord-muted opacity-60">
            <p>No active downloads</p>
          </div>
        )}

        {showPlaylistPanel && (
          <div className="flex flex-col gap-2">
            <div className="mb-1">
               <p className="text-sm font-semibold text-discord-text truncate">{activePlaylist.title || activePlaylist.url}</p>
               <div className="mt-1 flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-discord-muted">
                  Playlist Tracks
                </p>
                {overall && (
                  <span className="text-xs text-discord-muted">
                    {overall.completed}/{overall.total}
                  </span>
                )}
               </div>
            </div>

            {overall && overall.total > 1 && (
              <div className="mb-2 h-1.5 overflow-hidden rounded-full bg-discord-border">
                <div
                  className="shimmer-bar h-full rounded-full transition-all"
                  style={{ width: `${overall.progress}%` }}
                />
              </div>
            )}

            <ul className="space-y-2">
              {tracks.map((track) => (
                <li
                  key={track.id}
                  className="rounded-lg bg-discord-input px-3 py-2.5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="min-w-0 flex-1 truncate text-sm text-discord-text">
                      {track.name}
                    </p>
                    <span
                      className={`shrink-0 text-xs ${
                        track.error
                          ? 'text-discord-red'
                          : track.done
                            ? 'text-discord-green'
                            : 'text-discord-muted'
                      }`}
                    >
                      {trackStatusLabel(track)}
                      {!track.done && !track.error ? ` · ${track.progress}%` : ''}
                    </span>
                  </div>
                  {!track.done && !track.error && (
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-discord-border">
                      <div
                        className="shimmer-bar h-full rounded-full transition-all"
                        style={{ width: `${track.progress}%` }}
                      />
                    </div>
                  )}
                </li>
              ))}
              {downloading && tracks.length === 0 && (
                <li className="px-3 py-2 text-sm text-discord-muted">
                  Preparing playlist download…
                </li>
              )}
              <div ref={listEndRef} />
            </ul>

            {status === 'done' && (
              <div className="mt-2 flex items-center justify-between gap-2 border-t border-discord-border pt-2">
                <span className="text-sm text-discord-green">
                  {zipPath ? 'ZIP saved' : 'Download complete'}
                </span>
                {zipPath && window.electronAPI?.showInFolder ? (
                  <button
                    type="button"
                    onClick={() => window.electronAPI.showInFolder(zipPath)}
                    className="text-sm text-discord-accent hover:underline"
                  >
                    Show ZIP
                  </button>
                ) : (
                  outputFolder &&
                  window.electronAPI?.showInFolder && (
                    <button
                      type="button"
                      onClick={() => window.electronAPI.showInFolder(outputFolder)}
                      className="text-sm text-discord-accent hover:underline"
                    >
                      Open folder
                    </button>
                  )
                )}
              </div>
            )}
            {status === 'error' && error && (
              <p className="mt-2 border-t border-discord-border pt-2 text-sm text-discord-red">
                {error}
              </p>
            )}
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
