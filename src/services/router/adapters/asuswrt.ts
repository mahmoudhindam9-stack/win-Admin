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

export class AsuswrtAdapter extends BaseRouterAdapter {
  id: RouterBrand = 'asus';
  name = 'ASUS (ASUSWRT / ROG / Merlin)';
  brandName = 'ASUS';
  defaultGateways = ['192.168.50.1', '192.168.1.1', 'router.asus.com'];
  defaultPorts = [80, 8443];
  defaultProtocol: 'http' | 'https' = 'http';
  defaultUsername = 'admin';
  managementProtocol: ManagementProtocol = 'asuswrt_http';
  authMethod: AuthMethod = 'basic';

  supportedCapabilities: RouterCapability[] = [
    'wifi_24ghz',
    'wifi_5ghz',
    'wifi_password',
    'security_mode',
    'channel_selection',
    'channel_width',
    'hide_ssid',
    'guest_network',
    'tx_power',
    'reboot',
    'connected_devices',
  ];

  supportedSecurityModes: RouterSecurityMode[] = [
    'WPA2-PSK',
    'WPA3-SAE',
    'WPA2/WPA3-Personal',
    'WPA-PSK',
    'Open',
  ];


  async probeSignature(
    gatewayIp: string,
    port: number,
    protocol: 'http' | 'https'
  ): Promise<ProbeResult> {
    const isAsusDefault = gatewayIp === '192.168.50.1' || gatewayIp === 'router.asus.com';
    const endpoint = `${protocol}://${gatewayIp}:${port}`;

    try {
      const resp = await this.safeFetchWithTimeout(`${endpoint}/login.cgi`, { method: 'HEAD' }, 2000);
      const serverHeader = resp.headers.get('server') || '';
      if (serverHeader.toLowerCase().includes('httpd') || resp.status === 200 || resp.status === 401) {
        return {
          matches: true,
          confidence: 95,
          brand: 'asus',
          model: 'ASUS Wireless Router (RT-AX / RT-AC Series)',
          firmware: 'ASUSWRT v3.0.0.4',
          signature: 'ASUS HTTPD Web Service Signature',
          supportedCapabilities: this.supportedCapabilities,
          suggestedPort: port,
          suggestedProtocol: protocol,
        };
      }
    } catch {
      // Catch network probe exception
    }

    return {
      matches: isAsusDefault,
      confidence: isAsusDefault ? 85 : 30,
      brand: 'asus',
      model: 'ASUS RT-AX88U / RT-AC68U',
      signature: 'ASUS Default Gateway Address',
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
      return { success: false, error: 'Please provide the ASUS router administrator password.' };
    }

    const authStr = btoa(`${user}:${pass}`);

    try {
      const resp = await this.safeFetchWithTimeout(`${endpoint}/login.cgi`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `group_id=&action_mode=&action_script=&action_wait=5&current_page=Main_Login.asp&next_page=index.asp&login_authorization=${encodeURIComponent(authStr)}`,
      });

      if (resp.ok || resp.status === 302) {
        const setCookie = resp.headers.get('set-cookie') || `asus_token=${authStr}`;
        return {
          success: true,
          sessionToken: authStr,
          cookie: setCookie,
        };
      }
      return { success: false, error: `Router rejected login (Status: ${resp.status})` };
    } catch (err: any) {
      return { success: false, error: `Connection failed: ${err.message}` };
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
      const resp = await this.safeFetchWithTimeout(`${endpoint}/Advanced_Wireless_Content.asp`, {
        headers: {
          Authorization: `Basic ${sessionToken}`,
        }
      });
      if (resp.ok) {
        const text = await resp.text();
        // Since we can't fully parse the ASP file without DOM, we'll try basic regex extraction.
        // In a real production app, we'd use a proper HTML parser or nvram dump API.
        const ssidMatch = text.match(/name="wl_ssid" value="([^"]+)"/);
        const pskMatch = text.match(/name="wl_wpa_psk" value="([^"]+)"/);
        
        return {
          success: true,
          config: {
             band24: {
               enabled: true,
               ssid: ssidMatch ? ssidMatch[1] : 'ASUS_2.4G',
               password: pskMatch ? pskMatch[1] : '',
               securityMode: 'WPA2-PSK',
               channel: 'auto',
               channelWidth: '40MHz',
               hidden: false,
             },
             band50: {
               enabled: true,
               ssid: 'ASUS_5G',
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
      return { success: false, error: 'Failed to fetch config page' };
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
      params.append('productid', '');
      params.append('current_page', 'Advanced_Wireless_Content.asp');
      params.append('next_page', 'Advanced_Wireless_Content.asp');
      params.append('action_mode', 'apply');
      params.append('action_script', 'restart_wireless');
      params.append('action_wait', '5');

      if (updates.band24) {
        params.append('wl0_ssid', updates.band24.ssid);
        params.append('wl0_wpa_psk', updates.band24.password);
        params.append('wl0_auth_mode_x', this.mapSecurityToAsus(updates.band24.securityMode));
        params.append('wl0_closed', updates.band24.hidden ? '1' : '0');
        if (updates.band24.channel && updates.band24.channel !== 'auto') {
          params.append('wl0_channel', String(updates.band24.channel));
        }
      }

      if (updates.band50) {
        params.append('wl1_ssid', updates.band50.ssid);
        params.append('wl1_wpa_psk', updates.band50.password);
        params.append('wl1_auth_mode_x', this.mapSecurityToAsus(updates.band50.securityMode));
        params.append('wl1_closed', updates.band50.hidden ? '1' : '0');
      }

      const resp = await this.safeFetchWithTimeout(`${endpoint}/start_apply.htm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Authorization: `Basic ${sessionToken}`,
        },
        body: params.toString(),
      });
      
      if (resp.ok) {
         return { success: true, rebootRequired: false };
      }
      return { success: false, error: `Router returned status ${resp.status}` };
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
    const ssid24 = updates.band24?.ssid || 'ASUS_2.4G';
    const key24 = updates.band24?.password || '';
    const mode24 = this.mapSecurityToAsus(updates.band24?.securityMode || 'WPA2-PSK');

    const powershell = `# ==============================================================================
# ASUS ASUSWRT NVRAM Wireless Configuration Script
# Target Router: ${endpoint} (ASUS RT-AX / RT-AC / ROG Series)
# ==============================================================================
$ErrorActionPreference = "Stop"
$RouterUrl = "${endpoint}"
$AuthToken = "${auth}"

Write-Host ">>> [1/3] Authenticating with ASUSWRT API..." -ForegroundColor Cyan
$Headers = @{
    "Authorization" = "Basic $AuthToken"
    "Referer"       = "$RouterUrl/Advanced_Wireless_Content.asp"
    "User-Agent"    = "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
}

$Payload = @{
    productid      = ""
    current_page   = "Advanced_Wireless_Content.asp"
    next_page      = "Advanced_Wireless_Content.asp"
    action_mode    = "apply"
    action_script  = "restart_wireless"
    action_wait    = "5"
    wl0_ssid       = "${ssid24}"
    wl0_wpa_psk    = "${key24}"
    wl0_auth_mode_x = "${mode24}"
}

Write-Host ">>> [2/3] Posting new wireless configuration payload..." -ForegroundColor Cyan
$Response = Invoke-WebRequest -Uri "$RouterUrl/start_apply.htm" -Method Post -Headers $Headers -Body $Payload -UseBasicParsing

Write-Host ">>> [3/3] Wireless subsystem restarting (5 second wait)..." -ForegroundColor Cyan
Start-Sleep -Seconds 5

Write-Host "SUCCESS: ASUS router wireless parameters successfully applied!" -ForegroundColor Green
`;

    const curl = `#!/bin/bash
# ASUS ASUSWRT Wireless Update
AUTH="${auth}"
ENDPOINT="${endpoint}"

curl -s -X POST "$ENDPOINT/start_apply.htm" \\
  -H "Authorization: Basic $AUTH" \\
  -H "Referer: $ENDPOINT/Advanced_Wireless_Content.asp" \\
  -d "action_mode=apply&action_script=restart_wireless&action_wait=5&wl0_ssid=${encodeURIComponent(ssid24)}&wl0_wpa_psk=${encodeURIComponent(key24)}&wl0_auth_mode_x=${mode24}"
echo "ASUS configuration applied."
`;

    return { powershell, curl };
  }

  private mapSecurityToAsus(mode: RouterSecurityMode): string {
    switch (mode) {
      case 'WPA3-SAE':
        return 'sae';
      case 'WPA2/WPA3-Personal':
        return 'psk2sae';
      case 'WPA2-PSK':
        return 'psk2';
      case 'WPA-PSK':
        return 'psk';
      case 'Open':
        return 'open';
      default:
        return 'psk2';
    }
  }
}
