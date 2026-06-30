export function formatBytes(bytes) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let n = bytes;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

export function extOf(name) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export const CATEGORY_META = {
  video: { label: 'Video', hint: 'AVI, MOV, MKV, MP4, WebM…' },
  audio: { label: 'Audio', hint: 'MP3, WAV, FLAC, AAC, OGG…' },
  image: { label: 'Image', hint: 'JPG, PNG, WEBP, SVG…' },
  youtube: { label: 'YouTube', hint: 'Paste links — MP4 or MP3' },
  spotify: { label: 'Spotify', hint: '' },
  compress: { label: 'Compress', hint: 'Reduce file size' },
  pdf: { label: 'PDF', hint: '' },
};

export const ACCEPT_BY_CATEGORY = {
  video: '.avi,.mov,.mkv,.webm,.flv,.mp4,.m4v,.wmv,.mpeg,.mpg,.3gp',
  audio: '.mp3,.wav,.flac,.aac,.ogg,.m4a,.wma,.opus',
  image: '.jpg,.jpeg,.png,.webp,.bmp,.tiff,.tif,.ico,.gif,.svg',
  compress: '.jpg,.jpeg,.png,.webp,.bmp,.mp4,.mov,.mkv,.mp3,.wav,.flac,.aac,.ogg',
};

export const EXT_LIST_BY_CATEGORY = {
  video: ['avi', 'mov', 'mkv', 'webm', 'flv', 'mp4', 'm4v', 'wmv', 'mpeg', 'mpg', '3gp'],
  audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'wma', 'opus'],
  image: ['jpg', 'jpeg', 'png', 'webp', 'bmp', 'tiff', 'tif', 'ico', 'gif', 'svg'],
  compress: null,
};

export function payloadToFiles(payloads) {
  return payloads.map((p) => {
    const binary = atob(p.data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], p.name, { lastModified: Date.now() });
  });
}

export function estimateCompressedMb(files, targetMb) {
  if (!files.length) return null;
  const total = files.reduce((s, f) => s + f.size, 0);
  const targetBytes = targetMb * 1024 * 1024;
  return formatBytes(Math.min(total, targetBytes));
}

export function statusLabel(status) {
  if (status === 'queued' || status === 'ready') return 'ready';
  if (status === 'converting') return 'converting';
  if (status === 'done') return 'done';
  if (status === 'error') return 'error';
  return status;
}
