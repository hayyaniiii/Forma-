import { useEffect, useRef, useState } from 'react';
import { IconFolder, IconLink, IconLoader2, IconPlus, IconTrash } from '@tabler/icons-react';
import { downloadSpotifyStream, fetchSpotifyInfo } from '../api';
import { detectSpotifyLinkType, isValidSpotifyUrl, spotifyTypeLabel } from '../spotifyUtils';

function trackStatusLabel(track) {
  if (track.error) return 'Failed';
  if (track.done) return track.status === 'Skipped' ? 'Skipped' : 'Done';
  return track.status || 'Starting…';
}

export default function SpotifyPanel({ health, onToast, spotifyState, setSpotifyState }) {
  const { urlInput, links, items, activePlaylist, fetchingInfo, outputFolder, tracks, overall, downloading, status, error, outputAsZip, zipPath } = spotifyState;

  const setUrlInput = (val) => setSpotifyState(p => ({ ...p, urlInput: typeof val === 'function' ? val(p.urlInput) : val }));
  const setLinks = (val) => setSpotifyState(p => ({ ...p, links: typeof val === 'function' ? val(p.links) : val }));
  const setItems = (val) => setSpotifyState(p => ({ ...p, items: typeof val === 'function' ? val(p.items) : val }));
  const setActivePlaylist = (val) => setSpotifyState(p => ({ ...p, activePlaylist: typeof val === 'function' ? val(p.activePlaylist) : val }));
  const setFetchingInfo = (val) => setSpotifyState(p => ({ ...p, fetchingInfo: typeof val === 'function' ? val(p.fetchingInfo) : val }));
  
  const setOutputFolder = (val) => setSpotifyState(p => ({ ...p, outputFolder: typeof val === 'function' ? val(p.outputFolder) : val }));
  const setTracks = (val) => setSpotifyState(p => ({ ...p, tracks: typeof val === 'function' ? val(p.tracks) : val }));
  const setOverall = (val) => setSpotifyState(p => ({ ...p, overall: typeof val === 'function' ? val(p.overall) : val }));
  const setDownloading = (val) => setSpotifyState(p => ({ ...p, downloading: typeof val === 'function' ? val(p.downloading) : val }));
  const setStatus = (val) => setSpotifyState(p => ({ ...p, status: typeof val === 'function' ? val(p.status) : val }));
  const setError = (val) => setSpotifyState(p => ({ ...p, error: typeof val === 'function' ? val(p.error) : val }));
  const setOutputAsZip = (val) => setSpotifyState(p => ({ ...p, outputAsZip: typeof val === 'function' ? val(p.outputAsZip) : val }));
  const setZipPath = (val) => setSpotifyState(p => ({ ...p, zipPath: typeof val === 'function' ? val(p.zipPath) : val }));
  
  const listEndRef = useRef(null);

  const spotdlOk = health?.spotdl === true;

  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [tracks]);

  useEffect(() => {
    if (health?.downloads_dir && !outputFolder) {
      setOutputFolder(health.downloads_dir);
    }
  }, [health?.downloads_dir]);

  const effectiveFolder = outputFolder || health?.downloads_dir || '';

  const pickFolder = async () => {
    const p = await window.electronAPI?.pickOutputFolder?.();
    if (p) setOutputFolder(p);
  };

  const addLink = async () => {
    const u = urlInput.trim();
    if (!u || !isValidSpotifyUrl(u)) return;
    if (links.some((l) => l.url === u)) return;

    const id = u;
    setLinks((prev) => [
      ...prev,
      { id, url: u, title: null, description: null, type: detectSpotifyLinkType(u), loading: true },
    ]);
    setUrlInput('');

    try {
      setFetchingInfo(true);
      const info = await fetchSpotifyInfo(u);
      setLinks((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
              ...l,
              title: info.title,
              description: info.description,
              type: info.type || l.type,
              loading: false,
            }
            : l
        )
      );
    } catch {
      setLinks((prev) =>
        prev.map((l) =>
          l.id === id ? { ...l, title: null, error: true, loading: false } : l
        )
      );
    } finally {
      setFetchingInfo(false);
    }
  };

  const updateTrack = (event) => {
    setTracks((prev) => {
      const idx = prev.findIndex((t) => t.id === event.id);
      const next = {
        id: event.id,
        name: event.name,
        status: event.status,
        progress: event.progress ?? 0,
        done: event.done ?? false,
        error: event.error ?? false,
      };
      if (idx === -1) return [...prev, next];
      const copy = [...prev];
      copy[idx] = { ...copy[idx], ...next };
      return copy;
    });
  };

  const runDownloads = async () => {
    const toDownload = links.filter((l) => !l.loading);
    if (!toDownload.length) return;
    const folder = effectiveFolder;
    if (!folder) return;

    setDownloading(true);
    setStatus('downloading');
    setItems([]);
    setTracks([]);
    setOverall(null);
    setZipPath(null);
    setActivePlaylist(null);

    for (const link of toDownload) {
      const displayName = link.title || link.url;
      const isPlaylist = link.type === 'playlist' || link.type === 'album';

      if (isPlaylist) {
        setActivePlaylist(link);
        setTracks([]);
        setOverall(null);
        setError(null);
        
        try {
          await downloadSpotifyStream(
            link.url,
            folder,
            {
              onTrack: updateTrack,
              onOverall: setOverall,
              onDone: (data) => {
                if (data.code === 0) {
                  if (data.zip_path) {
                    setZipPath(data.zip_path);
                    onToast?.(`Spotify download saved as ZIP (${data.file_count} tracks)`);
                  } else {
                    onToast?.('Spotify playlist complete');
                  }
                } else {
                  setError(data.error || `Download failed (exit ${data.code})`);
                }
              },
              onError: (message) => setError(message),
            },
            { asZip: outputAsZip }
          );
        } catch (err) {
          setError(err.message);
        }
      } else {
        setItems((prev) => [
          ...prev,
          {
            id: link.url,
            name: displayName,
            url: link.url,
            status: 'converting',
            progress: 0,
            error: null,
          },
        ]);
        try {
          let lastProgress = 0;
          await downloadSpotifyStream(
            link.url,
            folder,
            {
              onTrack: (t) => {
                lastProgress = t.progress;
                setItems((prev) =>
                  prev.map((it) => (it.id === link.url ? { ...it, progress: t.progress } : it))
                );
              },
              onDone: (data) => {
                if (data.code === 0) {
                  setItems((prev) =>
                    prev.map((it) =>
                      it.id === link.url
                        ? { ...it, status: 'done', progress: 100, filename: data.zip_path ? 'ZIP Saved' : 'Saved to Downloads' }
                        : it
                    )
                  );
                } else {
                  setItems((prev) =>
                    prev.map((it) =>
                      it.id === link.url
                        ? { ...it, status: 'error', error: data.error || `Download failed` }
                        : it
                    )
                  );
                }
              },
              onError: (msg) => {
                setItems((prev) =>
                  prev.map((it) =>
                    it.id === link.url
                      ? { ...it, status: 'error', error: msg }
                      : it
                  )
                );
              }
            },
            { asZip: outputAsZip }
          );
        } catch (err) {
          setItems((prev) =>
            prev.map((it) =>
              it.id === link.url
                ? { ...it, status: 'error', error: err.message }
                : it
            )
          );
        }
      }
    }

    setStatus('done');
    setDownloading(false);
  };

  const canDownload = links.length > 0 && effectiveFolder && !downloading && spotdlOk && !links.some((l) => l.loading);
  const showPlaylistPanel = activePlaylist != null;

  return (
    <div className="content-fade flex min-h-0 flex-1 flex-col gap-4">
      <div className="rounded-2xl border border-discord-border bg-discord-panel p-5">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <IconLink
              size={18}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-discord-muted"
            />
            <input
              type="url"
              placeholder="Paste a Spotify link..."
              value={urlInput || ''}
              onChange={(e) => setUrlInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addLink()}
              disabled={fetchingInfo}
              className="w-full rounded-xl border border-discord-border bg-discord-input py-3 pl-10 pr-4 font-mono text-sm text-discord-text outline-none transition-ui focus:border-discord-accent disabled:opacity-50"
            />
          </div>
          <button
            type="button"
            onClick={addLink}
            disabled={fetchingInfo}
            className="flex items-center gap-1 rounded-xl border border-discord-border px-4 text-sm text-discord-accent transition-ui hover:bg-discord-input disabled:opacity-50"
          >
            {fetchingInfo ? (
              <IconLoader2 size={16} className="animate-spin" />
            ) : (
              <IconPlus size={16} />
            )}
            Add
          </button>
        </div>

        {!spotdlOk && (
          <p className="mt-2 text-sm text-discord-yellow">
            spotdl not found — run: py -m pip install spotdl
          </p>
        )}

        {links.length > 0 && (
          <ul className="mt-4 max-h-48 space-y-2 overflow-y-auto">
            {links.map((l) => (
              <li
                key={l.id}
                className="animate-file-in flex items-center gap-3 rounded-lg bg-discord-input px-3 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  {l.loading ? (
                    <div className="flex items-center gap-2">
                      <IconLoader2 size={14} className="animate-spin text-discord-muted" />
                      <span className="text-xs text-discord-muted">Fetching info…</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-discord-text">
                          {l.title || l.url}
                        </p>
                        {l.type && (
                          <span className="shrink-0 rounded-full bg-discord-accent/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-discord-accent">
                            {l.type}
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-discord-muted">
                        {l.error ? (
                          <span className="text-discord-yellow">Info unavailable (will use generic name)</span>
                        ) : (
                          <span className="truncate">{l.description}</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setLinks((prev) => prev.filter((x) => x.id !== l.id));
                    setItems((prev) => prev.filter((x) => x.id !== l.url));
                  }}
                  className="shrink-0 text-discord-muted hover:text-discord-red"
                >
                  <IconTrash size={22} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 block text-sm">
          <span className="text-discord-muted">Output folder</span>
          <div className="mt-1 flex gap-2">
            <p className="min-w-0 flex-1 truncate rounded-lg border border-discord-border bg-discord-input px-3 py-2.5 font-mono text-xs text-discord-secondary">
              {effectiveFolder || 'Loading…'}
            </p>
            <button
              type="button"
              onClick={pickFolder}
              className="rounded-lg border border-discord-border p-2.5 text-discord-muted transition-ui hover:bg-discord-elevated hover:text-discord-text disabled:opacity-40"
              title={window.electronAPI ? 'Choose output folder' : 'Defaults to Downloads'}
            >
              <IconFolder size={18} />
            </button>
          </div>
        </div>

        {links.length > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setLinks([]);
                setItems([]);
                setActivePlaylist(null);
                setTracks([]);
                setOverall(null);
              }}
              className="rounded-lg border border-discord-red bg-discord-red px-3 py-1.5 text-sm font-medium text-white transition-ui hover:bg-transparent hover:text-discord-red"
            >
              Clear queue
            </button>
            <label className="flex items-center gap-2 text-sm text-discord-secondary">
              <input
                type="checkbox"
                checked={outputAsZip}
                onChange={(e) => setOutputAsZip(e.target.checked)}
                className="accent-discord-accent"
              />
              Save as ZIP file
            </label>
          </div>
        )}
      </div>
      
      <button
        type="button"
        disabled={!canDownload}
        onClick={runDownloads}
        className="mt-auto rounded-xl bg-discord-accent py-3 font-medium text-white transition-ui hover:bg-discord-accentHover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {downloading ? 'Downloading…' : 'Download'}
      </button>
    </div>
  );
}
