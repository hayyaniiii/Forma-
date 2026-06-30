import { useState } from 'react';
import { IconFolder } from '@tabler/icons-react';
import { convertFile, downloadZip, triggerDownload } from '../api';
import Select from './ui/Select';
import { estimateCompressedMb, formatBytes } from '../utils';

const AUDIO_BITRATES = ['96', '128', '192', '256', '320'];
const VIDEO_QUALITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
];
const YT_RES = ['1080', '720', '480', '360'];
const COMPRESS_PRESETS = [
  { value: 'low', label: 'Low', q: 50 },
  { value: 'medium', label: 'Medium', q: 75 },
  { value: 'high', label: 'High', q: 88 },
  { value: 'lossless', label: 'Lossless', q: 100 },
];

export default function OptionsPanel({
  category,
  outputs,
  targetFormat,
  setTargetFormat,
  quality,
  setQuality,
  targetSizeMb,
  setTargetSizeMb,
  sizeUnit,
  setSizeUnit,
  extractAudio,
  setExtractAudio,
  audioBitrate,
  setAudioBitrate,
  videoQuality,
  setVideoQuality,
  ytResolution,
  setYtResolution,
  ytAudioBitrate,
  setYtAudioBitrate,
  imageWidth,
  setImageWidth,
  imageHeight,
  setImageHeight,
  lockAspect,
  setLockAspect,
  files,
  setFiles,
  results,
  setResults,
  converting,
  setConverting,
  onToast,
}) {
  const [outputFolder, setOutputFolder] = useState('Downloads (browser default)');

  const queued = files.filter((f) => f.status === 'queued' || f.status === 'ready');
  const canConvert = category !== 'youtube' && queued.length > 0;
  const doneResults = results.filter(Boolean);

  const targetMbDisplay =
    sizeUnit === 'KB' ? targetSizeMb / 1024 : targetSizeMb;
  const estimated = estimateCompressedMb(files, targetMbDisplay);

  const pickFolder = async () => {
    const p = await window.electronAPI?.pickOutputFolder?.();
    if (p) setOutputFolder(p);
  };

  const runConvert = async () => {
    setConverting(true);
    const newResults = [...results];
    let ok = 0;

    const crfMap = { low: 28, medium: 23, high: 18 };

    for (const item of queued) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === item.id ? { ...f, status: 'converting', progress: 0, error: null } : f
        )
      );

      try {
        const fmt =
          category === 'compress'
            ? item.ext || 'jpg'
            : extractAudio && category === 'video'
              ? 'mp3'
              : targetFormat;

        const q =
          category === 'video'
            ? crfMap[videoQuality] ?? quality
            : category === 'compress'
              ? quality
              : quality;

        const sizeMb =
          category === 'compress'
            ? sizeUnit === 'KB'
              ? targetSizeMb / 1024
              : targetSizeMb
            : undefined;

        const { blob, filename } = await convertFile(
          item.file,
          {
            category,
            targetFormat: fmt,
            quality: q,
            targetSizeMb: sizeMb,
            extractAudio,
          },
          (p) => {
            setFiles((prev) =>
              prev.map((f) => (f.id === item.id ? { ...f, progress: p } : f))
            );
          }
        );

        const result = { blob, filename, sourceName: item.name };
        newResults.push(result);
        setResults([...newResults]);
        ok += 1;

        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, status: 'done', progress: 100, result } : f
          )
        );
        triggerDownload(blob, filename);
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, status: 'error', error: err.message } : f
          )
        );
      }
    }

    setConverting(false);
    if (ok > 0) onToast?.(`✓ ${ok} file${ok > 1 ? 's' : ''} converted`);
  };

  const formatOptions = outputs
    .filter((o) => o !== 'same')
    .map((o) => ({ value: o, label: `.${o}` }));

  const buttonLabel =
    category === 'youtube'
      ? 'Download'
      : queued.length
        ? `Convert ${queued.length} file${queued.length > 1 ? 's' : ''}`
        : 'Convert';

  return (
    <aside className="flex flex-col gap-4 rounded-2xl border border-discord-border bg-discord-panel p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-discord-muted">
        Options
      </h2>

      {category === 'youtube' && (
        <>
          <Select
            label="Format"
            value={targetFormat}
            onChange={setTargetFormat}
            options={[
              { value: 'mp4', label: 'MP4 (video)' },
              { value: 'mp3', label: 'MP3 (audio)' },
            ]}
          />
          {targetFormat === 'mp4' ? (
            <Select
              label="Quality"
              value={ytResolution}
              onChange={setYtResolution}
              options={YT_RES.map((r) => ({
                value: r,
                label: `${r}p`,
              }))}
            />
          ) : (
            <Select
              label="Bitrate"
              value={ytAudioBitrate}
              onChange={setYtAudioBitrate}
              options={AUDIO_BITRATES.map((b) => ({
                value: b,
                label: `${b}k`,
              }))}
            />
          )}
        </>
      )}

      {category === 'compress' && (
        <>
          <label className="block text-sm">
            <span className="text-discord-muted">Target file size</span>
            <div className="mt-1 flex gap-2">
              <input
                type="number"
                min={0.1}
                step={0.1}
                value={targetSizeMb}
                onChange={(e) => setTargetSizeMb(Number(e.target.value))}
                className="flex-1 rounded-lg border border-discord-border bg-discord-input px-3 py-2 outline-none focus:border-discord-accent"
              />
              <div className="flex rounded-lg border border-discord-border bg-discord-input p-0.5">
                {['MB', 'KB'].map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => setSizeUnit(u)}
                    className={`rounded-md px-2 py-1 text-xs transition-ui ${
                      sizeUnit === u
                        ? 'bg-discord-accent text-white'
                        : 'text-discord-muted'
                    }`}
                  >
                    {u}
                  </button>
                ))}
              </div>
            </div>
            {estimated && (
              <p className="mt-1 text-xs text-discord-muted">~{estimated} estimated</p>
            )}
          </label>
          <Select
            label="Quality preset"
            value={videoQuality}
            onChange={(v) => {
              setVideoQuality(v);
              const preset = COMPRESS_PRESETS.find((p) => p.value === v);
              if (preset) setQuality(preset.q);
            }}
            options={COMPRESS_PRESETS.map((p) => ({
              value: p.value,
              label: p.label,
            }))}
          />
        </>
      )}

      {category && !['youtube', 'compress'].includes(category) && (
        <>
          <Select
            label="Output format"
            value={targetFormat}
            onChange={setTargetFormat}
            options={formatOptions}
          />

          {category === 'audio' && (
            <Select
              label="Bitrate"
              value={audioBitrate}
              onChange={setAudioBitrate}
              options={AUDIO_BITRATES.map((b) => ({
                value: b,
                label: `${b}k`,
              }))}
            />
          )}

          {category === 'video' && (
            <>
              <label className="flex items-center gap-2 text-sm text-discord-secondary">
                <input
                  type="checkbox"
                  checked={extractAudio}
                  onChange={(e) => setExtractAudio(e.target.checked)}
                  className="accent-discord-accent"
                />
                Extract audio only
              </label>
              <Select
                label="Quality"
                value={videoQuality}
                onChange={setVideoQuality}
                options={VIDEO_QUALITIES}
              />
            </>
          )}

          {category === 'image' && (
            <>
              <label className="block text-sm">
                <span className="text-discord-muted">Quality — {quality}</span>
                <input
                  type="range"
                  min={1}
                  max={100}
                  value={quality}
                  onChange={(e) => setQuality(Number(e.target.value))}
                  className="mt-2 w-full accent-discord-accent"
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="Width"
                  value={imageWidth}
                  onChange={(e) => setImageWidth(e.target.value)}
                  className="rounded-lg border border-discord-border bg-discord-input px-2 py-1.5 font-mono text-xs"
                />
                <input
                  type="number"
                  placeholder="Height"
                  value={imageHeight}
                  onChange={(e) => setImageHeight(e.target.value)}
                  className="rounded-lg border border-discord-border bg-discord-input px-2 py-1.5 font-mono text-xs"
                />
              </div>
              <label className="flex items-center gap-2 text-xs text-discord-muted">
                <input
                  type="checkbox"
                  checked={lockAspect}
                  onChange={(e) => setLockAspect(e.target.checked)}
                />
                Lock aspect ratio
              </label>
            </>
          )}
        </>
      )}

      {category && category !== 'youtube' && (
        <div className="block text-sm">
          <span className="text-discord-muted">Output folder</span>
          <div className="mt-1 flex gap-2">
            <p className="min-w-0 flex-1 truncate rounded-lg border border-discord-border bg-discord-input px-2 py-2 font-mono text-[11px] text-discord-secondary">
              {outputFolder}
            </p>
            <button
              type="button"
              onClick={pickFolder}
              className="rounded-lg border border-discord-border p-2 text-discord-muted transition-ui hover:bg-discord-elevated hover:text-discord-text"
            >
              <IconFolder size={18} />
            </button>
          </div>
        </div>
      )}

      {category !== 'youtube' && (
        <button
          type="button"
          disabled={!canConvert || converting}
          onClick={runConvert}
          className="mt-auto w-full rounded-xl bg-discord-accent py-3.5 text-base font-medium text-white transition-ui hover:bg-discord-accentHover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {converting ? 'Converting…' : buttonLabel}
        </button>
      )}

      {doneResults.length > 1 && (
        <button
          type="button"
          onClick={() => downloadZip(doneResults)}
          className="w-full rounded-xl border border-discord-border py-2.5 text-sm text-discord-text transition-ui hover:bg-discord-input"
        >
          Download All as ZIP
        </button>
      )}

      {doneResults.length === 1 && (
        <p className="text-center font-mono text-[11px] text-discord-muted">
          Saved {formatBytes(doneResults[0].blob.size)}
        </p>
      )}
    </aside>
  );
}
