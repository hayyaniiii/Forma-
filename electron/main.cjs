const { app, BrowserWindow, ipcMain, dialog, shell, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

const isDev = process.env.VITE_DEV === '1';
const BACKEND_PORT = process.env.FORMA_PORT || 5123;
let mainWindow = null;
let pythonProcess = null;

function getPythonCommand() {
  if (process.platform === 'win32') return 'py';
  return 'python3';
}

function backendScriptPath() {
  if (isDev) {
    return path.join(__dirname, '..', 'backend', 'server.py');
  }
  const bundled = path.join(process.resourcesPath, 'backend', 'server.exe');
  if (fs.existsSync(bundled)) return bundled;
  return path.join(__dirname, '..', 'backend', 'server.py');
}

function backendCwd() {
  if (isDev) return path.join(__dirname, '..');
  const bundled = path.join(process.resourcesPath, 'backend');
  if (fs.existsSync(bundled)) return process.resourcesPath;
  return path.join(__dirname, '..');
}

function startBackend() {
  return new Promise((resolve, reject) => {
    const serverPath = backendScriptPath();
    const env = { ...process.env, FORMA_PORT: String(BACKEND_PORT) };

    const binPath = isDev 
      ? path.join(__dirname, '..', 'bin')
      : path.join(process.resourcesPath, 'bin');
    env.PATH = `${binPath}${path.delimiter}${env.PATH}`;

    if (serverPath.endsWith('.exe')) {
      pythonProcess = spawn(serverPath, [], {
        env,
        cwd: process.resourcesPath,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        shell: false,
      });
    } else {
      pythonProcess = spawn(getPythonCommand(), [serverPath], {
        env,
        cwd: backendCwd(),
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
        shell: true,
      });
    }

    pythonProcess.stdout?.on('data', (d) => {
      if (isDev) console.log('[forma-backend]', d.toString());
    });
    pythonProcess.stderr?.on('data', (d) => {
      if (isDev) console.error('[forma-backend]', d.toString());
    });
    pythonProcess.on('error', reject);

    const deadline = Date.now() + 45000;
    const poll = () => {
      const req = http.get(`http://127.0.0.1:${BACKEND_PORT}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else if (Date.now() < deadline) setTimeout(poll, 400);
        else reject(new Error('Backend health check failed'));
      });
      req.on('error', () => {
        if (Date.now() < deadline) setTimeout(poll, 400);
        else reject(new Error('Backend did not start in time'));
      });
      req.setTimeout(2000, () => req.destroy());
    };
    setTimeout(poll, 500);
  });
}

function createWindow() {
  const isMac = process.platform === 'darwin';

  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 900,
    minHeight: 620,
    frame: false,
    show: false,
    title: 'Forma',
    backgroundColor: '#1E1F22',
    icon: nativeImage.createFromPath(path.join(__dirname, '..', 'assets', 'icon.png')),
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] ${message} (${sourceId}:${line})`);
  });

  if (isDev) {
    mainWindow.loadURL('http://127.0.0.1:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

app.whenReady().then(async () => {
  try {
    await startBackend();
    createWindow();
  } catch (err) {
    console.error(err);
    dialog.showErrorBox(
      'Forma',
      'Could not start the Python backend.\n\nInstall Python 3 and run:\npy -m pip install -r backend/requirements.txt\n\nAlso install FFmpeg for video/audio.'
    );
    app.quit();
  }
});

app.on('before-quit', () => {
  if (pythonProcess) {
    try {
      const req = http.request({
        host: '127.0.0.1',
        port: BACKEND_PORT,
        path: '/api/shutdown',
        method: 'POST'
      });
      req.on('error', () => {});
      req.end();
    } catch (e) {}
    pythonProcess.kill();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.handle('app:getPlatform', () => process.platform);

ipcMain.handle('window:minimize', () => mainWindow?.minimize());
ipcMain.handle('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});
ipcMain.handle('window:close', () => mainWindow?.close());

function readPathsAsPayload(paths) {
  return paths
    .filter((p) => fs.existsSync(p) && fs.statSync(p).isFile())
    .map((p) => {
      const buf = fs.readFileSync(p);
      return {
        path: p,
        name: path.basename(p),
        size: buf.length,
        data: buf.toString('base64'),
      };
    });
}

function collectFilesFromDir(dir, extensions, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collectFilesFromDir(full, extensions, acc);
    else if (entry.isFile()) {
      const ext = path.extname(entry.name).slice(1).toLowerCase();
      if (!extensions?.length || extensions.includes(ext)) acc.push(full);
    }
  }
  return acc;
}

ipcMain.handle('dialog:openFiles', async (_, { extensions } = {}) => {
  const filters =
    extensions?.length > 0
      ? [{ name: 'Supported', extensions }, { name: 'All', extensions: ['*'] }]
      : [{ name: 'All', extensions: ['*'] }];
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    filters,
  });
  if (canceled) return [];
  return readPathsAsPayload(filePaths);
});

ipcMain.handle('dialog:openFolder', async (_, { extensions } = {}) => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  if (canceled || !filePaths[0]) return [];
  const files = collectFilesFromDir(filePaths[0], extensions);
  return readPathsAsPayload(files);
});

ipcMain.handle('dialog:pickOutputFolder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory', 'createDirectory'],
  });
  return canceled ? null : filePaths[0];
});

ipcMain.handle('dialog:saveFile', async (_, defaultName) => {
  const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName,
  });
  return canceled ? null : filePath;
});

ipcMain.handle('shell:showItemInFolder', (_, filePath) => {
  shell.showItemInFolder(filePath);
});

ipcMain.handle('shell:openExternal', (_, url) => {
  shell.openExternal(url);
});

ipcMain.handle('file:saveBlob', async (_, { filePath, base64 }) => {
  try {
    const buf = Buffer.from(base64, 'base64');
    fs.writeFileSync(filePath, buf);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
