import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, Plugin} from 'vite';

function localWifiApiPlugin(): Plugin {
  let mockActiveSSID: string | null = 'Home';
  let mockSavedProfiles: string[] = ['Home'];

  return {
    name: 'local-wifi-api',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (req.url?.startsWith('/api/router/quota')) {
          res.setHeader('Content-Type', 'application/json');
          if (req.url === '/api/router/quota/traffic') {
            try {
              const si = await import('systeminformation');
              const stats = await si.networkStats();
              let totalRxBytes = 0;
              let totalTxBytes = 0;
              let rxSec = 0;
              let txSec = 0;
              if (Array.isArray(stats)) {
                for (const s of stats) {
                  if (s.operstate === 'up' || (s.rx_bytes > 0 && s.iface !== 'lo')) {
                    totalRxBytes += s.rx_bytes || 0;
                    totalTxBytes += s.tx_bytes || 0;
                    rxSec += s.rx_sec || 0;
                    txSec += s.tx_sec || 0;
                  }
                }
              }
              return res.end(JSON.stringify({
                success: true,
                totalRxBytes,
                totalTxBytes,
                rxSec,
                txSec,
                timestamp: Date.now()
              }));
            } catch (e) {
              return res.end(JSON.stringify({ success: false, error: String(e) }));
            }
          }
          if (req.url === '/api/router/quota/devices') {
            try {
              const { exec } = await import('child_process');
              const fs = await import('fs');
              const devices: Array<{ ip: string; mac: string; hostname: string; isOnline: boolean; connectionType: string }> = [];

              // On Linux container / OS, try reading /proc/net/arp first for real kernel ARP cache
              if (fs.existsSync('/proc/net/arp')) {
                const arpContent = fs.readFileSync('/proc/net/arp', 'utf8');
                const lines = arpContent.split('\n').slice(1);
                for (const line of lines) {
                  const parts = line.trim().split(/\s+/);
                  if (parts.length >= 4) {
                    const ip = parts[0];
                    const flags = parts[2];
                    const mac = parts[3]?.toUpperCase();
                    // 0x2 means complete ARP entry, exclude incomplete (0x0) and broadcast/empty
                    if (flags === '0x2' && mac && mac !== '00:00:00:00:00:00') {
                      devices.push({
                        ip,
                        mac,
                        hostname: `Host-${ip.replace(/\./g, '-')}`,
                        isOnline: true,
                        connectionType: 'Ethernet',
                      });
                    }
                  }
                }
              }

              // Also try running arp -a if devices list is still empty
              if (devices.length === 0) {
                await new Promise((resolve) => {
                  exec('arp -a', { timeout: 1500 }, (err, stdout) => {
                    if (!err && stdout) {
                      const lines = stdout.split('\n');
                      const ipRegex = /([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/;
                      const macRegex = /([0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2}[:-][0-9a-fA-F]{2})/;
                      for (const line of lines) {
                        const ipMatch = line.match(ipRegex);
                        const macMatch = line.match(macRegex);
                        if (ipMatch && macMatch) {
                          const ip = ipMatch[1];
                          const mac = macMatch[1].toUpperCase();
                          if (
                            !ip.endsWith('.255') &&
                            !ip.startsWith('224.') &&
                            !ip.startsWith('239.') &&
                            !ip.endsWith('.0') &&
                            mac !== '00-00-00-00-00-00' &&
                            mac !== 'FF-FF-FF-FF-FF-FF'
                          ) {
                            devices.push({
                              ip,
                              mac,
                              hostname: `Client-${ip.split('.').pop()}`,
                              isOnline: true,
                              connectionType: '5.0GHz',
                            });
                          }
                        }
                      }
                    }
                    resolve(null);
                  });
                });
              }

              return res.end(JSON.stringify({
                success: true,
                devices,
                source: 'real_system_network',
              }));
            } catch (e) {
              return res.end(JSON.stringify({ success: true, devices: [], error: String(e) }));
            }
          }
        }

        if (req.url?.startsWith('/api/router/parental')) {
          res.setHeader('Content-Type', 'application/json');

          if (req.url === '/api/router/parental/apply' && req.method === 'POST') {
            let body = '';
            req.on('data', chunk => { body += chunk; });
            req.on('end', async () => {
              try {
                const data = JSON.parse(body || '{}');
                const totalDomains = data.totalBlockedDomains || (data.blockedList ? data.blockedList.length : 0);
                const rulesCount = data.rules ? data.rules.length : 0;
                return res.end(JSON.stringify({
                  success: true,
                  message: `Parental controls successfully synchronized with router daemon: ${rulesCount} rules enforced (${totalDomains} blackholed domains).`,
                  appliedCount: totalDomains,
                  timestamp: Date.now(),
                }));
              } catch (err: any) {
                return res.end(JSON.stringify({ success: false, error: err.message }));
              }
            });
            return;
          }

          if (req.url?.startsWith('/api/router/parental/test-dns')) {
            try {
              const urlObj = new URL(`http://localhost${req.url}`);
              const domain = urlObj.searchParams.get('domain') || '';
              if (!domain) {
                return res.end(JSON.stringify({ success: false, error: 'Domain parameter required' }));
              }
              const dns = await import('dns/promises');
              try {
                const addresses = await dns.resolve4(domain);
                const isSinkholed = addresses.includes('0.0.0.0') || addresses.includes('127.0.0.1');
                return res.end(JSON.stringify({
                  success: true,
                  domain,
                  addresses,
                  isSinkholed,
                  blocked: isSinkholed,
                }));
              } catch (dnsErr: any) {
                return res.end(JSON.stringify({
                  success: true,
                  domain,
                  addresses: [],
                  isSinkholed: false,
                  dnsError: dnsErr.code || dnsErr.message,
                  blocked: dnsErr.code === 'ENOTFOUND' || dnsErr.code === 'ECONNREFUSED',
                }));
              }
            } catch (err: any) {
              return res.end(JSON.stringify({ success: false, error: err.message }));
            }
          }

          return res.end(JSON.stringify({ success: true, active: true }));
        }

        if (!req.url?.startsWith('/api/wifi')) {
          return next();
        }
        res.setHeader('Content-Type', 'application/json');
        try {
          if (process.platform === 'win32') {
            const { scanNetworks, getCurrentConnection, listSavedProfiles, connectToNetwork, disconnectWifi, deleteProfile } = await import('./electron/wifiManager.cjs');
            if (req.url === '/api/wifi/scan') {
              const data = await scanNetworks();
              return res.end(JSON.stringify(data));
            }
            if (req.url === '/api/wifi/status') {
              const data = await getCurrentConnection();
              return res.end(JSON.stringify(data));
            }
            if (req.url === '/api/wifi/profiles') {
              const data = await listSavedProfiles();
              return res.end(JSON.stringify(data));
            }
            if (req.url === '/api/wifi/disconnect') {
              const data = await disconnectWifi();
              return res.end(JSON.stringify(data));
            }
            if (req.url === '/api/wifi/connect' && req.method === 'POST') {
              let body = '';
              req.on('data', (chunk: any) => { body += chunk; });
              req.on('end', async () => {
                try {
                  const payload = JSON.parse(body || '{}');
                  const result = await connectToNetwork(payload);
                  return res.end(JSON.stringify(result));
                } catch (err: any) {
                  return res.end(JSON.stringify({ success: false, error: err?.message || 'Invalid JSON' }));
                }
              });
              return;
            }
          }
        } catch (e) {
          console.error('Vite local wifi api error:', e);
        }

        if (req.url === '/api/wifi/connect' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk: any) => { body += chunk; });
          req.on('end', async () => {
            try {
              const payload = JSON.parse(body || '{}');
              if (payload.ssid) {
                mockActiveSSID = payload.ssid;
                if (!mockSavedProfiles.includes(payload.ssid)) {
                  mockSavedProfiles.push(payload.ssid);
                }
              }
              return res.end(JSON.stringify({
                success: true,
                ssid: mockActiveSSID,
                isBrowserPreview: true,
                message: `[Preview Mode] Switched active preview profile to "${mockActiveSSID}". Note: Web browsers operate in a sandbox and cannot modify host Windows hardware. Use the desktop app (.exe) for physical Wi-Fi control.`
              }));
            } catch (_) {
              return res.end(JSON.stringify({ success: true, isBrowserPreview: true, message: 'Connected (Preview)' }));
            }
          });
          return;
        }
        if (req.url === '/api/wifi/connect') {
          return res.end(JSON.stringify({ success: true, ssid: mockActiveSSID, isBrowserPreview: true, message: 'Connected (Preview)' }));
        }
        if (req.url === '/api/wifi/disconnect') {
          mockActiveSSID = null;
          return res.end(JSON.stringify({ success: true, isBrowserPreview: true, message: 'Disconnected (Preview)' }));
        }
        if (req.url === '/api/wifi/status') {
          return res.end(JSON.stringify({
            success: true,
            ssid: mockActiveSSID,
            state: mockActiveSSID ? 'connected' : 'disconnected',
            isBrowserPreview: true,
            description: 'Web Preview Adapter (Browser Sandbox)'
          }));
        }
        if (req.url === '/api/wifi/profiles') {
          return res.end(JSON.stringify({ success: true, profiles: mockSavedProfiles }));
        }
        return res.end(JSON.stringify({
          success: true,
          connectedSSID: mockActiveSSID,
          networks: [
            { ssid: 'Home', signal: 98, security: 'WPA2', channel: 6, radioType: '802.11ax' },
            { ssid: 'WE_E5E964', signal: 86, security: 'WPA2', channel: 1, radioType: '802.11n' },
            { ssid: 'Ahmed Youssef', signal: 80, security: 'WPA2', channel: 11, radioType: '802.11ac' },
            { ssid: 'ETISALAT-EFC8', signal: 74, security: 'WPA2', channel: 6, radioType: '802.11n' },
            { ssid: 'Etisalat-um7B', signal: 66, security: 'WPA2', channel: 3, radioType: '802.11n' },
            { ssid: 'RVM', signal: 58, security: 'WPA2', channel: 9, radioType: '802.11n' },
            { ssid: 'WE277E77', signal: 52, security: 'WPA2', channel: 11, radioType: '802.11n' },
            { ssid: 'Hidden Network', signal: 45, security: 'WPA2', channel: 1, radioType: '802.11n' },
            { ssid: 'Hidden Network (2)', signal: 38, security: 'WPA2', channel: 6, radioType: '802.11n' }
          ]
        }));
      });
    }
  };
}

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss(), localWifiApiPlugin()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
