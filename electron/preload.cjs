const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSystemMetrics: () => ipcRenderer.invoke('get-system-metrics'),
  executePowerShell: (script, elevate) => ipcRenderer.invoke('execute-powershell', script, elevate),
  onExecutionProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('execution-progress', handler);
    return () => ipcRenderer.removeListener('execution-progress', handler);
  },
  routerApi: (action, data) => ipcRenderer.invoke('router-api', action, data)
});
