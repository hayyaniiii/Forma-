const STORAGE_KEY = 'forma-theme';

export function getSystemDark() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyTheme(mode) {
  const root = document.documentElement;
  const dark =
    mode === 'dark' ? true : mode === 'light' ? false : getSystemDark();
  root.classList.toggle('dark', dark);
  return dark ? 'dark' : 'light';
}

export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY) || 'system';
  applyTheme(saved);
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (localStorage.getItem(STORAGE_KEY) === 'system') applyTheme('system');
  });
  return saved;
}

export function cycleTheme() {
  const order = ['dark', 'light'];
  const current = localStorage.getItem(STORAGE_KEY) || 'system';
  const next = order[(order.indexOf(current) + 1) % order.length];
  localStorage.setItem(STORAGE_KEY, next);
  applyTheme(next);
  return next;
}

export function themeLabel(mode) {
  if (mode === 'system') return 'Auto';
  if (mode === 'light') return 'Light';
  return 'Dark';
}
