const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  getPlatform: () => ipcRenderer.invoke('app:getPlatform'),
  minimize: () => ipcRenderer.invoke('window:minimize'),
  maximize: () => ipcRenderer.invoke('window:maximize'),
  close: () => ipcRenderer.invoke('window:close'),
  openFiles: (opts) => ipcRenderer.invoke('dialog:openFiles', opts),
  openFolder: (opts) => ipcRenderer.invoke('dialog:openFolder', opts),
  pickOutputFolder: () => ipcRenderer.invoke('dialog:pickOutputFolder'),
  saveFile: (defaultName) => ipcRenderer.invoke('dialog:saveFile', defaultName),
  showInFolder: (filePath) => ipcRenderer.invoke('shell:showItemInFolder', filePath),
  openExternal: (url) => ipcRenderer.invoke('shell:openExternal', url),
  saveBlob: (opts) => ipcRenderer.invoke('file:saveBlob', opts),
});
