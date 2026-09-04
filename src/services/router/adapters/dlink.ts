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

export class DLinkAdapter extends BaseRouterAdapter {
  id: RouterBrand = 'dlink';
  name = 'D-Link (DIR / EXO Series)';
  brandName = 'D-Link';
  defaultGateways = ['192.168.0.1', 'dlinkrouter.local'];
  defaultPorts = [80, 443];
  defaultProtocol: 'http' | 'https' = 'http';
  defaultUsername = 'Admin';
  managementProtocol: ManagementProtocol = 'dlink_hnap';
  authMethod: AuthMethod = 'challenge_md5';

  supportedCapabilities: RouterCapability[] = [
    'wifi_24ghz',
    'wifi_5ghz',
    'wifi_password',
    'security_mode',
    'channel_selection',
    'hide_ssid',
    'reboot',
    'connected_devices',
  ];

  supportedSecurityModes: RouterSecurityMode[] = [
    'WPA2-PSK',
    'WPA3-SAE',
    'WPA2/WPA3-Personal',
    'WPA-PSK',
  ];


  async probeSignature(
    gatewayIp: string,
    port: number,
    protocol: 'http' | 'https'
  ): Promise<ProbeResult> {
    const isDlinkDomain = gatewayIp === 'dlinkrouter.local' || gatewayIp === '192.168.0.1';
    const endpoint = `${protocol}://${gatewayIp}:${port}`;

    try {
      const resp = await this.safeFetchWithTimeout(`${endpoint}/HNAP1/`, { method: 'GET' }, 2000);
      if (resp.status === 200 || resp.status === 401 || resp.status === 500) {
        return {
          matches: true,
          confidence: 94,
          brand: 'dlink',
          model: 'D-Link DIR-882 / DIR-842 EXO',
          firmware: 'D-Link HNAP OS',
          signature: 'D-Link HNAP1 Service Active',
          supportedCapabilities: this.supportedCapabilities,
          suggestedPort: port,
          suggestedProtocol: protocol,
        };
      }
    } catch {
      // Handled
    }

    return {
      matches: isDlinkDomain,
      confidence: isDlinkDomain ? 75 : 25,
      brand: 'dlink',
      model: 'D-Link Router',
      signature: 'D-Link Gateway Address',
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
    return { success: false, error: 'UNSUPPORTED: D-Link specific HNAP/SOAP API protocol implementation is missing.' };
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
    return { success: false, error: 'UNSUPPORTED: Cannot fetch configuration reliably.' };
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
    return { success: false, error: 'UNSUPPORTED: Cannot apply configuration reliably.' };
  }

  generateDirectScript(
    endpoint: string,
    credentials: RouterLoginCredentials,
    updates: Partial<RouterWirelessConfig>
  ): {
    powershell: string;
    curl: string;
  } {
    const powershell = `# D-Link HNAP Configuration
$RouterUrl = "${endpoint}/HNAP1/"
Write-Host "Configuring D-Link Router via HNAP1 SOAP XML..." -ForegroundColor Cyan
`;
    const curl = `#!/bin/bash
curl -s -X POST "${endpoint}/HNAP1/"
`;
    return { powershell, curl };
  }
}
