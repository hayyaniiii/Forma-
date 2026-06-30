export const PDF_OPERATIONS = [
  { id: 'compress', label: 'Compress PDF', route: 'compress' },
  { id: 'to-docx', label: 'PDF → Word', route: 'to-docx' },
  { id: 'to-pptx', label: 'PDF → PowerPoint', route: 'to-pptx' },
  //{ id: 'from-docx', label: 'Word → PDF', route: 'from-docx' },
  //{ id: 'from-pptx', label: 'PowerPoint → PDF', route: 'from-pptx' },
  { id: 'epub-pdf', label: 'EPUB ↔ PDF', route: null },
];

export const PDF_ROUTE_MAP = {
  compress: 'compress',
  'to-docx': 'to-docx',
  'to-pptx': 'to-pptx',
  'from-docx': 'from-docx',
  'from-pptx': 'from-pptx',
  'epub-to-pdf': 'epub-to-pdf',
  'pdf-to-epub': 'pdf-to-epub',
};

export function acceptedExts(operation, epubDirection = 'epub-to-pdf') {
  switch (operation) {
    case 'compress':
    case 'to-docx':
    case 'to-pptx':
      return ['pdf'];
    case 'from-docx':
      return ['docx', 'doc'];
    case 'from-pptx':
      return ['pptx', 'ppt'];
    case 'epub-pdf':
      return epubDirection === 'epub-to-pdf' ? ['epub'] : ['pdf'];
    default:
      return [];
  }
}

export function hintForOperation(operation, epubDirection) {
  const exts = acceptedExts(operation, epubDirection);
  return exts.map((e) => `.${e}`).join(', ');
}

export function outputExt(operation, epubDirection) {
  if (operation === 'compress' || operation === 'from-docx' || operation === 'from-pptx')
    return 'pdf';
  if (operation === 'to-docx') return 'docx';
  if (operation === 'to-pptx') return 'pptx';
  if (operation === 'epub-pdf') return epubDirection === 'epub-to-pdf' ? 'pdf' : 'epub';
  return 'pdf';
}

export function convertButtonLabel(operation, count) {
  const names = {
    compress: 'Compress',
    'to-docx': 'Convert to Word',
    'to-pptx': 'Convert to PowerPoint',
    'from-docx': 'Convert to PDF',
    'from-pptx': 'Convert to PDF',
    'epub-pdf': 'Convert',
  };
  const verb = names[operation] || 'Convert';
  if (!count) return verb;
  return `${verb} ${count} file${count > 1 ? 's' : ''}`;
}

export const COMPRESS_DESCRIPTIONS = {
  screen: 'Screen — smallest file size, lower image quality. Best for email.',
  ebook: 'eBook — balanced size and quality for reading on devices.',
  printer: 'Printer — higher quality, larger files for printing.',
  prepress: 'Prepress — highest quality, largest files for professional print.',
};
