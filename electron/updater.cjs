const { app } = require('electron');
const { autoUpdater } = require('electron-updater');

const UPDATE_PROVIDER = {
  provider: 'github',
  owner: 'mahmoudhindam9-stack',
  repo: 'win-Admin',
  releaseType: 'release'
};

function initUpdater(mainWindow) {
  if (!mainWindow) return null;

  let checking = false;

  autoUpdater.setFeedURL(UPDATE_PROVIDER);
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowDowngrade = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.disableWebInstaller = false;
  autoUpdater.logger = null;

  const send = (type, payload = {}) => {
    if (!mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-status', { type, ...payload });
    }
  };

  autoUpdater.on('checking-for-update', () => {
    checking = true;
    send('checking');
  });

  autoUpdater.on('update-available', (info) => {
    checking = false;
    send('available', {
      version: info.version,
      releaseDate: info.releaseDate || null,
      releaseName: info.releaseName || null
    });
  });

  autoUpdater.on('update-not-available', (info) => {
    checking = false;
    send('not-available', { version: info.version });
  });

  autoUpdater.on('download-progress', (progress) => {
    send('progress', {
      percent: progress.percent,
      transferred: progress.transferred,
      total: progress.total,
      bytesPerSecond: progress.bytesPerSecond
    });
  });

  autoUpdater.on('update-downloaded', (info) => {
    send('downloaded', { version: info.version });
  });

  autoUpdater.on('error', (error) => {
    checking = false;
    send('error', { message: error?.message || String(error) });
  });

  const check = async () => {
    if (!app.isPackaged || checking) {
      return { success: false, reason: app.isPackaged ? 'check-in-progress' : 'not-packaged' };
    }

    checking = true;
    try {
      const result = await autoUpdater.checkForUpdates();
      checking = false;
      return { success: true, updateInfo: result?.updateInfo || null };
    } catch (error) {
      checking = false;
      return { success: false, error: error?.message || String(error) };
    }
  };

  // Check shortly after startup, then periodically so long-running installations
  // also discover releases without requiring the user to press the button.
  const startupTimer = setTimeout(() => { void check(); }, 5000);
  const periodicTimer = setInterval(() => { void check(); }, 6 * 60 * 60 * 1000);

  mainWindow.once('closed', () => {
    clearTimeout(startupTimer);
    clearInterval(periodicTimer);
  });

  return {
    check,
    download: async () => {
      if (!app.isPackaged) return { success: false, reason: 'not-packaged' };
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
