import { useEffect, useState } from 'react';
import Select from '../ui/Select';
import {
  COMPRESS_DESCRIPTIONS,
  convertButtonLabel,
  outputExt,
} from '../../pdfConfig';
import { convertPdf, downloadZip, estimatePdfCompress, triggerDownload } from '../../api';

export default function PdfOptionsPanel({
  operation,
  epubDirection,
  files,
  setFiles,
  results,
  setResults,
  converting,
  setConverting,
  onToast,
  health,
  pdfOptions,
  setPdfOptions,
}) {
  const [estimate, setEstimate] = useState(null);

  const needsLibreOffice = ['from-docx', 'from-pptx'].includes(operation);
  const loMissing = needsLibreOffice && health && !health.libreoffice;

  const convertible = files.filter(
    (f) =>
      f.status === 'ready' &&
      !f.fileBadge?.match(/encrypted|unsupported|corrupt/)
  );

  const route =
    operation === 'epub-pdf'
      ? epubDirection
      : {
          compress: 'compress',
          'to-docx': 'to-docx',
          'to-pptx': 'to-pptx',
          'from-docx': 'from-docx',
          'from-pptx': 'from-pptx',
        }[operation];

  useEffect(() => {
    if (operation !== 'compress' || !convertible[0]) {
      setEstimate(null);
      return;
    }
    estimatePdfCompress(convertible[0].file, pdfOptions.level).then((mb) => {
      if (mb != null) setEstimate(mb);
    });
  }, [operation, pdfOptions.level, convertible[0]?.id]);

  const buildFormOptions = () => {
    const o = {};
    if (operation === 'compress') o.level = pdfOptions.level;
    if (operation === 'to-docx') o.language = pdfOptions.language;
    if (operation === 'to-pptx') {
      o.slide_per_page = pdfOptions.slidePerPage ? 'true' : 'false';
      o.theme = pdfOptions.pptTheme;
    }
    if (operation === 'from-docx') {
      o.quality = pdfOptions.pdfQuality;
      o.embed_fonts = pdfOptions.embedFonts ? 'true' : 'false';
    }
    if (operation === 'from-pptx') {
      o.layout = pdfOptions.pptLayout;
      o.include_hidden = pdfOptions.includeHidden ? 'true' : 'false';
    }
    if (operation === 'epub-pdf' && epubDirection === 'epub-to-pdf') {
      o.page_size = pdfOptions.pageSize;
      o.font_size = pdfOptions.fontSize;
      o.margins = pdfOptions.margins;
    }
    return o;
  };

  const runConvert = async () => {
    if (loMissing) return;
    setConverting(true);
    const newResults = [...results];
    let ok = 0;

    for (const item of convertible) {
      setFiles((prev) =>
        prev.map((f) =>
          f.id === item.id ? { ...f, status: 'converting', progress: 0 } : f
        )
      );
      try {
        const { blob, filename } = await convertPdf(
          item.file,
          route,
          buildFormOptions(),
          (p) => {
            setFiles((prev) =>
              prev.map((f) => (f.id === item.id ? { ...f, progress: p } : f))
            );
          }
        );
        const result = { blob, filename };
        newResults.push(result);
        setResults([...newResults]);
        triggerDownload(blob, filename);
        ok += 1;
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, status: 'done', progress: 100 } : f
          )
        );
      } catch (err) {
        setFiles((prev) =>
          prev.map((f) =>
            f.id === item.id ? { ...f, status: 'error', error: err.message } : f
          )
        );
      }
    }

    setConverting(false);
    if (ok) onToast?.(`✓ ${ok} file${ok > 1 ? 's' : ''} converted`);
  };

  const doneResults = results.filter(Boolean);

  return (
    <aside className="flex flex-col gap-4 rounded-2xl border border-discord-border bg-discord-panel p-4">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-discord-muted">
        Options
      </h2>

      {operation === 'epub-pdf' && (
        <div className="flex gap-2">
          {[
            { id: 'epub-to-pdf', label: 'EPUB → PDF' },
            { id: 'pdf-to-epub', label: 'PDF → EPUB' },
          ].map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setPdfOptions((p) => ({ ...p, epubDirection: d.id }))}
              className={`flex-1 rounded-full px-3 py-2 text-xs font-medium transition-ui ${
                epubDirection === d.id
                  ? 'bg-discord-accent text-white'
                  : 'border border-discord-border text-discord-secondary'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      )}

      {operation === 'compress' && (
        <>
          <Select
            label="Compression level"
            value={pdfOptions.level}
            onChange={(v) => setPdfOptions((p) => ({ ...p, level: v }))}
            options={[
              { value: 'screen', label: 'Screen (smallest)' },
              { value: 'ebook', label: 'eBook' },
              { value: 'printer', label: 'Printer' },
              { value: 'prepress', label: 'Prepress (highest)' },
            ]}
          />
          <p className="text-xs text-discord-muted">
            {COMPRESS_DESCRIPTIONS[pdfOptions.level]}
          </p>
          {estimate != null && (
            <p className="font-mono text-xs text-discord-muted">~{estimate} MB estimated</p>
          )}
        </>
      )}

      {operation === 'to-docx' && (
        <>
          <Select
            label="Language (OCR)"
            value={pdfOptions.language}
            onChange={(v) => setPdfOptions((p) => ({ ...p, language: v }))}
            options={[
              { value: 'en', label: 'English' },
              { value: 'es', label: 'Spanish' },
              { value: 'fr', label: 'French' },
              { value: 'de', label: 'German' },
            ]}
          />
          <label className="flex items-center gap-2 text-sm text-discord-secondary">
            <input
              type="checkbox"
              checked={pdfOptions.preserveFormatting}
              onChange={(e) =>
                setPdfOptions((p) => ({ ...p, preserveFormatting: e.target.checked }))
              }
              className="accent-discord-accent"
            />
            Preserve original formatting
          </label>
          <p className="text-xs text-discord-muted">
            Complex layouts may not convert perfectly. Tables and columns are supported.
          </p>
        </>
      )}

      {operation === 'to-pptx' && (
        <>
          <label className="flex items-center gap-2 text-sm text-discord-secondary">
            <input
              type="checkbox"
              checked={pdfOptions.slidePerPage}
              onChange={(e) =>
                setPdfOptions((p) => ({ ...p, slidePerPage: e.target.checked }))
              }
              className="accent-discord-accent"
            />
            One slide per PDF page
          </label>
          <Select
            label="Theme"
            value={pdfOptions.pptTheme}
            onChange={(v) => setPdfOptions((p) => ({ ...p, pptTheme: v }))}
            options={[
              { value: 'original', label: 'Keep original' },
              { value: 'white', label: 'Clean white' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
          <p className="text-xs text-discord-muted">
            Complex layouts may not convert perfectly.
          </p>
        </>
      )}

      {operation === 'from-docx' && (
        <>
          <Select
            label="PDF quality"
            value={pdfOptions.pdfQuality}
            onChange={(v) => setPdfOptions((p) => ({ ...p, pdfQuality: v }))}
            options={[
              { value: 'standard', label: 'Standard' },
              { value: 'high', label: 'High Quality Print' },
              { value: 'pdfa', label: 'PDF/A (archival)' },
            ]}
          />
          <label className="flex items-center gap-2 text-sm text-discord-secondary">
            <input
              type="checkbox"
              checked={pdfOptions.embedFonts}
              onChange={(e) =>
                setPdfOptions((p) => ({ ...p, embedFonts: e.target.checked }))
              }
              className="accent-discord-accent"
            />
            Embed all fonts
          </label>
        </>
      )}

      {operation === 'from-pptx' && (
        <>
          <Select
            label="Layout"
            value={pdfOptions.pptLayout}
            onChange={(v) => setPdfOptions((p) => ({ ...p, pptLayout: v }))}
            options={[
              { value: 'slides', label: 'Slides' },
              { value: 'handout2', label: 'Handout (2 per page)' },
              { value: 'handout4', label: 'Handout (4 per page)' },
              { value: 'notes', label: 'Notes' },
            ]}
          />
          <label className="flex items-center gap-2 text-sm text-discord-secondary">
            <input
              type="checkbox"
              checked={pdfOptions.includeHidden}
              onChange={(e) =>
                setPdfOptions((p) => ({ ...p, includeHidden: e.target.checked }))
              }
              className="accent-discord-accent"
            />
            Include hidden slides
          </label>
        </>
      )}

      {operation === 'epub-pdf' && epubDirection === 'epub-to-pdf' && (
        <>
          <Select
            label="Page size"
            value={pdfOptions.pageSize}
            onChange={(v) => setPdfOptions((p) => ({ ...p, pageSize: v }))}
            options={[
              { value: 'A4', label: 'A4' },
              { value: 'Letter', label: 'Letter' },
              { value: 'A5', label: 'A5' },
            ]}
          />
          <label className="block text-sm">
            <span className="text-discord-muted">Font size — {pdfOptions.fontSize}px</span>
            <input
              type="range"
              min={10}
              max={20}
              value={pdfOptions.fontSize}
              onChange={(e) =>
                setPdfOptions((p) => ({ ...p, fontSize: Number(e.target.value) }))
              }
              className="mt-2 w-full accent-discord-accent"
            />
          </label>
          <Select
            label="Margins"
            value={pdfOptions.margins}
            onChange={(v) => setPdfOptions((p) => ({ ...p, margins: v }))}
            options={[
              { value: 'normal', label: 'Normal' },
              { value: 'narrow', label: 'Narrow' },
              { value: 'wide', label: 'Wide' },
            ]}
          />
        </>
      )}

      {operation === 'epub-pdf' && epubDirection === 'pdf-to-epub' && (
        <p className="text-xs text-discord-muted">
          Best results with text-based PDFs. Scanned or image-heavy PDFs may not convert cleanly.
        </p>
      )}

      <button
        type="button"
        disabled={!convertible.length || converting || loMissing}
        onClick={runConvert}
        className="mt-auto w-full rounded-xl bg-discord-accent py-3.5 text-base font-medium text-white transition-ui hover:bg-discord-accentHover active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
      >
        {converting
          ? 'Converting…'
          : convertButtonLabel(operation, convertible.length)}
      </button>

      {doneResults.length > 1 && (
        <button
          type="button"
          onClick={() => downloadZip(doneResults)}
          className="w-full rounded-xl border border-discord-border py-2.5 text-sm transition-ui hover:bg-discord-input"
        >
          Download All as ZIP
        </button>
      )}
    </aside>
  );
}
