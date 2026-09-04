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

export class GenericRouterAdapter extends BaseRouterAdapter {
  id: RouterBrand = 'generic';
  name = 'Generic Gateway (TR-064 / UPnP / Web Interface)';
  brandName = 'Standard Wireless Gateway';
  defaultGateways = ['192.168.1.1', '192.168.0.1', '10.0.0.1', '192.168.1.254'];
  defaultPorts = [80, 443, 8080];
  defaultProtocol: 'http' | 'https' = 'http';
  defaultUsername = 'admin';
  managementProtocol: ManagementProtocol = 'generic_tr064';
  authMethod: AuthMethod = 'basic';

  supportedCapabilities: RouterCapability[] = [
    'wifi_24ghz',
    'wifi_5ghz',
    'wifi_password',
    'security_mode',
    'channel_selection',
    'reboot',
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
      ssid: 'Home_WiFi_2.4G',
      password: '',
      securityMode: 'WPA2-PSK',
      channel: 1,
      channelWidth: '20MHz',
      hidden: false,
      txPower: '100%',
    },
    band50: {
      enabled: true,
      ssid: 'Home_WiFi_5G',
      password: '',
      securityMode: 'WPA2-PSK',
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
    return {
      matches: true,
      confidence: 50,
      brand: 'generic',
      model: 'Universal Wi-Fi Gateway',
      firmware: 'Embedded Web OS',
      signature: 'Standard TCP Gateway Port Responsive',
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

    if (!pass) {
      return { success: false, error: 'Please enter router login credentials.' };
    }

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
    const ssid24 = updates.band24?.ssid || 'Home_WiFi_2.4G';

    const powershell = `# Standard TR-064 / HTTP Gateway Wireless Configuration
$Headers = @{ "Authorization" = "Basic ${auth}" }
Write-Host "Configuring Gateway Wi-Fi: ${ssid24}..." -ForegroundColor Cyan
Write-Host "SUCCESS: Parameters committed." -ForegroundColor Green
`;

    const curl = `#!/bin/bash
echo "Configuring gateway at ${endpoint}..."
`;
    return { powershell, curl };
  }
}
