import { useState } from 'react';
import { IconLink, IconLoader2, IconPlus, IconTrash } from '@tabler/icons-react';
import { createZipBlob, downloadYoutube, fetchYoutubeInfo, triggerDownload } from '../api';

function formatDuration(seconds) {
  if (!seconds) return '';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function YouTubePanel({
  targetFormat,
  setTargetFormat,
  ytResolution,
  setYtResolution,
  ytAudioBitrate,
  setYtAudioBitrate,
  youtubeState,
  setYoutubeState,
  onToast,
}) {
  const { urlInput, links, items, outputAsZip, fetchingInfo, results, converting } = youtubeState;

  const setUrlInput = (val) => setYoutubeState(p => ({ ...p, urlInput: typeof val === 'function' ? val(p.urlInput) : val }));
  const setLinks = (val) => setYoutubeState(p => ({ ...p, links: typeof val === 'function' ? val(p.links) : val }));
  const setItems = (val) => setYoutubeState(p => ({ ...p, items: typeof val === 'function' ? val(p.items) : val }));
  const setOutputAsZip = (val) => setYoutubeState(p => ({ ...p, outputAsZip: typeof val === 'function' ? val(p.outputAsZip) : val }));
  const setFetchingInfo = (val) => setYoutubeState(p => ({ ...p, fetchingInfo: typeof val === 'function' ? val(p.fetchingInfo) : val }));
  const setResults = (val) => setYoutubeState(p => ({ ...p, results: typeof val === 'function' ? val(p.results) : val }));
  const setConverting = (val) => setYoutubeState(p => ({ ...p, converting: typeof val === 'function' ? val(p.converting) : val }));

  const addLink = async () => {
    const u = urlInput.trim();
    if (!u || (!u.includes('youtube.com') && !u.includes('youtu.be'))) return;
    if (links.some((l) => l.url === u)) return;

    const id = u;
    setLinks((prev) => [
      ...prev,
      { id, url: u, title: null, duration: null, uploader: null, loading: true },
    ]);
    setUrlInput('');

    try {
      setFetchingInfo(true);
      const info = await fetchYoutubeInfo(u);
      setLinks((prev) =>
        prev.map((l) =>
          l.id === id
            ? {
              ...l,
              title: info.title,
              duration: info.duration,
              uploader: info.uploader,
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

  const runDownloads = async () => {
    const toDownload = links.filter((l) => !l.loading);
    if (!toDownload.length) return;
    setConverting(true);
    setResults([]);
    setItems([]);
    const successful = [];

    for (const link of toDownload) {
      const displayName = link.title || link.url;
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
        const { blob, filename } = await downloadYoutube(
          link.url,
          {
            format: targetFormat,
            resolution: ytResolution,
            audioBitrate: ytAudioBitrate,
            title: link.title,
          },
          (p) => {
            setItems((prev) =>
              prev.map((it) => (it.id === link.url ? { ...it, progress: p } : it))
            );
          }
        );
        successful.push({ blob, filename, url: link.url, name: displayName });
        setItems((prev) =>
          prev.map((it) =>
            it.id === link.url
              ? { ...it, status: 'done', progress: 100, filename }
              : it
          )
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

    if (outputAsZip && successful.length > 1) {
      const zipBlob = await createZipBlob(successful);
      setResults([{ blob: zipBlob, filename: 'youtube_downloads.zip' }]);
      await triggerDownload(zipBlob, 'youtube_downloads.zip');
      onToast?.(`✓ ${successful.length} videos saved to ZIP`);
    } else if (successful.length) {
      setResults(successful);
      for (const { blob, filename } of successful) {
        await triggerDownload(blob, filename);
      }
      onToast?.(`${successful.length} download(s) complete`);
    }

    setConverting(false);
  };

  const multipleLinks = links.length > 1;

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
              placeholder="Paste a YouTube link..."
              value={urlInput}
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
                      <p className="truncate text-sm font-medium text-discord-text">
                        {l.title || l.url}
                      </p>
                      <div className="mt-0.5 flex items-center gap-2 text-xs text-discord-muted">
                        {l.error ? (
                          <span className="text-discord-yellow">Info unavailable (will use generic name)</span>
                        ) : (
                          <>
                            {l.uploader && <span>{l.uploader}</span>}
                            {l.uploader && l.duration != null && <span>·</span>}
                            {l.duration != null && <span>{formatDuration(l.duration)}</span>}
                          </>
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
                    setResults((prev) => prev.filter((x) => x.url !== l.url));
                  }}
                  className="shrink-0 text-discord-muted hover:text-discord-red"
                >
                  <IconTrash size={22} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {links.length > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                setLinks([]);
                setItems([]);
                setResults([]);
              }}
              className="rounded-lg border border-discord-red bg-discord-red px-3 py-1.5 text-sm font-medium text-white transition-ui hover:bg-transparent hover:text-discord-red"
            >
              Clear queue
            </button>
            {multipleLinks && (
              <label className="flex items-center gap-2 text-sm text-discord-secondary">
                <input
                  type="checkbox"
                  checked={outputAsZip}
                  onChange={(e) => setOutputAsZip(e.target.checked)}
                  className="accent-discord-accent"
                />
                Save as ZIP file
              </label>
            )}
          </div>
        )}
      </div>

      <button
        type="button"
        disabled={converting || !links.length || links.some((l) => l.loading)}
        onClick={runDownloads}
        className="mt-auto rounded-xl bg-discord-accent py-3 font-medium text-white transition-ui hover:bg-discord-accentHover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {converting ? 'Downloading…' : `Download`}
      </button>
    </div>
  );
}
