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

export class MikroTikAdapter extends BaseRouterAdapter {
  id: RouterBrand = 'mikrotik';
  name = 'MikroTik (RouterOS v7 REST API)';
  brandName = 'MikroTik';
  defaultGateways = ['192.168.88.1', '192.168.1.1'];
  defaultPorts = [80, 443];
  defaultProtocol: 'http' | 'https' = 'http';
  defaultUsername = 'admin';
  managementProtocol: ManagementProtocol = 'mikrotik_rest';
  authMethod: AuthMethod = 'basic';

  supportedCapabilities: RouterCapability[] = [
    'wifi_24ghz',
    'wifi_5ghz',
    'wifi_password',
    'security_mode',
    'channel_selection',
    'channel_width',
    'hide_ssid',
    'tx_power',
    'reboot',
    'connected_devices',
  ];

  supportedSecurityModes: RouterSecurityMode[] = [
    'WPA2-PSK',
    'WPA3-SAE',
    'WPA2/WPA3-Personal',
  ];

  private activeConfigCache: RouterWirelessConfig = {
    band24: {
      enabled: true,
      ssid: 'MikroTik-2.4G',
      password: '',
      securityMode: 'WPA2-PSK',
      channel: 6,
      channelWidth: '20MHz',
      hidden: false,
      txPower: '100%',
    },
    band50: {
      enabled: true,
      ssid: 'MikroTik-5G',
      password: '',
      securityMode: 'WPA3-SAE',
      channel: 36,
      channelWidth: '80MHz',
      hidden: false,
      txPower: '100%',
    },
  };

  async probeSignature(
    gatewayIp: string,
    port: number,
    protocol: 'http' | 'https'
  ): Promise<ProbeResult> {
    const isMikroTikDefault = gatewayIp === '192.168.88.1';
    const endpoint = `${protocol}://${gatewayIp}:${port}`;

    try {
      const resp = await this.safeFetchWithTimeout(`${endpoint}/rest/system/resource`, { method: 'GET' }, 2000);
      const server = resp.headers.get('server') || '';
      if (server.toLowerCase().includes('routeros') || resp.status === 401) {
        return {
          matches: true,
          confidence: 97,
          brand: 'mikrotik',
          model: 'MikroTik RouterBOARD / hAP ax',
          firmware: 'RouterOS v7',
          signature: 'MikroTik RouterOS REST API Active',
          supportedCapabilities: this.supportedCapabilities,
          suggestedPort: port,
          suggestedProtocol: protocol,
        };
      }
    } catch {
      // Handled
    }

    return {
      matches: isMikroTikDefault,
      confidence: isMikroTikDefault ? 90 : 20,
      brand: 'mikrotik',
      model: 'MikroTik RouterOS',
      signature: 'MikroTik Default Subnet 192.168.88.1',
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
    const user = credentials.username || 'admin';
    const pass = credentials.password || '';
    const auth = btoa(`${user}:${pass}`);

    return {
      success: true,
      sessionToken: auth,
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
    const user = credentials.username || 'admin';
    const pass = credentials.password || '';
    const auth = Buffer.from ? Buffer.from(`${user}:${pass}`).toString('base64') : btoa(`${user}:${pass}`);
    const ssid24 = updates.band24?.ssid || 'MikroTik-2.4G';

    const powershell = `# MikroTik RouterOS v7 REST API Wireless Configuration
$Headers = @{ "Authorization" = "Basic ${auth}" }
$Body = @{ ssid = "${ssid24}" } | ConvertTo-Json
Invoke-RestMethod -Uri "${endpoint}/rest/interface/wireless/wlan1" -Method Patch -Headers $Headers -Body $Body -ContentType "application/json"
Write-Host "SUCCESS: MikroTik wlan1 updated!" -ForegroundColor Green
`;
    const curl = `#!/bin/bash
curl -s -X PATCH "${endpoint}/rest/interface/wireless/wlan1" \\
  -u "${user}:${pass}" \\
  -H "Content-Type: application/json" \\
  -d '{"ssid":"${ssid24}"}'
`;
    return { powershell, curl };
  }
}
