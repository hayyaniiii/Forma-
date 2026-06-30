import { useCallback, useRef, useState } from 'react';
import { IconUpload } from '@tabler/icons-react';
import { EXT_LIST_BY_CATEGORY, payloadToFiles } from '../utils';

export default function DropZone({ category, onFiles, disabled, extensions }) {
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);
  const folderRef = useRef(null);
  const extList = extensions ?? EXT_LIST_BY_CATEGORY[category];

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      setDragOver(false);
      if (disabled) return;
      if (e.dataTransfer?.files?.length) onFiles(e.dataTransfer.files);
    },
    [disabled, onFiles]
  );

  const browse = async (folder) => {
    if (window.electronAPI) {
      const payload = folder
        ? await window.electronAPI.openFolder({ extensions: extList })
        : await window.electronAPI.openFiles({ extensions: extList });
      if (payload?.length) onFiles(payloadToFiles(payload));
      return;
    }
    if (folder) folderRef.current?.click();
    else inputRef.current?.click();
  };

  const accept = extList?.map((e) => `.${e}`).join(',') || '*/*';

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-14 transition-ui ${
        dragOver
          ? 'border-discord-accent bg-discord-accent/[0.08]'
          : 'border-discord-border bg-discord-panel'
      } ${disabled ? 'pointer-events-none opacity-50' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        multiple
        accept={accept}
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={folderRef}
        type="file"
        multiple
        webkitdirectory=""
        directory=""
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length) onFiles(e.target.files);
          e.target.value = '';
        }}
      />

      <IconUpload
        size={44}
        stroke={1.5}
        className={dragOver ? 'text-discord-accent' : 'text-discord-muted'}
      />
      <p className="mt-4 text-lg font-semibold text-discord-text">Drop files or a folder</p>

      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={() => browse(false)}
          className="rounded-lg bg-discord-accent px-5 py-2.5 text-sm font-medium text-white transition-ui hover:bg-discord-accentHover active:scale-[0.97]"
        >
          Browse files
        </button>
        <button
          type="button"
          onClick={() => browse(true)}
          className="rounded-lg border border-discord-border bg-discord-input px-5 py-2.5 text-sm font-medium text-discord-text transition-ui hover:bg-discord-elevated active:scale-[0.97]"
        >
          Browse folder
        </button>
      </div>
    </div>
  );
}
