const TYPE_PATTERNS = {
  track: /(?:open\.spotify\.com\/track\/|spotify:track:)/i,
  album: /(?:open\.spotify\.com\/album\/|spotify:album:)/i,
  playlist: /(?:open\.spotify\.com\/playlist\/|spotify:playlist:)/i,
};

export function detectSpotifyLinkType(url) {
  const u = (url || '').trim();
  if (!u) return null;
  for (const [type, pattern] of Object.entries(TYPE_PATTERNS)) {
    if (pattern.test(u)) return type;
  }
  return null;
}

export function spotifyTypeLabel(type) {
  if (!type) return null;
  return type.charAt(0).toUpperCase() + type.slice(1);
}

export function isValidSpotifyUrl(url) {
  return detectSpotifyLinkType(url) !== null;
}
