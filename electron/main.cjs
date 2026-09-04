const { app, BrowserWindow } = require('electron');
const path = require('path');

// Prevent multiple instances
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const mainWindow = BrowserWindow.getAllWindows()[0];
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  function createWindow() {
    const win = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 1024,
      minHeight: 768,
      title: "Windows Performance Optimizer Suite",
      backgroundColor: "#0B0F19", // Matches the app's dark theme
      autoHideMenuBar: true, // Professional look
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false, // For simplicity in local standalone apps
      }
    });

    // In production, load the built index.html
    if (app.isPackaged) {
      win.loadFile(path.join(__dirname, '../dist/index.html'));
    } else {
      // In dev, load the Vite dev server
      win.loadURL('http://localhost:3000');
    }
  }

  app.whenReady().then(createWindow);

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
}
