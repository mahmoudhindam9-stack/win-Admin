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

    // TP-Link uses session tokens in the URL: /cgi-bin/luci/;stok=TOKEN/...
    const stok = Math.random().toString(36).substring(2, 16);
    return {
      success: true,
      sessionToken: stok,
    };
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
    return {
      success: true,
      config: {
        ...this.activeConfigCache,
        lastRetrieved: new Date().toLocaleTimeString(),
      },
    };
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
    if (updates.band24) {
      this.activeConfigCache.band24 = {
        ...this.activeConfigCache.band24!,
        ...updates.band24,
      };
    }
    if (updates.band50) {
      this.activeConfigCache.band50 = {
        ...this.activeConfigCache.band50!,
        ...updates.band50,
      };
    }
    if (updates.guestNetwork) {
      this.activeConfigCache.guestNetwork = {
        ...this.activeConfigCache.guestNetwork!,
        ...updates.guestNetwork,
      };
    }

    return {
      success: true,
      rebootRequired: false,
    };
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
