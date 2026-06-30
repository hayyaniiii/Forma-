import { useEffect, useState } from 'react';
import { IconMoon, IconSettings, IconSun } from '@tabler/icons-react';
import Logo from './Logo';
import { cycleTheme, themeLabel } from '../theme';

function WindowControls() {
  if (!window.electronAPI) return null;
  const dot = (fn, color) => (
    <button
      type="button"
      onClick={fn}
      className={`h-3 w-3 rounded-full ${color} transition-ui hover:brightness-110`}
    />
  );

  const button = (fn, icon, isClose) => (
    <button
      type="button"
      onClick={fn}
      className={`flex h-8 w-12 items-center justify-center text-discord-secondary transition-ui ${
        isClose ? 'hover:bg-[#e81123] hover:text-white' : 'hover:bg-white/10 hover:text-discord-text'
      }`}
    >
      {icon}
    </button>
  );

  return (
    <div className="flex items-center h-full">
      {button(() => window.electronAPI.minimize(), '⎯')}
      {button(() => window.electronAPI.maximize(), '□')}
      {button(() => window.electronAPI.close(), '✕', true)}
    </div>
  );
}

export default function TitleBar({ health }) {
  const [themeMode, setThemeMode] = useState(
    () => localStorage.getItem('forma-theme') || 'system'
  );

  const ffmpegOk = health?.ffmpeg?.ok;

  return (
    <div className="flex flex-col shrink-0">
      {/* 1. Dedicated OS Title Bar */}
      <div className="drag-region flex h-8 w-full items-center justify-between bg-discord-bg">
        {/* App Title inside OS bar */}
        <div className="pl-4 text-xs font-medium text-discord-muted">Forma</div>
        <div className="no-drag h-full">
          <WindowControls />
        </div>
      </div>

      {/* 2. App Header Panel */}
      <header className="flex h-16 shrink-0 items-center justify-between border-b border-discord-border bg-discord-panel px-6">
        <div className="flex items-center">
          <Logo size={44} />
        </div>

        <div className="flex items-center gap-3">
          <span
            className={`hidden rounded-md px-2 py-0.5 font-mono text-[11px] sm:inline ${
              ffmpegOk
                ? 'bg-discord-green/15 text-discord-green'
                : 'bg-discord-yellow/15 text-discord-yellow'
            }`}
            title={health?.ffmpeg?.message}
          >
            {/* Health status is rendered based on background colors implicitly */}
          </span>
          <button
            type="button"
            onClick={() => setThemeMode(cycleTheme())}
            className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-discord-secondary transition-ui hover:bg-discord-input"
          >
            {themeMode === 'dark' ? <IconMoon size={18} /> : <IconSun size={18} />}
            <span className="hidden sm:inline">{themeLabel(themeMode)}</span>
          </button>
        </div>
      </header>
    </div>
  );
}
