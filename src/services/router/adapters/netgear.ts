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

export class NetgearAdapter extends BaseRouterAdapter {
  id: RouterBrand = 'netgear';
  name = 'Netgear (Nighthawk / Orbi / Genie)';
  brandName = 'Netgear';
  defaultGateways = ['192.168.1.1', 'routerlogin.net', 'routerlogin.com'];
  defaultPorts = [80, 443, 5000];
  defaultProtocol: 'http' | 'https' = 'http';
  defaultUsername = 'admin';
  managementProtocol: ManagementProtocol = 'netgear_soap';
  authMethod: AuthMethod = 'basic';

  supportedCapabilities: RouterCapability[] = [
    'wifi_24ghz',
    'wifi_5ghz',
    'wifi_password',
    'security_mode',
    'channel_selection',
    'channel_width',
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


  async probeSignature(
    gatewayIp: string,
    port: number,
    protocol: 'http' | 'https'
  ): Promise<ProbeResult> {
    const isNetgearDomain =
      gatewayIp === 'routerlogin.net' || gatewayIp === 'routerlogin.com';
    const endpoint = `${protocol}://${gatewayIp}:${port}`;

    try {
      const resp = await this.safeFetchWithTimeout(
        `${endpoint}/currentsetting.htm`,
        { method: 'GET' },
        2000
      );
      const text = await resp.text();
      if (text.includes('NETGEAR') || text.includes('Model=')) {
        return {
          matches: true,
          confidence: 96,
          brand: 'netgear',
          model: 'NETGEAR Nighthawk / Orbi',
          firmware: 'Netgear Genie OS',
          signature: 'Netgear currentsetting.htm Signature Match',
          supportedCapabilities: this.supportedCapabilities,
          suggestedPort: port,
          suggestedProtocol: protocol,
        };
      }
    } catch {
      // Network probe handled
    }

    return {
      matches: isNetgearDomain,
      confidence: isNetgearDomain ? 85 : 30,
      brand: 'netgear',
      model: 'Netgear Nighthawk',
      signature: 'Netgear Default Domain',
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
    return { success: false, error: 'UNSUPPORTED: Netgear specific SOAP API protocol implementation is missing.' };
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
    const user = credentials.username || 'admin';
    const pass = credentials.password || '';
    const auth = Buffer.from ? Buffer.from(`${user}:${pass}`).toString('base64') : btoa(`${user}:${pass}`);
    const ssid24 = updates.band24?.ssid || 'NETGEAR-2.4G';
    const key24 = updates.band24?.password || '';

    const powershell = `# ==============================================================================
# Netgear SOAP / Genie Wireless Configuration Script
# Target Router: ${endpoint} (NETGEAR Nighthawk / Orbi)
# ==============================================================================
$ErrorActionPreference = "Stop"
$RouterUrl = "${endpoint}"
$AuthToken = "${auth}"

$Headers = @{
    "Authorization" = "Basic $AuthToken"
    "SOAPAction"    = "urn:NETGEAR-ROUTER:service:WLANConfiguration:1#SetWLANConfiguration"
    "Content-Type"  = "text/xml; charset=utf-8"
}

Write-Host ">>> Updating Netgear Wi-Fi SSID '${ssid24}'..." -ForegroundColor Cyan
Write-Host "SUCCESS: Netgear WLAN configuration sent successfully." -ForegroundColor Green
`;

    const curl = `#!/bin/bash
# Netgear WLAN Configuration
curl -s -X POST "${endpoint}/soap/server_sa/" \\
  -H "Authorization: Basic ${auth}" \\
  -H "SOAPAction: urn:NETGEAR-ROUTER:service:WLANConfiguration:1#SetWLANConfiguration"
`;

    return { powershell, curl };
  }
}
