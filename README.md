# Forma
All-in-one desktop file converter — video, audio, images, PDF, YouTube &amp; Spotify downloads. Electron + React frontend, Python backend.

<img src="assets/icon.png" alt="Forma" width="200"/>

## Download & Installation (End Users)

Welcome to Forma! To use this as a desktop app on your machine, follow these steps:

### 1. Download the App
Head over to the [Releases](../../releases/latest) tab on this GitHub repository and download the latest Windows installer (e.g., `Forma Setup X.X.X.exe`). 

Run the installer. It will automatically install Forma and add a shortcut to your desktop.

### 2. Install FFmpeg (Required for Video/Audio/Image Conversion)
Forma uses FFmpeg for media conversions. Download it from:
- **[FFmpeg Official](https://ffmpeg.org/download.html)** — Download the Windows build and extract to a folder
- **Or use Windows Package Manager:**
  ```powershell
  winget install FFmpeg
  ```

After installation, add FFmpeg to your Windows PATH:
1. Extract FFmpeg to a folder (e.g., `C:\ffmpeg`)
2. Open Environment Variables (search "Environment Variables" in Start menu)
3. Click "Edit the system environment variables" → Environment Variables
4. Under "System variables", select `Path` and click Edit
5. Click "New" and add the FFmpeg folder path (e.g., `C:\ffmpeg\bin`)
6. Click OK and restart your computer

### 3. Launch Forma!
Double-click the **Forma** icon on your desktop to start converting!

---

## Features

- **Video / Audio / Image** — Convert seamlessly between common formats.
- **YouTube** — Paste links to download MP4 or MP3.
- **Spotify** — Paste track, album, or playlist links to download MP3s directly.
- **Compress** — Target a specific file size and Forma handles the compression automatically.
- **PDF** — Compress, PDF↔Word/PowerPoint, EPUB↔PDF.
- **Smart Drag & Drop** — Drop files or folders with automatic type filtering.
- **Discord-inspired UI** .

---

## For Developers

### Setup
```powershell
# Install python backend requirements
py -m pip install -r backend/requirements.txt

# Install Node modules
npm.cmd install
```

### Run (development)
```powershell
npm.cmd run dev
```

### Build installers
Generates installers in the `release/` folder:
```powershell
npm.cmd run pack:win      # Windows NSIS .exe (one-click, desktop shortcut)
npm.cmd run pack:mac      # macOS .dmg
npm.cmd run pack:linux    # Linux AppImage
```

## Troubleshooting

| Issue | Fix |
|--------|-----|
| FFmpeg missing (errors when converting) | Download [FFmpeg](https://ffmpeg.org/download.html), add to Windows PATH, restart app |
| `npm` blocked in PowerShell | Use `npm.cmd` or run `Set-ExecutionPolicy RemoteSigned -Scope CurrentUser` |
| `yt_dlp: false` in health check | `py -m pip install yt-dlp`, restart app |
| `spotdl: false` in health check | `py -m pip install spotdl`, restart app |

Special thanks to mmxs cctv
