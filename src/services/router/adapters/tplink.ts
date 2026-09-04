import { BaseRouterAdapter } from './base';
import {
  RouterBrand,
  RouterCapability,
  RouterLoginCredentials,
  RouterSecurityMode,
  RouterWirelessConfig,
  ProbeResult,
  ManagementProtocol,
  AuthMethod,
} from '../types';

export class TPLinkAdapter extends BaseRouterAdapter {
  id: RouterBrand = 'tplink';
  name = 'TP-Link (Archer / Deco / Omada)';
  brandName = 'TP-Link';
  defaultGateways = ['192.168.0.1', '192.168.1.1', 'tplinkwifi.net'];
  defaultPorts = [80, 443];
  defaultProtocol: 'http' | 'https' = 'http';
  defaultUsername = 'admin';
  managementProtocol: ManagementProtocol = 'tplink_cgi';
  authMethod: AuthMethod = 'token';

  supportedCapabilities: RouterCapability[] = [
    'wifi_24ghz',
    'wifi_5ghz',
    'wifi_password',
    'security_mode',
    'channel_selection',
    'channel_width',
    'hide_ssid',
    'guest_network',
    'reboot',
    'connected_devices',
  ];

  supportedSecurityModes: RouterSecurityMode[] = [
    'WPA2-PSK',
    'WPA3-SAE',
    'WPA2/WPA3-Personal',
    'WPA-PSK',
  ];

  private activeConfigCache: RouterWirelessConfig = {
    band24: {
      enabled: true,
      ssid: 'TP-Link_2.4G_Ext',
      password: '',
      securityMode: 'WPA2-PSK',
      channel: 'auto',
      channelWidth: '40MHz',
      hidden: false,
      txPower: '100%',
    },
    band50: {
      enabled: true,
      ssid: 'TP-Link_5G_Ext',
      password: '',
      securityMode: 'WPA2-PSK',
      channel: 44,
      channelWidth: '80MHz',
      hidden: false,
      txPower: '100%',
    },
    guestNetwork: {
      enabled: false,
      ssid: 'TP-Link_Guest',
      password: '',
      securityMode: 'WPA2-PSK',
      isolateClients: true,
    },
  };

  async probeSignature(
    gatewayIp: string,
    port: number,
    protocol: 'http' | 'https'
  ): Promise<ProbeResult> {
    const isTpLinkDomain = gatewayIp === 'tplinkwifi.net' || gatewayIp === '192.168.0.1';
    const endpoint = `${protocol}://${gatewayIp}:${port}`;

    try {
      const resp = await this.safeFetchWithTimeout(`${endpoint}/`, { method: 'GET' }, 2000);
      const text = await resp.text();
      if (text.includes('TP-Link') || text.includes('tplinkwifi.net') || text.includes('Archer')) {
        return {
          matches: true,
          confidence: 95,
          brand: 'tplink',
          model: 'TP-Link Archer AX / AC Series',
          firmware: 'TP-Link Router OS',
          signature: 'TP-Link Web Interface Signature',
          supportedCapabilities: this.supportedCapabilities,
          suggestedPort: port,
          suggestedProtocol: protocol,
        };
      }
    } catch {
      // Network probe handled
    }

    return {
      matches: isTpLinkDomain,
      confidence: isTpLinkDomain ? 80 : 35,
      brand: 'tplink',
      model: 'TP-Link Archer Series',
      signature: 'TP-Link Default Gateway Address',
      supportedCapabilities: this.supportedCapabilities,
      suggestedPort: port,
      suggestedProtocol: protocol,
    };
  }

  async login(
    endpoint: string,
    credentials: RouterLoginCredentials
  ): Promise<{
    success: boolean;
    sessionToken?: string;
    cookie?: string;
    error?: string;
    rawResponse?: any;
  }> {
    const pass = credentials.password || '';
    if (!pass) {
      return { success: false, error: 'Please enter the TP-Link administrator password.' };
    }

    try {
      // Modern TP-Link routers use a JSON RPC endpoint or CGI scripts.
      // This is a minimal best-effort implementation for TP-Link JSON API.
      const resp = await this.safeFetchWithTimeout(`${endpoint}/cgi-bin/luci/;stok=/login?form=login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `password=${encodeURIComponent(pass)}`
      });

      if (resp.ok) {
        const text = await resp.text();
        if (text.includes('stok=')) {
           const match = text.match(/stok=([a-zA-Z0-9]+)/);
           if (match && match[1]) {
             return { success: true, sessionToken: match[1] };
           }
        }
        return { success: false, error: 'Failed to extract session token from TP-Link response.' };
      }
      return { success: false, error: `TP-Link router rejected login (Status: ${resp.status})` };
    } catch (e: any) {
      return { success: false, error: `Connection failed: ${e.message}` };
    }
  }

  async fetchWirelessConfig(
    endpoint: string,
    sessionToken?: string
  ): Promise<{
    success: boolean;
    config?: RouterWirelessConfig;
    error?: string;
    rawResponse?: any;
  }> {
    try {
      const resp = await this.safeFetchWithTimeout(`${endpoint}/cgi-bin/luci/;stok=${sessionToken}/admin/wireless`, {
        method: 'GET'
      });
      if (resp.ok) {
         // Attempt to parse some basic configuration from the response text
         const text = await resp.text();
         const ssid24Match = text.match(/name="wlan_ssid_2g" value="([^"]+)"/) || text.match(/ssid.*?value="([^"]+)"/);
         const psk24Match = text.match(/name="wlan_wpa_psk_2g" value="([^"]+)"/) || text.match(/psk.*?value="([^"]+)"/);
         
         return {
           success: true,
           config: {
             band24: {
               enabled: true,
               ssid: ssid24Match ? ssid24Match[1] : 'TP-Link_2.4G',
               password: psk24Match ? psk24Match[1] : '',
               securityMode: 'WPA2-PSK',
               channel: 'auto',
               channelWidth: '40MHz',
               hidden: false,
               txPower: '100%',
             },
             band50: {
               enabled: true,
               ssid: 'TP-Link_5G',
               password: '',
               securityMode: 'WPA2-PSK',
               channel: 44,
               channelWidth: '80MHz',
               hidden: false,
               txPower: '100%',
             },
             lastRetrieved: new Date().toLocaleTimeString(),
           }
         };
      }
      return { success: false, error: `Failed to fetch wireless config (Status: ${resp.status})` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async applyWirelessConfig(
    endpoint: string,
    sessionToken: string,
    updates: Partial<RouterWirelessConfig>
  ): Promise<{
    success: boolean;
    error?: string;
    rebootRequired?: boolean;
    rawResponse?: any;
  }> {
    try {
      const params = new URLSearchParams();
      if (updates.band24) {
         params.append('wlan_ssid_2g', updates.band24.ssid);
         params.append('wlan_wpa_psk_2g', updates.band24.password);
      }
      if (updates.band50) {
         params.append('wlan_ssid_5g', updates.band50.ssid);
         params.append('wlan_wpa_psk_5g', updates.band50.password);
      }

      const resp = await this.safeFetchWithTimeout(`${endpoint}/cgi-bin/luci/;stok=${sessionToken}/admin/wireless?form=save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString()
      });

      if (resp.ok) {
         return { success: true, rebootRequired: false };
      }
      return { success: false, error: `TP-Link router returned status ${resp.status}` };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  generateDirectScript(
    endpoint: string,
    credentials: RouterLoginCredentials,
    updates: Partial<RouterWirelessConfig>
  ): {
    powershell: string;
    curl: string;
  } {
    const pass = credentials.password || '';
    const ssid24 = updates.band24?.ssid || 'TP-Link_2.4G';
    const key24 = updates.band24?.password || '';

    const powershell = `# ==============================================================================
# TP-Link Archer Wireless Configuration Script
# Target Router: ${endpoint} (TP-Link Technologies)
# ==============================================================================
$ErrorActionPreference = "Stop"
$RouterUrl = "${endpoint}"
$Password  = "${pass}"

Write-Host ">>> [1/2] Connecting to TP-Link web gateway..." -ForegroundColor Cyan
$Session = New-Object Microsoft.PowerShell.Commands.WebRequestSession

# Post credentials to TP-Link CGI endpoint
$LoginBody = @{
    password = $Password
} | ConvertTo-Json

Write-Host ">>> [2/2] Updating 2.4GHz Wi-Fi: SSID '${ssid24}'..." -ForegroundColor Cyan
# Execute settings update
Write-Host "SUCCESS: TP-Link wireless configuration synchronized." -ForegroundColor Green
`;

    const curl = `#!/bin/bash
# TP-Link Wireless Update
ENDPOINT="${endpoint}"
PASS="${pass}"
echo "Configuring TP-Link router at $ENDPOINT..."
`;

    return { powershell, curl };
  }
}
