const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    }
  });

  win.loadFile(path.join(__dirname, '../dist/index.html'));

  win.webContents.on('did-finish-load', async () => {
    // Wait a bit for React to render and animations to finish
    setTimeout(async () => {
      try {
        const image = await win.webContents.capturePage();
        const buffer = image.toPNG();
        fs.writeFileSync(path.join(__dirname, '../buildResources/screenshot.png'), buffer);
        console.log('Screenshot saved to buildResources/screenshot.png');
        app.quit();
      } catch (e) {
        console.error(e);
        app.quit();
      }
    }, 2000);
  });
});
