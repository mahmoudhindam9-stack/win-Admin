const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const si = require('systeminformation');
const { spawn, exec } = require('child_process');
const sudo = require('@vscode/sudo-prompt');
const fs = require('fs');

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

  let mainWindow;
  function createWindow() {
    mainWindow = new BrowserWindow({
      width: 1280,
      height: 800,
      minWidth: 1024,
      minHeight: 768,
      title: "Windows Performance Optimizer Suite",
      backgroundColor: "#0B0F19",
      autoHideMenuBar: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: true,
        preload: path.join(__dirname, 'preload.cjs')
      }
    });

    if (app.isPackaged) {
      mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
    } else {
      mainWindow.loadURL('http://localhost:3000');
    }
  }

  app.whenReady().then(() => {
    createWindow();

    ipcMain.handle('check-elevation', async () => {
      return new Promise((resolve) => {
        exec('net session', (error) => {
          resolve(error === null);
        });
      });
    });

    ipcMain.handle('get-system-metrics', async () => {
      try {
        const cpu = await si.cpu();
        const currentLoad = await si.currentLoad();
        const mem = await si.mem();
        const fsSize = await si.fsSize();
        const processes = await si.processes();

        let driveTotalGB = 0;
        let driveUsedGB = 0;
        if (fsSize && fsSize.length > 0) {
          const mainDrive = fsSize.find(d => d.mount === 'C:' || d.mount === '/') || fsSize[0];
          driveTotalGB = mainDrive.size / (1024 * 1024 * 1024);
          driveUsedGB = mainDrive.used / (1024 * 1024 * 1024);
        }

        const topProcesses = processes.list.slice(0, 5).map(p => ({
          name: p.name,
          pid: p.pid,
          cpuPercent: parseFloat(p.cpu.toFixed(1)),
          memMB: Math.round(p.memRss / 1024)
        }));

        return {
          cpuUsagePercent: Math.round(currentLoad.currentLoad),
          cpuClockSpeedGhz: parseFloat(cpu.speed.toFixed(2)),
          cpuThreads: processes.all,
          cpuProcesses: processes.running,
          ramUsedGB: parseFloat(((mem.used) / (1024 * 1024 * 1024)).toFixed(1)),
          ramTotalGB: parseFloat((mem.total / (1024 * 1024 * 1024)).toFixed(1)),
          ramStandbyGB: parseFloat(((mem.buffcache || 0) / (1024 * 1024 * 1024)).toFixed(1)),
          ramPercent: Math.round(((mem.used) / mem.total) * 100),
          driveUsedGB: Math.round(driveUsedGB),
          driveTotalGB: Math.round(driveTotalGB),
          topProcesses
        };
      } catch (err) {
        console.error("Metrics error:", err);
        return null;
      }
    });

    const { generatePowerShellScript } = require('./scriptGenerator.cjs');

    ipcMain.handle('run-optimization-task', async (event, taskId, config, elevate) => {
      const allowedTaskIds = ['full', 'temp', 'dns', 'browser', 'ram', 'update', 'router_config', 'cpu'];
      if (!allowedTaskIds.includes(taskId)) {
        return { success: false, exitCode: -1, error: 'Invalid Task ID' };
      }

      const script = generatePowerShellScript(config);

      return new Promise((resolve) => {
        const tempPath = path.join(app.getPath('temp'), `WinOpt_${Date.now()}.ps1`);
        try {
          fs.writeFileSync(tempPath, script, { encoding: 'utf8' });
        } catch (writeError) {
          resolve({ success: false, exitCode: -1, stdout: '', stderr: writeError.message });
          return;
        }

        const cleanup = () => {
          try { fs.unlinkSync(tempPath); } catch (_) {}
        };

        if (elevate) {
          const options = { name: 'Windows Performance Optimizer Suite' };
          sudo.exec(`powershell.exe -ExecutionPolicy Bypass -NoProfile -File "${tempPath}"`, options, (error, stdout, stderr) => {
            cleanup();
            const out = stdout?.toString() || '';
            const errOut = stderr?.toString() || '';
            if (error) {
              resolve({
                success: false,
                exitCode: typeof error.code === 'number' ? error.code : 1,
                stdout: out,
                stderr: errOut || error.message
              });
            } else {
              resolve({ success: true, exitCode: 0, stdout: out, stderr: errOut });
            }
          });
        } else {
          const ps = spawn('powershell.exe', ['-ExecutionPolicy', 'Bypass', '-NoProfile', '-File', tempPath], {
            windowsHide: true
          });
          let stdout = '';
          let stderr = '';

          ps.stdout.on('data', (data) => {
            const chunk = data.toString();
            stdout += chunk;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('execution-progress', { type: 'stdout', data: chunk });
            }
          });

          ps.stderr.on('data', (data) => {
            const chunk = data.toString();
            stderr += chunk;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('execution-progress', { type: 'stderr', data: chunk });
            }
          });

          ps.on('close', (code) => {
            cleanup();
            resolve({ success: code === 0, exitCode: code ?? -1, stdout, stderr });
          });

          ps.on('error', (err) => {
            cleanup();
            resolve({ success: false, exitCode: -1, stdout, stderr: stderr || err.message });
          });
        }
      });
    });

    ipcMain.handle('router-api', async (event, action, data) => {
      if (action === 'getGateway') {
        try {
          const gateway = await si.networkGatewayDefault();
          return { success: true, gateway };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }

      if (action === 'ping') {
        return new Promise((resolve) => {
          const { host, port, timeoutMs } = data || {};
          const net = require('net');
          const socket = new net.Socket();
          let resolved = false;
          const finish = (result) => {
            if (resolved) return;
            resolved = true;
            socket.destroy();
            resolve(result);
          };

          socket.setTimeout(Number(timeoutMs) || 2000);
          socket.on('connect', () => finish({ success: true, reachable: true }));
          socket.on('timeout', () => finish({ success: true, reachable: false }));
          socket.on('error', () => finish({ success: true, reachable: false }));
          socket.connect(Number(port) || 80, host);
        });
      }

      if (action === 'fetch') {
        try {
          const { url, options } = data || {};
          const response = await globalThis.fetch(url, options);
          const headers = {};
          response.headers.forEach((value, key) => { headers[key] = value; });
          const body = await response.text();
          return {
            success: true,
            status: response.status,
            statusText: response.statusText,
            ok: response.ok,
            headers,
            body
          };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }

      return { success: false, error: 'Unknown action' };
    });
  });

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
