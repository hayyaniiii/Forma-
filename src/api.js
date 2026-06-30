const API_BASE = 'http://127.0.0.1:5123';

function filenameFromDisposition(disposition, fallback) {
  if (!disposition) return fallback;
  const match =
    /filename\*=UTF-8''([^;\n]+)|filename="([^"]+)"|filename=([^;\n]+)/i.exec(
      disposition
    );
  if (!match) return fallback;
  const raw = (match[1] || match[2] || match[3] || '').trim();
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

export async function fetchHealth() {
  const res = await fetch(`${API_BASE}/api/health`);
  if (!res.ok) throw new Error('Backend unavailable');
  return res.json();
}

export async function fetchFormats() {
  const res = await fetch(`${API_BASE}/api/formats`);
  if (!res.ok) throw new Error('Could not load formats');
  return res.json();
}

export async function convertFile(file, options, onProgress) {
  const form = new FormData();
  form.append('file', file);
  form.append('category', options.category);
  form.append('target_format', options.targetFormat);
  form.append('quality', String(options.quality ?? 85));
  if (options.targetSizeMb != null) {
    form.append('target_size_mb', String(options.targetSizeMb));
  }
  if (options.extractAudio) form.append('extract_audio', 'true');

  onProgress?.(10);
  const res = await fetch(`${API_BASE}/api/convert`, { method: 'POST', body: form });
  onProgress?.(90);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }

  const blob = await res.blob();
  onProgress?.(100);

  const disposition = res.headers.get('Content-Disposition');
  let filename = file.name.replace(/\.[^.]+$/, '') + '.' + options.targetFormat;
  filename = filenameFromDisposition(disposition, filename);

  return { blob, filename };
}

export async function inspectPdf(file, operation) {
  const form = new FormData();
  form.append('file', file);
  form.append('operation', operation);
  const res = await fetch(`${API_BASE}/api/pdf/inspect`, { method: 'POST', body: form });
  if (!res.ok) return { corrupt: true };
  return res.json();
}

export async function estimatePdfCompress(file, level) {
  const form = new FormData();
  form.append('file', file);
  form.append('level', level);
  const res = await fetch(`${API_BASE}/api/pdf/estimate-compress`, {
    method: 'POST',
    body: form,
  });
  if (!res.ok) return null;
  const data = await res.json();
  return data.estimate_mb;
}

export async function convertPdf(file, route, options, onProgress) {
  const form = new FormData();
  form.append('file', file);
  Object.entries(options || {}).forEach(([k, v]) => {
    if (v != null) form.append(k, String(v));
  });

  onProgress?.(10);
  const res = await fetch(`${API_BASE}/api/pdf/${route}`, { method: 'POST', body: form });
  onProgress?.(90);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }

  const blob = await res.blob();
  onProgress?.(100);

  const disposition = res.headers.get('Content-Disposition');
  let filename = 'output';
  filename = filenameFromDisposition(disposition, filename);

  return { blob, filename };
}

export async function fetchYoutubeInfo(url) {
  const res = await fetch(`${API_BASE}/api/youtube/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch video info');
  }
  return res.json();
}

export async function fetchSpotifyInfo(url) {
  const res = await fetch(`${API_BASE}/api/spotify/info`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch spotify info');
  }
  return res.json();
}

export async function downloadYoutube(url, options, onProgress) {
  onProgress?.(15);
  const res = await fetch(`${API_BASE}/api/youtube`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      url,
      format: options.format,
      resolution: options.resolution,
      audio_bitrate: options.audioBitrate,
    }),
  });
  onProgress?.(85);

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }

  const blob = await res.blob();
  onProgress?.(100);
  const ext = options.format === 'mp3' ? 'mp3' : 'mp4';

  // Use the provided title for the filename if available
  const sanitize = (s) => s.replace(/[<>:"/\\|?*]+/g, '_').trim();
  if (options.title) {
    return { blob, filename: `${sanitize(options.title)}.${ext}` };
  }

  let filename = `youtube_download.${ext}`;
  const xFilename = res.headers.get('X-Filename');
  if (xFilename) {
    try {
      filename = decodeURIComponent(xFilename);
    } catch {
      filename = xFilename;
    }
  } else {
    const disposition = res.headers.get('Content-Disposition');
    filename = filenameFromDisposition(disposition, filename);
  }
  return { blob, filename };
}

function parseSseChunk(buffer, onEvent) {
  const parts = buffer.split('\n\n');
  const remainder = parts.pop() || '';
  for (const part of parts) {
    const line = part
      .split('\n')
      .find((l) => l.startsWith('data:'));
    if (!line) continue;
    try {
      const data = JSON.parse(line.slice(5).trim());
      onEvent(data);
    } catch {
      /* ignore malformed */
    }
  }
  return remainder;
}

function handleSpotifyEvent(event, callbacks) {
  const { onLog, onStart, onDone, onError, onTrack, onOverall } = callbacks;
  if (event.type === 'log' && event.line) onLog?.(event.line);
  if (event.type === 'start') onStart?.(event.link_type);
  if (event.type === 'track') onTrack?.(event);
  if (event.type === 'overall') onOverall?.(event);
  if (event.type === 'error') onError?.(event.message);
  if (event.type === 'done') onDone?.(event);
}

export async function downloadSpotifyStream(url, outputDir, callbacks = {}, options = {}) {
  const { asZip = false } = options;

  const res = await fetch(`${API_BASE}/api/spotify/download`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, output_dir: outputDir, as_zip: asZip }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || res.statusText);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('Streaming not supported');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    buffer = parseSseChunk(buffer, (event) => handleSpotifyEvent(event, callbacks));
  }

  if (buffer.trim()) {
    parseSseChunk(`${buffer}\n\n`, (event) => handleSpotifyEvent(event, callbacks));
  }
}

export async function triggerDownload(blob, filename) {
  if (window.electronAPI?.saveFile) {
    const filePath = await window.electronAPI.saveFile(filename);
    if (!filePath) return; // user cancelled
    const reader = new FileReader();
    const base64 = await new Promise((resolve) => {
      reader.onload = () => resolve(reader.result.split(',')[1]);
      reader.readAsDataURL(blob);
    });
    await window.electronAPI.saveBlob({ filePath, base64 });
  } else {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}

export function openExternal(url) {
  if (window.electronAPI?.openExternal) {
    window.electronAPI.openExternal(url);
  } else {
    window.open(url, '_blank');
  }
}

export async function createZipBlob(blobs) {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();
  blobs.forEach(({ blob, filename }) => zip.file(filename, blob));
  return zip.generateAsync({ type: 'blob' });
}

export async function downloadZip(blobs, zipName = 'forma_outputs.zip') {
  const content = await createZipBlob(blobs);
  triggerDownload(content, zipName);
  return content;
}
