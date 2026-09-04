const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const si = require('systeminformation');
const { spawn, execFile } = require('child_process');
const fs = require('fs');

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
  let updater = null;

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

  function psQuote(value) {
    return `'${String(value).replace(/'/g, "''")}'`;
  }

  function sanitizeGeneratedPowerShell(script) {
    return String(script)
      .replace(/\$Host\.UI\.RawUI\.ReadKey\(\s*["']NoEcho,IncludeKeyDown["']\s*\)\s*/g, '')
      .replace(/^[ \t]*Write-Host\s+["']Press any key to exit this optimization session\.\.\.["'].*\r?\n/gim, '')
      .replace(/\$Description:/g, '${Description}:')
      .replace(/\\\$\{Description\}:/g, '${Description}:');
  }

  function waitForTextFiles(stdoutPath, stderrPath, mainWindow, processPromise) {
    let stdoutOffset = 0;
    let stderrOffset = 0;
    const interval = setInterval(() => {
      try {
        if (fs.existsSync(stdoutPath)) {
          const text = fs.readFileSync(stdoutPath, 'utf8');
          if (text.length > stdoutOffset) {
            const chunk = text.slice(stdoutOffset);
            stdoutOffset = text.length;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('execution-progress', { type: 'stdout', data: chunk });
            }
          }
        }
        if (fs.existsSync(stderrPath)) {
          const text = fs.readFileSync(stderrPath, 'utf8');
          if (text.length > stderrOffset) {
            const chunk = text.slice(stderrOffset);
            stderrOffset = text.length;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('execution-progress', { type: 'stderr', data: chunk });
            }
          }
        }
      } catch (_) {}
    }, 150);

    return processPromise.finally(() => clearInterval(interval));
  }

  async function runElevatedPowerShell(scriptPath, taskId) {
    const tempDir = path.dirname(scriptPath);
    const token = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
    const wrapperPath = path.join(tempDir, `WinOptElevated_${token}.ps1`);
    const stdoutPath = path.join(tempDir, `WinOptElevated_${token}.out.log`);
    const stderrPath = path.join(tempDir, `WinOptElevated_${token}.err.log`);
    const exitPath = path.join(tempDir, `WinOptElevated_${token}.exit`);

    const wrapper = `
$ErrorActionPreference = 'Continue'
$exitCode = 1
try {
    & powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File ${psQuote(scriptPath)} 1> ${psQuote(stdoutPath)} 2> ${psQuote(stderrPath)}
    $exitCode = if ($LASTEXITCODE -is [int]) { $LASTEXITCODE } else { 0 }
} catch {
    $_ | Out-File -FilePath ${psQuote(stderrPath)} -Append -Encoding utf8
    $exitCode = 1
}
Set-Content -Path ${psQuote(exitPath)} -Value $exitCode -Encoding ascii
exit $exitCode
`;

    try {
      fs.writeFileSync(wrapperPath, wrapper, 'utf8');
      fs.writeFileSync(stdoutPath, '', 'utf8');
      fs.writeFileSync(stderrPath, '', 'utf8');
      try { fs.unlinkSync(exitPath); } catch (_) {}
    } catch (error) {
      return { success: false, exitCode: -1, stdout: '', stderr: error.message };
    }

    const psCommand = [
      `$argList = '-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "${String(wrapperPath).replace(/"/g, '""')}"'`,
      `$p = Start-Process -FilePath 'powershell.exe' -ArgumentList $argList -Verb RunAs -WindowStyle Hidden -Wait -PassThru`,
      `exit $p.ExitCode`
    ].join('; ');

    const processPromise = new Promise((resolve) => {
      const child = execFile('powershell.exe', [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy', 'Bypass',
        '-Command', psCommand
      ], { windowsHide: true }, () => {
        let stdout = '';
        let stderr = '';
        try { stdout = fs.readFileSync(stdoutPath, 'utf8'); } catch (_) {}
        try { stderr = fs.readFileSync(stderrPath, 'utf8'); } catch (_) {}
        let exitCode = child.exitCode;
        try {
          if (fs.existsSync(exitPath)) {
            const raw = Number(fs.readFileSync(exitPath, 'utf8').trim());
            if (Number.isFinite(raw)) exitCode = raw;
          }
        } catch (_) {}
        resolve({
          success: exitCode === 0,
          exitCode: typeof exitCode === 'number' ? exitCode : 1,
          stdout,
          stderr
        });
      });

      child.on('error', (error) => {
        resolve({ success: false, exitCode: -1, stdout: '', stderr: error.message });
      });
    });

    const result = await waitForTextFiles(stdoutPath, stderrPath, mainWindow, processPromise);

    try { fs.unlinkSync(wrapperPath); } catch (_) {}
    try { fs.unlinkSync(stdoutPath); } catch (_) {}
    try { fs.unlinkSync(stderrPath); } catch (_) {}
    try { fs.unlinkSync(exitPath); } catch (_) {}

    return result;
  }

  app.whenReady().then(() => {
    createWindow();

    if (app.isPackaged) {
      try {
        const { initUpdater } = require('./updater.cjs');
        updater = initUpdater(mainWindow);
        setTimeout(() => { updater?.check(); }, 5000);
      } catch (error) {
        console.error('Updater initialization failed:', error);
      }
    }

    ipcMain.handle('check-elevation', async () => {
      return new Promise((resolve) => {
        execFile('powershell.exe', [
          '-NoProfile',
          '-NonInteractive',
          '-ExecutionPolicy', 'Bypass',
          '-Command',
          '[Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent() | ForEach-Object { $_.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }'
        ], { windowsHide: true }, (error, stdout) => {
          if (error) {
            console.error('PowerShell elevation check failed:', error);
            resolve(false);
            return;
          }
          resolve(String(stdout).trim().toLowerCase() === 'true');
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

      const script = sanitizeGeneratedPowerShell(generatePowerShellScript(config));
      const tempPath = path.join(app.getPath('temp'), `WinOpt_${Date.now()}.ps1`);

      try {
        fs.writeFileSync(tempPath, script, { encoding: 'utf8' });
      } catch (writeError) {
        return { success: false, exitCode: -1, stdout: '', stderr: writeError.message };
      }

      try {
        if (elevate) {
          return await runElevatedPowerShell(tempPath, taskId);
        }

        return await new Promise((resolve) => {
          const ps = spawn('powershell.exe', [
            '-NoLogo',
            '-NoProfile',
            '-NonInteractive',
            '-ExecutionPolicy', 'Bypass',
            '-File', tempPath
          ], { windowsHide: true });

          let stdout = '';
          let stderr = '';

          ps.stdout.on('data', (data) => {
            const chunk = data.toString();
            stdout += chunk;
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('execution-progress', { type: 'stdout', data: chunk });
          });
          ps.stderr.on('data', (data) => {
            const chunk = data.toString();
            stderr += chunk;
            if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('execution-progress', { type: 'stderr', data: chunk });
          });
          ps.on('close', (code) => {
            resolve({ success: code === 0, exitCode: code ?? -1, stdout, stderr });
          });
          ps.on('error', (err) => {
            resolve({ success: false, exitCode: -1, stdout, stderr: stderr || err.message });
          });
        });
      } finally {
        try { fs.unlinkSync(tempPath); } catch (_) {}
      }
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
          return { success: true, status: response.status, statusText: response.statusText, ok: response.ok, headers, body };
        } catch (e) {
          return { success: false, error: e.message };
        }
      }
      return { success: false, error: 'Unknown action' };
    });

    ipcMain.handle('update-check', async () => updater?.check() || { success: false, reason: 'unavailable' });
    ipcMain.handle('update-download', async () => updater?.download() || { success: false, reason: 'unavailable' });
    ipcMain.handle('update-install', async () => updater?.install() || { success: false, reason: 'unavailable' });
    ipcMain.handle('app-version', () => app.getVersion());
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
}
