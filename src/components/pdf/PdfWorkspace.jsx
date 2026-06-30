import { useCallback, useEffect, useState } from 'react';
import {
  IconBook,
  IconFileTypeDocx,
  IconFileTypePdf,
  IconFileZip,
  IconPresentation,
} from '@tabler/icons-react';
import DropZone from '../DropZone';
import FileList from '../FileList';
import PdfOptionsPanel from './PdfOptionsPanel';
import { inspectPdf, openExternal } from '../../api';
import {
  acceptedExts,
  hintForOperation,
  PDF_OPERATIONS,
} from '../../pdfConfig';
import { extOf } from '../../utils';

const OP_ICONS = {
  compress: IconFileZip,
  'to-docx': IconFileTypeDocx,
  'to-pptx': IconPresentation,
  'from-docx': IconFileTypeDocx,
  'from-pptx': IconPresentation,
  'epub-pdf': IconBook,
};

const LO_URL = 'https://www.libreoffice.org/download/download-libreoffice/';

export default function PdfWorkspace({ health, onToast }) {
  const [operation, setOperation] = useState('compress');
  const [files, setFiles] = useState([]);
  const [results, setResults] = useState([]);
  const [converting, setConverting] = useState(false);
  const [pdfOptions, setPdfOptions] = useState({
    level: 'ebook',
    language: 'en',
    preserveFormatting: true,
    slidePerPage: true,
    pptTheme: 'original',
    pdfQuality: 'standard',
    embedFonts: true,
    pptLayout: 'slides',
    includeHidden: false,
    pageSize: 'A4',
    fontSize: 14,
    margins: 'normal',
    epubDirection: 'epub-to-pdf',
  });

  const epubDirection = pdfOptions.epubDirection;
  const exts = acceptedExts(operation, epubDirection);
  const hint = hintForOperation(operation, epubDirection);

  const needsLo = ['from-docx', 'from-pptx'].includes(operation);
  const showLoBanner = needsLo && health && !health.libreoffice;

  const validateFile = useCallback(
    async (file, ext) => {
      let fileBadge = null;
      let error = null;

      if (!exts.includes(ext)) {
        return {
          fileBadge: 'unsupported',
          error: `Not accepted for this operation (need ${hint})`,
          status: 'ready',
        };
      }

      if (ext === 'pdf') {
        const info = await inspectPdf(file, operation);
        if (info.encrypted) {
          return { fileBadge: 'encrypted', error: 'Remove password protection first', status: 'ready' };
        }
        if (info.corrupt) {
          return { fileBadge: 'corrupt', error: 'Invalid or corrupt PDF', status: 'ready' };
        }
        if (info.large) fileBadge = 'large';
        if (
          info.image_only &&
          (operation === 'to-docx' || operation === 'to-pptx')
        ) {
          fileBadge = fileBadge || 'image-based';
        }
      }

      return { fileBadge, error, status: 'ready' };
    },
    [exts, hint, operation]
  );

  const addFiles = useCallback(
    async (incoming) => {
      const list = Array.from(incoming);
      const mapped = await Promise.all(
        list.map(async (file) => {
          const ext = extOf(file.name);
          const base = {
            id: `${file.name}-${file.size}-${file.lastModified}`,
            file,
            name: file.name,
            size: file.size,
            ext,
            progress: 0,
            result: null,
          };
          const validation = await validateFile(file, ext);
          return { ...base, ...validation };
        })
      );

      setFiles((prev) => {
        const ids = new Set(prev.map((p) => p.id));
        return [...prev, ...mapped.filter((f) => !ids.has(f.id))];
      });
    },
    [validateFile]
  );

  useEffect(() => {
    if (!files.length) return;
    (async () => {
      for (const f of files) {
        const validation = await validateFile(f.file, f.ext);
        setFiles((prev) =>
          prev.map((x) => (x.id === f.id ? { ...x, ...validation } : x))
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operation, epubDirection]);

  return (
    <div className="content-fade grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_300px]">
      <div className="flex min-h-0 flex-col gap-4">
        {showLoBanner && (
          <div className="rounded-xl border border-discord-yellow/40 bg-discord-yellow/10 px-4 py-3 text-sm text-discord-yellow">
            Word/PowerPoint conversion requires LibreOffice.{' '}
            <button
              type="button"
              onClick={() => openExternal(LO_URL)}
              className="font-medium underline hover:text-discord-text"
            >
              Download LibreOffice ↗
            </button>
          </div>
        )}

        <div className="-mx-1 flex gap-2 overflow-x-auto pb-1">
          {PDF_OPERATIONS.map((op) => {
            const Icon = OP_ICONS[op.id] || IconFileTypePdf;
            const active = operation === op.id;
            return (
              <button
                key={op.id}
                type="button"
                onClick={() => setOperation(op.id)}
                className={`flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-medium transition-ui ${
                  active
                    ? 'bg-discord-accent text-white shadow-tab'
                    : 'border border-discord-border bg-discord-panel text-discord-secondary hover:bg-discord-input'
                }`}
              >
                <Icon size={18} stroke={1.5} />
                {op.label}
              </button>
            );
          })}
        </div>

        <DropZone
          category="pdf"
          extensions={exts}
          onFiles={addFiles}
          disabled={converting}
        />

        <FileList
          files={files}
          onRemove={(id) => setFiles((p) => p.filter((f) => f.id !== id))}
          onClear={() => setFiles([])}
        />
      </div>

      <PdfOptionsPanel
        operation={operation}
        epubDirection={epubDirection}
        files={files}
        setFiles={setFiles}
        results={results}
        setResults={setResults}
        converting={converting}
        setConverting={setConverting}
        onToast={onToast}
        health={health}
        pdfOptions={pdfOptions}
        setPdfOptions={setPdfOptions}
      />
    </div>
  );
}
