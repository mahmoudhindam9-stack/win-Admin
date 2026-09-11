const { ipcMain } = require('electron');
const { execFile, exec } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

let registered = false;

function runCommand(file, args, options = {}) {
  return new Promise((resolve) => {
    execFile(file, args, { windowsHide: true, maxBuffer: 4 * 1024 * 1024, ...options }, (error, stdout = '', stderr = '') => {
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

function runCmdCommand(cmdString) {
  return new Promise((resolve) => {
    exec(`chcp 65001 >nul && ${cmdString}`, { windowsHide: true, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8' }, (error, stdout = '', stderr = '') => {
      resolve({
        success: !error,
        stdout: String(stdout),
        stderr: String(stderr),
        error: error?.message || null,
      });
    });
  });
}

function runPowerShellCommand(command) {
  return runCommand('powershell.exe', [
    '-NoLogo',
    '-NoProfile',
    '-NonInteractive',
    '-ExecutionPolicy', 'Bypass',
    '-Command',
    `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${command}`
  ]);
}

async function isAdministrator() {
  const result = await runPowerShellCommand(
    '[Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent() | ForEach-Object { $_.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator) }'
  );
  return result.success && String(result.stdout).trim().toLowerCase() === 'true';
}

function parseNetworks(text) {
  const lines = String(text).replace(/\r/g, '').split('\n');
  const raw = [];
  let current = null;
  let hiddenCount = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Reject BSSID lines from being treated as SSID
    const isBssid = /^\s*(?:BSSID|معرف BSSID|معرّف BSSID)/i.test(trimmed);

    // Multilingual SSID match:
    // English: "SSID 1 : Name", "SSID : Name"
    // Arabic: "معرف SSID 1 : Name", "معرّف SSID 1 : Name", "معرف مجموعة الخدمات (SSID) : Name"
    const ssidMatch = !isBssid && trimmed.match(/^(?:معرّف مجموعة الخدمات \(SSID\)|معرف مجموعة الخدمات \(SSID\)|معرّف SSID|معرف SSID|SSID)\s*\d*\s*:\s*(.*)$/i);
    if (ssidMatch) {
      if (current && current.ssid) raw.push(current);
      let ssidName = ssidMatch[1].trim();
      if (!ssidName) {
        hiddenCount += 1;
        ssidName = hiddenCount > 1 ? `Hidden Network ${hiddenCount}` : 'Hidden Network';
      }
      current = {
        ssid: ssidName,
        signal: 0,
        security: 'WPA2',
        channel: 0,
        radioType: '',
        isHidden: ssidName.startsWith('Hidden Network')
      };
      continue;
    }

    if (!current) continue;

    // Signal matching: "Signal : 92%", "الإشارة : 92%", or any "xx%"
    const signalMatch = trimmed.match(/(?:Signal|الإشارة|الاشارة|Señal|Signale?)\s*:\s*(\d{1,3})%/i) || trimmed.match(/(\d{1,3})\s*%/);
    if (signalMatch && current.signal === 0) {
      current.signal = Math.min(100, Math.max(1, Number(signalMatch[1])));
    }

    // Security / Authentication: "Authentication : WPA2-Personal", "المصادقة : WPA2-Personal"
    const authMatch = trimmed.match(/(?:Authentication|المصادقة|المصادقه|Authentification)\s*:\s*(.*)$/i);
    if (authMatch) {
      const authStr = authMatch[1];
      if (/WPA3/i.test(authStr)) current.security = 'WPA3';
      else if (/WPA2/i.test(authStr)) current.security = 'WPA2';
      else if (/Open|مفتوح|None|بلا|Ouvert/i.test(authStr)) current.security = 'Open';
      else if (/WPA/i.test(authStr)) current.security = 'WPA';
    }

    // Channel: "Channel : 6", "القناة : 6"
    const channelMatch = trimmed.match(/(?:Channel|القناة|القناه|Canal|Kanal)\s*:\s*(\d+)/i);
    if (channelMatch && !current.channel) {
      current.channel = Number(channelMatch[1]);
    }

    // Radio Type: "Radio type : 802.11ax", "نوع الراديو : 802.11ax"
    const radioMatch = trimmed.match(/(?:Radio type|نوع الراديو|Type de radio)\s*:\s*(.*)$/i);
    if (radioMatch && !current.radioType) {
      current.radioType = radioMatch[1].trim();
    }
  }

  if (current && current.ssid) raw.push(current);

  // Group by SSID to deduplicate multiple BSSIDs (keep highest signal)
  const map = new Map();
  for (const item of raw) {
    const ssid = item.ssid.trim();
    if (!ssid) continue;
    // For hidden networks, allow distinct entries
    const key = item.isHidden ? `${item.ssid}_${item.channel || Math.random()}` : ssid;
    const old = map.get(key);
    if (!old || item.signal > old.signal) {
      map.set(key, {
        ...item,
        ssid,
        signal: item.signal || 65 // fallback to decent signal if mode=bssid was omitted
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.signal - a.signal || a.ssid.localeCompare(b.ssid));
}

// Active hardware Wi-Fi airwave scan using native Windows wlanapi.dll or Windows.Devices.WiFi:
// Forces the physical Wi-Fi NIC to send 802.11 probe requests and populate fresh BSSID cache,
// exactly like what happens when a user opens the Windows Wi-Fi flyout.
let lastHardwareScanTime = 0;
async function triggerActiveWlanHardwareScan() {
  const now = Date.now();
  if (now - lastHardwareScanTime < 3000) return; // Debounce hardware scan to once every 3 seconds
  lastHardwareScanTime = now;

  const triggerScript = `
$ErrorActionPreference = 'SilentlyContinue'
try {
  [Windows.Devices.WiFi.WiFiAdapter, Windows.Devices.WiFi, ContentType = WindowsRuntime] | Out-Null
  $adapters = [Windows.Devices.WiFi.WiFiAdapter]::FindAllAdaptersAsync().GetAwaiter().GetResult()
  foreach ($a in $adapters) {
    $a.ScanAsync().GetAwaiter().GetResult()
  }
} catch {
  # Fallback to WlanScan via WlanAPI if WinRT is unavailable
  try {
    Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;
    public class WlanActiveProber {
      [DllImport("wlanapi.dll")]
      private static extern int WlanOpenHandle(uint dwClientVersion, IntPtr pReserved, out uint pdwNegotiatedVersion, out IntPtr phClientHandle);
      [DllImport("wlanapi.dll")]
      private static extern int WlanCloseHandle(IntPtr hClientHandle, IntPtr pReserved);
      [DllImport("wlanapi.dll")]
      private static extern int WlanEnumInterfaces(IntPtr hClientHandle, IntPtr pReserved, out IntPtr ppInterfaceList);
      [DllImport("wlanapi.dll")]
      private static extern int WlanScan(IntPtr hClientHandle, ref Guid pInterfaceGuid, IntPtr pDot11Ssid, IntPtr pIeData, IntPtr pReserved);
      [DllImport("wlanapi.dll")]
      private static extern void WlanFreeMemory(IntPtr pMemory);

      public static void ScanAll() {
        IntPtr client = IntPtr.Zero;
        uint version = 0;
        try {
          if (WlanOpenHandle(2, IntPtr.Zero, out version, out client) != 0) return;
          IntPtr ifaceListPtr = IntPtr.Zero;
          if (WlanEnumInterfaces(client, IntPtr.Zero, out ifaceListPtr) != 0 || ifaceListPtr == IntPtr.Zero) return;
          int count = Marshal.ReadInt32(ifaceListPtr);
          IntPtr current = new IntPtr(ifaceListPtr.ToInt64() + 8);
          for (int i = 0; i < count; i++) {
            byte[] guidBytes = new byte[16];
            Marshal.Copy(current, guidBytes, 0, 16);
            Guid guid = new Guid(guidBytes);
            WlanScan(client, ref guid, IntPtr.Zero, IntPtr.Zero, IntPtr.Zero);
            current = new IntPtr(current.ToInt64() + 532);
          }
          WlanFreeMemory(ifaceListPtr);
        } catch {}
        finally {
          if (client != IntPtr.Zero) WlanCloseHandle(client, IntPtr.Zero);
        }
      }
    }
"@ -ErrorAction SilentlyContinue
    [WlanActiveProber]::ScanAll()
    Start-Sleep -Seconds 1
  } catch {}
}
`;
  await runPowerShellCommand(triggerScript);
  // Wait just an additional 1s for the airwaves list to settle in the OS cache
  await new Promise((r) => setTimeout(r, 1000));
}

async function scanNetworks() {
  // Actively trigger physical Wi-Fi NIC probe request so results are updated in real-time
  try {
    await triggerActiveWlanHardwareScan();
  } catch (_) {}

  let text = '';
  let networks = [];

  // Attempt 1: Native direct netsh call with mode=bssid
  const directBssid = await runCommand('netsh.exe', ['wlan', 'show', 'networks', 'mode=bssid']);
  if (directBssid.success && directBssid.stdout) {
    text = directBssid.stdout;
    networks = parseNetworks(text);
  }

  // Attempt 2: If direct netsh returned 0 networks, try via cmd with UTF-8 chcp 65001
  if (networks.length === 0) {
    const cmdRes = await runCmdCommand('netsh wlan show networks mode=bssid');
    if (cmdRes.success && cmdRes.stdout) {
      text = cmdRes.stdout;
      networks = parseNetworks(text);
    }
  }

  // Attempt 3: If still 0 networks, try PowerShell UTF-8
  if (networks.length === 0) {
    const psRes = await runPowerShellCommand('& netsh.exe wlan show networks mode=bssid');
    if (psRes.success && psRes.stdout) {
      text = psRes.stdout;
      networks = parseNetworks(text);
    }
  }

  // Attempt 4: Standard show networks (without mode=bssid)
  if (networks.length === 0) {
    const directStandard = await runCommand('netsh.exe', ['wlan', 'show', 'networks']);
    if (directStandard.success && directStandard.stdout) {
      text = directStandard.stdout;
      networks = parseNetworks(text);
    }
  }

  // 3. Get current active connection details
  const ifaceRes = await getCurrentConnection();

  return {
    success: true,
    networks,
    interface: ifaceRes.description || ifaceRes.state || null,
    connectedSSID: ifaceRes.ssid || null,
    error: networks.length === 0 ? 'No wireless networks found in range or Wi-Fi adapter is turned off.' : null
  };
}

async function getCurrentConnection() {
  let text = '';
  const directRes = await runCommand('netsh.exe', ['wlan', 'show', 'interfaces']);
  if (directRes.success && directRes.stdout) {
    text = directRes.stdout;
  } else {
    const psRes = await runPowerShellCommand('& netsh.exe wlan show interfaces');
    text = String(psRes.stdout || '');
  }

  const cleanText = text.replace(/\r/g, '');

  // Multilingual SSID & Profile regex
  const nameMatch = cleanText.match(/(?:Name|الاسم|Nom)\s*:\s*(.+)$/im);
  const ssidMatch = cleanText.match(/(?:معرّف مجموعة الخدمات \(SSID\)|معرف مجموعة الخدمات \(SSID\)|معرّف SSID|معرف SSID|^\s*SSID)\s*:\s*(.+)$/im);
  const profileMatch = cleanText.match(/(?:Profile|ملف التعريف)\s*:\s*(.+)$/im);
  const stateMatch = cleanText.match(/(?:State|الحالة|الحاله)\s*:\s*(.+)$/im);
  const descMatch = cleanText.match(/(?:Description|الوصف)\s*:\s*(.+)$/im);
  const signalMatch = cleanText.match(/(?:Signal|الإشارة|الاشارة)\s*:\s*(\d{1,3})%/im);
  const channelMatch = cleanText.match(/(?:Channel|القناة|القناه)\s*:\s*(\d+)/im);

  const stateStr = stateMatch ? stateMatch[1].trim() : '';
  const isConnected = /connected|متصل/i.test(stateStr) && !/disconnected|غير متصل/i.test(stateStr);

  // If the interface is not in connected state, active SSID is strictly null
  const foundSsid = isConnected && ssidMatch ? ssidMatch[1].trim() : (isConnected && profileMatch ? profileMatch[1].trim() : null);

  return {
    success: true,
    ssid: foundSsid,
    interfaceName: nameMatch ? nameMatch[1].trim() : null,
    state: stateStr || (foundSsid ? 'connected' : 'disconnected'),
    description: descMatch ? descMatch[1].trim() : null,
    signal: signalMatch ? Number(signalMatch[1]) : null,
    channel: channelMatch ? Number(channelMatch[1]) : null
  };
}

async function listSavedProfiles() {
  const directRes = await runCommand('netsh.exe', ['wlan', 'show', 'profiles']);
  let text = directRes.stdout || '';
  if (!text) {
    const psRes = await runPowerShellCommand('& netsh.exe wlan show profiles');
    text = psRes.stdout || '';
  }

  const lines = String(text).replace(/\r/g, '').split('\n');
  const profiles = [];

  for (const line of lines) {
    const match = line.match(/(?:All User Profile|ملف تعريف كل المستخدمين|User Profile|ملف تعريف المستخدم)\s*:\s*(.+)$/i);
    if (match) {
      const name = match[1].trim();
      if (name && !profiles.includes(name)) profiles.push(name);
    }
  }

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

function getCredentialsPath() {
  const appData = process.env.APPDATA || (process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Application Support') : path.join(os.homedir(), '.config'));
  const dir = path.join(appData, 'WindowsPerformanceOptimizer');
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  }
  return path.join(dir, 'wifi_credentials.json');
}

function loadSavedCredentials() {
  try {
    const p = getCredentialsPath();
    if (fs.existsSync(p)) {
      return JSON.parse(fs.readFileSync(p, 'utf8') || '{}');
    }
  } catch (_) {}
  return {};
}

function saveCredential(ssid, password) {
  if (!ssid || !password) return;
  try {
    const p = getCredentialsPath();
    const creds = loadSavedCredentials();
    creds[ssid] = password;
    fs.writeFileSync(p, JSON.stringify(creds, null, 2), 'utf8');
  } catch (_) {}
}

function buildProfileXml({ ssid, password, security }) {
  const name = xmlEscape(ssid);
  const hex = Buffer.from(ssid, 'utf8').toString('hex').toUpperCase();

  if (security === 'Open') {
    return `<?xml version="1.0" encoding="UTF-8"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
    <name>${name}</name>
    <SSIDConfig>
        <SSID>
            <hex>${hex}</hex>
            <name>${name}</name>
        </SSID>
        <nonBroadcast>false</nonBroadcast>
    </SSIDConfig>
    <connectionType>ESS</connectionType>
    <connectionMode>auto</connectionMode>
    <autoSwitch>false</autoSwitch>
    <MSM>
        <security>
            <authEncryption>
                <authentication>open</authentication>
                <encryption>none</encryption>
                <useOneX>false</useOneX>
            </authEncryption>
        </security>
    </MSM>
</WLANProfile>`;
  }

  const authentication = security === 'WPA3SAE' ? 'WPA3SAE' : 'WPA2PSK';
  const encryption = 'AES';

  return `<?xml version="1.0" encoding="UTF-8"?>
<WLANProfile xmlns="http://www.microsoft.com/networking/WLAN/profile/v1">
    <name>${name}</name>
    <SSIDConfig>
        <SSID>
            <hex>${hex}</hex>
            <name>${name}</name>
        </SSID>
        <nonBroadcast>false</nonBroadcast>
    </SSIDConfig>
    <connectionType>ESS</connectionType>
    <connectionMode>auto</connectionMode>
    <autoSwitch>false</autoSwitch>
    <MSM>
        <security>
            <authEncryption>
                <authentication>${authentication}</authentication>
                <encryption>${encryption}</encryption>
                <useOneX>false</useOneX>
            </authEncryption>
            <sharedKey>
                <keyType>passPhrase</keyType>
                <protected>false</protected>
                <keyMaterial>${xmlEscape(password)}</keyMaterial>
            </sharedKey>
        </security>
    </MSM>
</WLANProfile>`;
}

async function connectToExistingProfile(ssid) {
  const normalizedSsid = String(ssid || '').trim();
  if (!normalizedSsid) return { success: false, error: 'Wi-Fi network name (SSID) is required.' };

  // Get current active connection
  const initialConn = await getCurrentConnection();
  if (initialConn.ssid === normalizedSsid) {
    return {
      success: true,
      ssid: normalizedSsid,
      message: `Already connected to "${normalizedSsid}".`
    };
  }

  // If currently connected to another SSID, disconnect first so Windows WLAN driver releases association
  if (initialConn.ssid) {
    await runCommand('netsh.exe', ['wlan', 'disconnect']);
    await runCmdCommand('netsh wlan disconnect');
    await new Promise(r => setTimeout(r, 600));
  }

  const safeName = normalizedSsid.replace(/"/g, '""');
  const safePs = normalizedSsid.replace(/"/g, '`"');
  const iface = initialConn.interfaceName ? ` interface="${initialConn.interfaceName}"` : '';

  // Execute connect via CMD with UTF-8 code page
  let cmdRes = await runCmdCommand(`netsh wlan connect name="${safeName}" ssid="${safeName}"${iface}`);
  if (!cmdRes.success || !cmdRes.stdout) {
    await runCommand('netsh.exe', ['wlan', 'connect', `name=${normalizedSsid}`, `ssid=${normalizedSsid}`]);
  }
  await runPowerShellCommand(`& netsh.exe wlan connect name="${safePs}" ssid="${safePs}"`);

  // Verify whether Windows established or is actively associating with the connection
  let connected = false;
  let activeConn = null;
  for (let attempt = 0; attempt < 8; attempt++) {
    await new Promise(r => setTimeout(r, 1000));
    activeConn = await getCurrentConnection();
    if (activeConn.ssid === normalizedSsid) {
      connected = true;
      break;
    }
    // If state indicates connecting, give Windows WLAN driver additional time
    if (activeConn.state && /connecting|جار/i.test(activeConn.state)) {
      await new Promise(r => setTimeout(r, 1200));
      activeConn = await getCurrentConnection();
      if (activeConn.ssid === normalizedSsid) {
        connected = true;
        break;
      }
    }
  }

  if (connected) {
    return {
      success: true,
      ssid: normalizedSsid,
      message: `Windows connection established to "${normalizedSsid}".`
    };
  }

  // Double check Windows network profile
  const postCheck = await getCurrentConnection();
  if (postCheck.ssid === normalizedSsid) {
    return {
      success: true,
      ssid: normalizedSsid,
      message: `Windows connection established to "${normalizedSsid}".`
    };
  }

  return {
    success: false,
    ssid: postCheck.ssid || null,
    error: `Windows did not complete connection to "${normalizedSsid}". Current active network remains: "${postCheck.ssid || 'None'}". Please verify the password or signal quality.`
  };
}

async function connectToNetwork({ ssid, password, security = 'WPA2PSK', saveScope = 'current' }) {
  const normalizedSsid = String(ssid || '').trim();
  if (!normalizedSsid) return { success: false, error: 'Wi-Fi network name (SSID) is required.' };

  // Retrieve cached password if none was supplied in this request
  let finalPassword = typeof password === 'string' ? password.trim() : '';
  if (!finalPassword) {
    const creds = loadSavedCredentials();
    if (creds[normalizedSsid]) {
      finalPassword = creds[normalizedSsid];
    }
  }

  // If password exists, cache it
  if (finalPassword) {
    saveCredential(normalizedSsid, finalPassword);
  }

  // If network is Open or has valid password, generate & register Windows profile XML
  if (security === 'Open' || (finalPassword && finalPassword.length >= 8)) {
    const profileXml = buildProfileXml({ ssid: normalizedSsid, password: finalPassword, security });
    const profilePath = path.join(os.tmpdir(), `WinOptWifi_${Date.now()}.xml`);

    try {
      fs.writeFileSync(profilePath, profileXml, 'utf8');

      // Add profile via netsh (try user=current first, then user=all)
      await runCommand('netsh.exe', ['wlan', 'add', 'profile', `filename=${profilePath}`, 'user=current']);
      await runCommand('netsh.exe', ['wlan', 'add', 'profile', `filename=${profilePath}`, 'user=all']);
      await runCmdCommand(`netsh wlan add profile filename="${profilePath}" user=current`);
      await runPowerShellCommand(`& netsh.exe wlan add profile filename="${profilePath}" user=current`);
    } catch (err) {
      console.error('Failed to create WLAN profile XML:', err);
    } finally {
      try { fs.unlinkSync(profilePath); } catch (_) {}
    }
  }

  // Connect to the profile in Windows
  return await connectToExistingProfile(normalizedSsid);
}

async function disconnectWifi() {
  await runCommand('netsh.exe', ['wlan', 'disconnect']);
  return { success: true, message: 'Wi-Fi network disconnected.' };
}

async function deleteProfile(ssid) {
  const normalizedSsid = String(ssid || '').trim();
  if (!normalizedSsid) return { success: false, error: 'SSID is required to delete profile.' };
  await runCommand('netsh.exe', ['wlan', 'delete', 'profile', `name=${normalizedSsid}`]);
  return { success: true, message: `Profile "${normalizedSsid}" removed from Windows.` };
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
      if (action === 'disconnect') return await disconnectWifi();
      if (action === 'delete-profile' || action === 'forget') return await deleteProfile(data.ssid);
      return { success: false, error: `Unknown Wi-Fi action: ${action}` };
    } catch (error) {
      return { success: false, error: error?.message || String(error) };
    }
  });

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.once('closed', () => {
      try { ipcMain.removeHandler('wifi-api'); } catch (_) {}
      registered = false;
    });
  }
}

module.exports = {
  registerWifiManager,
  scanNetworks,
  getCurrentConnection,
  listSavedProfiles,
  parseNetworks,
  connectToNetwork,
  connectToExistingProfile,
  disconnectWifi,
  deleteProfile
};
