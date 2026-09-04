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

    try {
      const resp = await this.safeFetchWithTimeout(`${endpoint}/rest/system/resource`, {
        method: 'GET',
        headers: { 'Authorization': `Basic ${auth}` }
      });
      if (resp.ok) {
         return { success: true, sessionToken: auth };
      }
      return { success: false, error: `RouterOS rejected credentials (Status: ${resp.status})` };
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
      const resp = await this.safeFetchWithTimeout(`${endpoint}/rest/interface/wireless`, {
        method: 'GET',
        headers: { 'Authorization': `Basic ${sessionToken}` }
      });
      if (resp.ok) {
         const data = await resp.json();
         let ssid24 = 'MikroTik-2.4G';
         let ssid50 = 'MikroTik-5G';
         
         if (Array.isArray(data)) {
            data.forEach((iface: any) => {
               if (iface.name?.includes('wlan1') || iface.band?.includes('2ghz')) ssid24 = iface.ssid || ssid24;
               if (iface.name?.includes('wlan2') || iface.band?.includes('5ghz')) ssid50 = iface.ssid || ssid50;
            });
         }
         return {
           success: true,
           config: {
             band24: {
               enabled: true,
               ssid: ssid24,
               password: '',
               securityMode: 'WPA2-PSK',
               channel: 'auto',
               channelWidth: '20MHz',
               hidden: false,
             },
             band50: {
               enabled: true,
               ssid: ssid50,
               password: '',
               securityMode: 'WPA2-PSK',
               channel: 'auto',
               channelWidth: '80MHz',
               hidden: false,
             },
             lastRetrieved: new Date().toLocaleTimeString(),
           }
         };
      }
      return { success: false, error: `Failed to fetch from RouterOS REST API (Status: ${resp.status})` };
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
      if (updates.band24) {
         await this.safeFetchWithTimeout(`${endpoint}/rest/interface/wireless/*1`, {
           method: 'PATCH',
           headers: { 'Authorization': `Basic ${sessionToken}`, 'Content-Type': 'application/json' },
           body: JSON.stringify({ ssid: updates.band24.ssid })
         });
      }
      if (updates.band50) {
         await this.safeFetchWithTimeout(`${endpoint}/rest/interface/wireless/*2`, {
           method: 'PATCH',
           headers: { 'Authorization': `Basic ${sessionToken}`, 'Content-Type': 'application/json' },
           body: JSON.stringify({ ssid: updates.band50.ssid })
         });
      }
      return { success: true, rebootRequired: false };
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
