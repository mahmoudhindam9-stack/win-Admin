const { ipcMain } = require('electron');
const { execFile } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

let registered = false;

function runCommand(file, args, options = {}) {
  return new Promise((resolve) => {
    execFile(file, args, { windowsHide: true, maxBuffer: 2 * 1024 * 1024, ...options }, (error, stdout = '', stderr = '') => {
      resolve({
        success: !error,
        code: typeof error?.code === 'number' ? error.code : 0,
        stdout: String(stdout),
        stderr: String(stderr),
        error: error?.message || null,
      });
    });
  });
}

function psQuote(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

async function isAdministrator() {
  const result = await runCommand('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command',
    '[Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent() | ForEach-Object { $_.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }'
  ]);
  return result.success && String(result.stdout).trim().toLowerCase() === 'true';
}

function parseNetworks(text) {
  const lines = String(text).replace(/\r/g, '').split('\n');
  const raw = [];
  let current = null;

  for (const line of lines) {
    const ssidMatch = line.match(/^\s*SSID\s+\d+\s*:\s*(.*)$/i);
    if (ssidMatch) {
      if (current) raw.push(current);
      current = { ssid: ssidMatch[1].trim(), signal: 0, security: 'WPA2' };
      continue;
    }
    if (!current) continue;

    const signalMatch = line.match(/(\d{1,3})\s*%/);
    if (signalMatch && current.signal === 0) current.signal = Math.min(100, Number(signalMatch[1]));
    if (/WPA3/i.test(line)) current.security = 'WPA3';
    else if (/WPA2/i.test(line)) current.security = 'WPA2';
    else if (/\bOpen\b/i.test(line) || /None/i.test(line)) current.security = 'Open';
  }
  if (current) raw.push(current);

  const map = new Map();
  for (const item of raw) {
    const ssid = item.ssid.trim();
    if (!ssid) continue;
    const old = map.get(ssid);
    if (!old || item.signal > old.signal) map.set(ssid, { ...item, ssid });
  }
  return Array.from(map.values()).sort((a, b) => b.signal - a.signal || a.ssid.localeCompare(b.ssid));
}

async function scanNetworks() {
  const result = await runCommand('netsh.exe', ['wlan', 'show', 'networks', 'mode=bssid']);
  if (!result.stdout.trim()) {
    return { success: false, networks: [], error: result.stderr || 'Windows returned no Wi-Fi scan results.' };
  }
  return { success: true, networks: parseNetworks(result.stdout) };
}

async function getCurrentConnection() {
  const result = await runCommand('netsh.exe', ['wlan', 'show', 'interfaces']);
  const match = String(result.stdout).replace(/\r/g, '').match(/^\s*SSID\s*:\s*(.*)$/im);
  return { success: true, ssid: match ? match[1].trim() : null };
}

async function listSavedProfiles() {
  const profileRoot = path.join(process.env.ProgramData || 'C:\\ProgramData', 'Microsoft', 'Wlansvc', 'Profiles', 'Interfaces');
  const command = `Get-ChildItem -Path ${psQuote(profileRoot)} -Filter *.xml -Recurse -ErrorAction SilentlyContinue | ForEach-Object { try { [xml]$x = Get-Content $_.FullName -Raw; if ($x.WLANProfile.name) { $x.WLANProfile.name } } catch {} } | Sort-Object -Unique`;
  const result = await runCommand('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command]);
  const profiles = String(result.stdout || '').split(/\r?\n/).map((v) => v.trim()).filter(Boolean);
  return { success: true, profiles };
}

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildProfileXml({ ssid, password, security }) {
  const name = xmlEscape(ssid);
  if (security === 'Open') {
    return `<?xml version="1.0"?><WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1"><name>${name}</name><SSIDConfig><SSID><name>${name}</name></SSID></SSIDConfig><connectionType>ESS</connectionType><connectionMode>auto</connectionMode><MSM><security><authEncryption><authentication>open</authentication><encryption>none</encryption><useOneX>false</useOneX></authEncryption></security></MSM></WLANProfile>`;
  }
  const authentication = security === 'WPA3SAE' ? 'WPA3SAE' : 'WPA2PSK';
  return `<?xml version="1.0"?><WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1"><name>${name}</name><SSIDConfig><SSID><name>${name}</name></SSID></SSIDConfig><connectionType>ESS</connectionType><connectionMode>auto</connectionMode><MSM><security><authEncryption><authentication>${authentication}</authentication><encryption>AES</encryption><useOneX>false</useOneX></authEncryption><sharedKey><keyType>passPhrase</keyType><protected>false</protected><keyMaterial>${xmlEscape(password)}</keyMaterial></sharedKey></security></MSM></WLANProfile>`;
}

async function runElevatedNetsh(args) {
  const tempScript = path.join(os.tmpdir(), `WinOptWifi_${Date.now()}_${Math.random().toString(16).slice(2)}.ps1`);
  const argumentList = args.map((arg) => psQuote(arg)).join(', ');
  const script = `$p = Start-Process -FilePath 'netsh.exe' -ArgumentList @(${argumentList}) -Verb RunAs -WindowStyle Hidden -Wait -PassThru\nexit $p.ExitCode\n`;
  try {
    fs.writeFileSync(tempScript, script, 'utf8');
    return await runCommand('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', tempScript]);
  } finally {
    try { fs.unlinkSync(tempScript); } catch (_) {}
  }
}

async function connectToNetwork({ ssid, password, security = 'WPA2PSK', saveScope = 'all' }) {
  const normalizedSsid = String(ssid || '').trim();
  if (!normalizedSsid) return { success: false, error: 'Wi-Fi network name (SSID) is required.' };
  if (security !== 'Open' && String(password || '').length < 8) {
    return { success: false, error: 'Wi-Fi password must be at least 8 characters.' };
  }

  const scope = saveScope === 'current' ? 'current' : 'all';
  const needsElevation = scope === 'all' && !(await isAdministrator());
  const profilePath = path.join(os.tmpdir(), `WinOptWifiProfile_${Date.now()}_${Math.random().toString(16).slice(2)}.xml`);

  try {
    fs.writeFileSync(profilePath, buildProfileXml({ ssid: normalizedSsid, password: String(password || ''), security }), 'utf8');
    const addArgs = ['wlan', 'add', 'profile', `filename=${profilePath}`, `user=${scope}`];
    const addResult = needsElevation ? await runElevatedNetsh(addArgs) : await runCommand('netsh.exe', addArgs);

    if (!addResult.success) {
      return { success: false, error: addResult.stderr || addResult.stdout || 'Windows could not save the Wi-Fi profile.' };
    }

    const connectResult = await runCommand('netsh.exe', ['wlan', 'connect', `name=${normalizedSsid}`]);
    if (!connectResult.success) {
      return { success: false, saved: true, error: connectResult.stderr || connectResult.stdout || 'Profile was saved, but Windows could not start the connection.' };
    }

    return {
      success: true,
      saved: true,
      scope,
      ssid: normalizedSsid,
      message: needsElevation
        ? 'Profile saved for all Windows users and connection started after administrator approval.'
        : 'Wi-Fi profile saved and connection started.'
    };
  } finally {
    try { fs.unlinkSync(profilePath); } catch (_) {}
  }
}

function uiScript() {
  return `(() => {
    const CARD = 'winopt-wifi-manager';
    const STYLE = 'winopt-wifi-manager-style';
    let networks = [];
    let selected = null;

    function addStyle() {
      if (document.getElementById(STYLE)) return;
      const style = document.createElement('style');
      style.id = STYLE;
      style.textContent = '#winopt-wifi-manager{margin-top:24px;background:#0F1423;border:1px solid #1F293D;border-radius:14px;padding:20px;color:#e2e8f0;box-shadow:0 18px 45px rgba(0,0,0,.25)}#winopt-wifi-manager .wow-row{display:flex;gap:10px;align-items:center;flex-wrap:wrap}#winopt-wifi-manager .wow-title{font-size:15px;font-weight:800;color:#f8fafc}#winopt-wifi-manager .wow-sub{font-size:11px;color:#94a3b8;margin-top:3px}#winopt-wifi-manager .wow-input,#winopt-wifi-manager .wow-select{background:#0B0F1A;border:1px solid #1F293D;color:#e2e8f0;border-radius:9px;padding:9px 10px;font-size:12px;outline:none;width:100%}#winopt-wifi-manager .wow-btn{border:1px solid #334155;background:#161B2A;color:#e2e8f0;border-radius:9px;padding:8px 11px;font-size:11px;font-weight:700;cursor:pointer}#winopt-wifi-manager .wow-btn:hover{border-color:#06b6d4;background:#1E293B}#winopt-wifi-manager .primary{background:linear-gradient(90deg,#0284C7,#2563EB);border-color:#0ea5e9;color:#fff}#winopt-wifi-manager .success{background:linear-gradient(90deg,#059669,#0f766e);border-color:#10b981;color:#fff}#winopt-wifi-manager .wow-pill{font-size:10px;padding:4px 8px;border-radius:999px;border:1px solid #334155;color:#93c5fd;background:#0c1b2e}#winopt-wifi-manager .wow-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:14px}#winopt-wifi-manager .wow-net{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:11px 12px;background:#0B0F1A;border:1px solid #1F293D;border-radius:10px;margin-top:8px}#winopt-wifi-manager .wow-net-name{font-size:12px;font-weight:700;color:#f8fafc;word-break:break-word}#winopt-wifi-manager .wow-net-meta{font-size:10px;color:#94a3b8;margin-top:2px}#winopt-wifi-manager .wow-empty{font-size:11px;color:#64748b;text-align:center;padding:18px;border:1px dashed #334155;border-radius:10px;margin-top:10px}#winopt-wifi-manager .wow-status{font-size:11px;margin-top:10px;padding:9px 10px;border-radius:9px;background:#0b1220;border:1px solid #1f293d}#winopt-wifi-manager .ok{color:#6ee7b7;border-color:#065f46;background:#06261f}#winopt-wifi-manager .err{color:#fda4af;border-color:#7f1d1d;background:#2a0d12}#winopt-wifi-manager .wow-perm{font-size:10px;color:#94a3b8}#winopt-wifi-manager .wow-modal{margin-top:12px;padding:12px;border:1px solid #1F293D;border-radius:11px;background:#0B0F1A}@media(max-width:900px){#winopt-wifi-manager .wow-grid{grid-template-columns:1fr}}';
      document.head.append(style);
    }

    function routerRoot() {
      const heading = Array.from(document.querySelectorAll('h2')).find((n) => /Universal Router Management Console/i.test(n.textContent || ''));
      if (!heading) return null;
      let node = heading;
      while (node?.parentElement) {
        node = node.parentElement;
        if (node.classList.contains('flex') && node.classList.contains('flex-col') && node.classList.contains('space-y-6')) return node;
      }
      return null;
    }

    function make(tag, props = {}) {
      const node = document.createElement(tag);
      Object.entries(props).forEach(([key, value]) => {
        if (key === 'text') node.textContent = value;
        else if (key === 'className') node.className = value;
        else node.setAttribute(key, value);
      });
      return node;
    }

    function status(text, ok) {
      const node = document.querySelector('#winopt-wifi-manager .wow-status');
      if (!node) return;
      node.textContent = text;
      node.className = 'wow-status ' + (ok ? 'ok' : 'err');
    }

    function render() {
      const list = document.querySelector('#winopt-wifi-manager .wow-list');
      const filter = (document.querySelector('#winopt-wifi-manager .wow-search')?.value || '').toLowerCase();
      if (!list) return;
      list.textContent = '';
      const visible = networks.filter((n) => n.ssid.toLowerCase().includes(filter));
      if (!visible.length) {
        list.append(make('div', { className:'wow-empty', text: networks.length ? 'No network matches the search.' : 'Press Scan Networks to discover nearby Wi-Fi.' }));
        return;
      }
      visible.forEach((network) => {
        const row = make('div', { className:'wow-net' });
        const info = document.createElement('div');
        info.append(make('div', { className:'wow-net-name', text:network.ssid }));
        info.append(make('div', { className:'wow-net-meta', text:(network.security || 'WPA2') + ' • Signal ' + String(network.signal || 0) + '%' }));
        const btn = make('button', { className:'wow-btn primary', text:'Connect' });
        btn.addEventListener('click', () => openConnect(network));
        row.append(info, btn);
        list.append(row);
      });
    }

    async function metadata() {
      const api = window.electronAPI;
      if (!api?.wifiApi) return;
      const statusResult = await api.wifiApi('status');
      const profiles = await api.wifiApi('profiles');
      const elevated = await api.checkElevation?.();
      const current = document.querySelector('#winopt-wifi-manager .wow-current');
      const perm = document.querySelector('#winopt-wifi-manager .wow-perm');
      if (current) current.textContent = statusResult?.ssid ? 'Connected: ' + statusResult.ssid : 'Not connected';
      if (perm) perm.textContent = elevated ? 'Administrator permission available' : 'Standard user • Save-for-all-users will request UAC';
      if (perm && profiles?.profiles?.length) perm.textContent += ' • Saved profiles: ' + profiles.profiles.length;
    }

    async function scan() {
      const api = window.electronAPI;
      status('Scanning nearby Wi-Fi networks…');
      const result = await api.wifiApi('scan');
      if (!result?.success) { status(result?.error || 'Wi-Fi scan failed.'); return; }
      networks = result.networks || [];
      render();
      status('Found ' + networks.length + ' nearby network(s).', true);
      metadata();
    }

    function openConnect(network) {
      selected = network;
      const modal = document.querySelector('#winopt-wifi-manager .wow-modal');
      const name = document.querySelector('#winopt-wifi-manager .wow-selected');
      const password = document.querySelector('#winopt-wifi-manager .wow-password');
      const security = document.querySelector('#winopt-wifi-manager .wow-security');
      if (!modal || !name || !password || !security) return;
      modal.hidden = false;
      name.textContent = network.ssid;
      password.value = '';
      security.value = network.security === 'WPA3' ? 'WPA3SAE' : network.security === 'Open' ? 'Open' : 'WPA2PSK';
      password.disabled = security.value === 'Open';
      password.focus();
    }

    async function connectSelected() {
      if (!selected) return;
      const api = window.electronAPI;
      const password = document.querySelector('#winopt-wifi-manager .wow-password')?.value || '';
      const security = document.querySelector('#winopt-wifi-manager .wow-security')?.value || 'WPA2PSK';
      const saveScope = document.querySelector('#winopt-wifi-manager .wow-scope')?.value || 'all';
      status('Saving the Windows Wi-Fi profile and starting connection…');
      const result = await api.wifiApi('connect', { ssid:selected.ssid, password, security, saveScope });
      if (!result?.success) { status(result?.error || 'Windows could not connect to this network.'); return; }
      status(result.message || 'Connected and saved.', true);
      document.querySelector('#winopt-wifi-manager .wow-modal').hidden = true;
      selected = null;
      metadata();
    }

    function mount() {
      if (document.getElementById(CARD)) return;
      const root = routerRoot();
      if (!root) return;
      addStyle();

      const card = make('section', { id:CARD });
      const head = make('div', { className:'wow-row' });
      const titleBox = make('div', { style:'flex:1;min-width:240px' });
      titleBox.append(make('div', { className:'wow-title', text:'Windows Wi-Fi Network Manager' }));
      titleBox.append(make('div', { className:'wow-sub', text:'Scan nearby networks, enter the password, connect, and securely save the Windows WLAN profile.' }));
      head.append(titleBox);
      head.append(make('span', { className:'wow-pill wow-current', text:'Checking connection…' }));
      head.append(make('span', { className:'wow-perm', text:'Checking permissions…' }));
      const scanButton = make('button', { className:'wow-btn primary', text:'Scan Networks' });
      scanButton.addEventListener('click', scan);
      head.append(scanButton);

      const search = make('input', { className:'wow-input wow-search', type:'search', placeholder:'Search available Wi-Fi networks…', style:'margin-top:14px' });
      search.addEventListener('input', render);
      const list = make('div', { className:'wow-list' });

      const modal = make('div', { className:'wow-modal' });
      modal.hidden = true;
      const modalHead = make('div', { className:'wow-row' });
      const selectedWrap = make('div', { style:'flex:1' });
      selectedWrap.append(make('div', { className:'wow-sub', text:'Selected network' }));
      selectedWrap.append(make('div', { className:'wow-net-name wow-selected', text:'-' }));
      const cancel = make('button', { className:'wow-btn', text:'Cancel' });
      cancel.addEventListener('click', () => { modal.hidden = true; selected = null; });
      modalHead.append(selectedWrap, cancel);

      const grid = make('div', { className:'wow-grid' });
      const password = make('input', { className:'wow-input wow-password', type:'password', placeholder:'Wi-Fi password' });
      const security = make('select', { className:'wow-select wow-security' });
      security.append(
        make('option', { value:'WPA2PSK', text:'WPA2 / Personal' }),
        make('option', { value:'WPA3SAE', text:'WPA3 / Personal' }),
        make('option', { value:'Open', text:'Open / No password' })
      );
      security.addEventListener('change', () => { password.disabled = security.value === 'Open'; });
      const scope = make('select', { className:'wow-select wow-scope' });
      scope.append(
        make('option', { value:'all', text:'Save for all Windows users (Administrator)' }),
        make('option', { value:'current', text:'Save for current Windows user' })
      );
      grid.append(password, security, scope);

      const actionRow = make('div', { className:'wow-row', style:'margin-top:12px;justify-content:flex-end' });
      const connect = make('button', { className:'wow-btn success', text:'Save Profile & Connect' });
      connect.addEventListener('click', connectSelected);
      actionRow.append(connect);
      modal.append(modalHead, grid, actionRow);

      const statusNode = make('div', { className:'wow-status ok', text:'Ready.' });
      card.append(head, search, list, modal, statusNode);
      root.insertBefore(card, root.children[1] || null);
      render();
      metadata();
    }

    const observer = new MutationObserver(mount);
    observer.observe(document.documentElement, { childList:true, subtree:true });
    mount();
    setInterval(mount, 1200);
  })();`;
}

function registerWifiManager(mainWindow) {
  if (registered) return;
  registered = true;

  ipcMain.handle('wifi-api', async (_event, action, data = {}) => {
    try {
      if (action === 'scan') return await scanNetworks();
      if (action === 'status') return await getCurrentConnection();
      if (action === 'profiles') return await listSavedProfiles();
      if (action === 'is-admin') return { success: true, isAdmin: await isAdministrator() };
      if (action === 'connect') return await connectToNetwork(data);
      return { success: false, error: `Unknown Wi-Fi action: ${action}` };
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
  });

  const inject = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.executeJavaScript(uiScript(), true).catch(() => {});
  };

  mainWindow.webContents.on('did-finish-load', inject);
  mainWindow.webContents.on('dom-ready', () => setTimeout(inject, 350));
  if (!mainWindow.webContents.isLoadingMainFrame()) inject();

  mainWindow.once('closed', () => {
    try { ipcMain.removeHandler('wifi-api'); } catch (_) {}
  });
}

module.exports = { registerWifiManager };
