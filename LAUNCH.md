# Launch Forma

## Option A — Installable app (for you & other users)

Creates a **Windows installer** with a desktop shortcut. Double-click **Forma** to open.

### One-time setup on your PC

1. Install [Node.js](https://nodejs.org) (LTS)
2. Install [Python 3](https://python.org) and run:
   ```powershell
   py -m pip install -r backend/requirements.txt
   ```
3. Install [FFmpeg](https://ffmpeg.org/download.html) and add it to PATH

### Build the installer

Open PowerShell in this folder:

```powershell
cd "c:\Users\hayya\OneDrive\Desktop\File Converter"

npm.cmd run pack:win
```

First build may take **5–15 minutes** (downloads Electron).

### What you get

| File | Purpose |
|------|---------|
| **`release\Forma Setup 0.1.0.exe`** | **Installer** — run once; creates desktop + Start menu shortcut |
| **`release\win-unpacked\Forma.exe`** | **Portable app** — double-click to open (no install) |
| **`Launch Forma.bat`** (project root) | Shortcut to the portable `.exe` |

**Easiest for you right now:** double-click **`Launch Forma.bat`** or  
`release\win-unpacked\Forma.exe`

**For friends / GitHub:** send them **`Forma Setup 0.1.0.exe`** from the `release` folder.

### Share on GitHub

1. Create a [GitHub Release](https://docs.github.com/en/repositories/releasing-projects-on-github)
2. Upload `Forma Setup 0.1.0.exe`
3. Tell users they also need **Python 3**, **FFmpeg**, and `pip install` deps (see README)

---

## Option B — Run while developing (no installer)

```powershell
npm.cmd run dev
```

Opens the app with hot-reload. Use this while coding.

---

## Option C — Run production build without installer

```powershell
npm.cmd run build
npm.cmd start
```

Runs the built app from this folder (still needs Python + FFmpeg on the machine).

---

## If `npm` is blocked in PowerShell

Use `npm.cmd` instead of `npm`, or run:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```
