import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchFormats, fetchHealth } from './api';
import TitleBar from './components/TitleBar';
import CategoryBar from './components/CategoryBar';
import DropZone from './components/DropZone';
import FileList from './components/FileList';
import OptionsPanel from './components/OptionsPanel';
import YouTubePanel from './components/YouTubePanel';
import YouTubeQueuePanel from './components/YouTubeQueuePanel';
import SpotifyPanel from './components/SpotifyPanel';
import SpotifyQueuePanel from './components/SpotifyQueuePanel';
import PdfWorkspace from './components/pdf/PdfWorkspace';
import ToastStack from './components/ToastStack';
import { useToast } from './hooks/useToast';

const emptyFormats = {
  video: { outputs: ['mp4', 'webm', 'mkv'], extensions: [] },
  audio: { outputs: ['mp3', 'wav', 'flac'], extensions: [] },
  image: { outputs: ['png', 'jpg', 'webp', 'svg'], extensions: [] },
  compress: { outputs: ['same'], extensions: [] },
  youtube: { outputs: ['mp4', 'mp3'], extensions: [] },
  spotify: { outputs: ['mp3'], extensions: [] },
  pdf: { outputs: [], extensions: [] },
};

export default function App() {
  const { toasts, push: toast, dismiss } = useToast();
  const [category, setCategory] = useState(null);
  const [contentKey, setContentKey] = useState(0);
  const [formats, setFormats] = useState(emptyFormats);
  const [health, setHealth] = useState(null);
  const [files, setFiles] = useState([]);
  const [targetFormat, setTargetFormat] = useState('mp4');
  const [quality, setQuality] = useState(85);
  const [targetSizeMb, setTargetSizeMb] = useState(5);
  const [sizeUnit, setSizeUnit] = useState('MB');
  const [extractAudio, setExtractAudio] = useState(false);
  const [audioBitrate, setAudioBitrate] = useState('192');
  const [videoQuality, setVideoQuality] = useState('medium');
  const [ytResolution, setYtResolution] = useState('1080');
  const [ytAudioBitrate, setYtAudioBitrate] = useState('192');
  const [imageWidth, setImageWidth] = useState('');
  const [imageHeight, setImageHeight] = useState('');
  const [lockAspect, setLockAspect] = useState(true);
  const [results, setResults] = useState([]);
  const [converting, setConverting] = useState(false);

  const [youtubeState, setYoutubeState] = useState({
    urlInput: '',
    links: [],
    items: [],
    outputAsZip: false,
    fetchingInfo: false,
    results: [],
    converting: false,
  });

  const [spotifyState, setSpotifyState] = useState({
    urlInput: '',
    links: [],
    items: [],
    activePlaylist: null,
    fetchingInfo: false,
    outputFolder: '',
    tracks: [],
    overall: null,
    downloading: false,
    status: 'idle',
    error: null,
    outputAsZip: false,
    zipPath: null,
  });

  useEffect(() => {
    fetchFormats().then(setFormats).catch(() => {});
    fetchHealth().then(setHealth).catch(() => setHealth({ status: 'error' }));
  }, []);

  const outputs = useMemo(() => {
    const cat = formats[category];
    return cat?.outputs || [];
  }, [formats, category]);

  useEffect(() => {
    if (outputs.length && !outputs.includes(targetFormat)) {
      setTargetFormat(outputs[0]);
    }
  }, [outputs, targetFormat]);

  const validExtensions = useMemo(() => {
    const exts = formats[category]?.extensions;
    if (!exts?.length) return new Set();
    return new Set(exts);
  }, [formats, category]);

  const addFiles = useCallback(
    (incoming) => {
      const list = Array.from(incoming).map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        name: file.name,
        size: file.size,
        ext: file.name.split('.').pop()?.toLowerCase() || '',
        status: 'ready',
        progress: 0,
        error: null,
        result: null,
      }));

      const filtered =
        category && category !== 'youtube' && category !== 'spotify' && category !== 'compress' && validExtensions.size
          ? list.filter((f) => validExtensions.has(f.ext))
          : list;

      setFiles((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        return [...prev, ...filtered.filter((f) => !ids.has(f.id))];
      });
    },
    [category, validExtensions]
  );

  const onCategorySelect = (cat) => {
    setCategory(cat);
    setContentKey((k) => k + 1);
    setFiles([]);
    setResults([]);
    if (cat === 'youtube') setTargetFormat('mp4');
    else if (cat === 'compress') setTargetFormat('same');
    else if (cat === 'image') setTargetFormat('png');
    else if (cat === 'audio') setTargetFormat('mp3');
    else setTargetFormat('mp4');
  };

  const panelProps = {
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
    onToast: toast,
    youtubeState,
    setYoutubeState,
  };

  return (
    <div className="flex h-full flex-col bg-discord-bg text-discord-text">
      <TitleBar health={health} />
      <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden p-5">
        <CategoryBar active={category} onSelect={onCategorySelect} />

        {!category ? (
          <div className="flex flex-1 items-center justify-center rounded-2xl border border-dashed border-discord-border bg-discord-panel p-12 text-center">
            <div>
              <p className="text-lg font-semibold">Choose a conversion type</p>
              <p className="mt-2 text-sm text-discord-muted">
                Video, audio, image, YouTube, Spotify, PDF, or compression — pick a category above.
              </p>
            </div>
          </div>
        ) : category === 'pdf' ? (
          <PdfWorkspace key={contentKey} health={health} onToast={toast} />
        ) : (
          <div
            key={contentKey}
            className="content-fade grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]"
          >
            <div className="flex min-h-0 flex-col gap-4">
              {category === 'youtube' ? (
                <YouTubePanel {...panelProps} />
              ) : category === 'spotify' ? (
                <SpotifyPanel health={health} onToast={toast} spotifyState={spotifyState} setSpotifyState={setSpotifyState} />
              ) : (
                <>
                  <DropZone
                    category={category}
                    onFiles={addFiles}
                    disabled={converting}
                  />
                  <FileList
                    files={files}
                    onRemove={(id) => setFiles((p) => p.filter((f) => f.id !== id))}
                    onClear={() => setFiles([])}
                  />
                </>
              )}
            </div>
            {category === 'youtube' && (youtubeState.items.length > 0 || youtubeState.converting) ? (
              <YouTubeQueuePanel youtubeState={youtubeState} />
            ) : category === 'youtube' ? (
              <OptionsPanel {...panelProps} />
            ) : category === 'spotify' && (spotifyState.items.length > 0 || spotifyState.activePlaylist || spotifyState.downloading) ? (
              <SpotifyQueuePanel spotifyState={spotifyState} />
            ) : category === 'spotify' ? (
              null
            ) : (
              <OptionsPanel {...panelProps} />
            )}
          </div>
        )}
      </main>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
