const { autoUpdater } = require('electron-updater');

function initUpdater(mainWindow) {
  if (!mainWindow) return;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.disableWebInstaller = false;
  autoUpdater.logger = null;

  const send = (type, payload = {}) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', { type, ...payload });
    }
  };

  autoUpdater.on('checking-for-update', () => send('checking'));
  autoUpdater.on('update-available', (info) => send('available', {
    version: info.version,
    releaseDate: info.releaseDate || null,
    releaseName: info.releaseName || null
  }));
  autoUpdater.on('update-not-available', (info) => send('not-available', { version: info.version }));
  autoUpdater.on('download-progress', (progress) => send('progress', {
    percent: progress.percent,
    transferred: progress.transferred,
    total: progress.total,
    bytesPerSecond: progress.bytesPerSecond
  }));
  autoUpdater.on('update-downloaded', (info) => send('downloaded', { version: info.version }));
  autoUpdater.on('error', (error) => send('error', { message: error?.message || String(error) }));

  return {
    check: async () => {
      if (!require('electron').app.isPackaged) {
        return { success: false, reason: 'not-packaged' };
      }
      try {
        const result = await autoUpdater.checkForUpdates();
        return { success: true, updateInfo: result?.updateInfo || null };
      } catch (error) {
        return { success: false, error: error?.message || String(error) };
      }
    },
    download: async () => {
      try {
        await autoUpdater.downloadUpdate();
        return { success: true };
      } catch (error) {
        return { success: false, error: error?.message || String(error) };
      }
    },
    install: () => {
      autoUpdater.quitAndInstall(false, true);
      return { success: true };
    }
  };
}

module.exports = { initUpdater };
