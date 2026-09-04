const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSystemMetrics: () => ipcRenderer.invoke('get-system-metrics'),
  checkElevation: () => ipcRenderer.invoke('check-elevation'),
  runOptimizationTask: (taskId, config, elevate) => ipcRenderer.invoke('run-optimization-task', taskId, config, elevate),
  onExecutionProgress: (callback) => {
    const handler = (event, data) => callback(data);
    ipcRenderer.on('execution-progress', handler);
    return () => ipcRenderer.removeListener('execution-progress', handler);
  },
  routerApi: (action, data) => ipcRenderer.invoke('router-api', action, data)
});
