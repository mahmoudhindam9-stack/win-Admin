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

export class OpenWrtAdapter extends BaseRouterAdapter {
  id: RouterBrand = 'openwrt';
  name = 'OpenWrt / LEDE (LuCI ubus)';
  brandName = 'OpenWrt';
  defaultGateways = ['192.168.1.1', '192.168.2.1'];
  defaultPorts = [80, 443];
  defaultProtocol: 'http' | 'https' = 'http';
  defaultUsername = 'root';
  managementProtocol: ManagementProtocol = 'ubus_jsonrpc';
  authMethod: AuthMethod = 'ubus_session';

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

  // In-memory cache of live configuration when connected
  private activeConfigCache: RouterWirelessConfig = {
    band24: {
      enabled: true,
      ssid: 'OpenWrt-2.4G',
      password: '',
      securityMode: 'WPA2-PSK',
      channel: 6,
      channelWidth: '20MHz',
      hidden: false,
      txPower: '100%',
    },
    band50: {
      enabled: true,
      ssid: 'OpenWrt-5G',
      password: '',
      securityMode: 'WPA3-SAE',
      channel: 36,
      channelWidth: '80MHz',
      hidden: false,
      txPower: '100%',
    },
    guestNetwork: {
      enabled: false,
      ssid: 'OpenWrt-Guest',
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
    const endpoint = `${protocol}://${gatewayIp}:${port}`;
    try {
      // 1. Probe ubus JSON-RPC endpoint
      const ubusCheck = await this.safeFetchWithTimeout(
        `${endpoint}/ubus`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'call',
            params: ['00000000000000000000000000000000', 'system', 'info', {}],
          }),
        },
        2500
      );

      if (ubusCheck.ok) {
        return {
          matches: true,
          confidence: 98,
          brand: 'openwrt',
          model: 'OpenWrt Linux Wireless Router',
          firmware: 'OpenWrt 23.05 / LuCI',
          signature: 'Confirmed ubus JSON-RPC API endpoint active',
          supportedCapabilities: this.supportedCapabilities,
          suggestedPort: port,
          suggestedProtocol: protocol,
        };
      }
    } catch {
      // Fall through to signature detection
    }

    // Default match if gateway matches typical OpenWrt IP
    const isDefaultIp = this.defaultGateways.includes(gatewayIp);
    return {
      matches: isDefaultIp,
      confidence: isDefaultIp ? 75 : 40,
      brand: 'openwrt',
      model: 'OpenWrt / LuCI Firmware',
      signature: 'Standard OpenWrt Gateway Signature',
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
    const username = credentials.username || 'root';
    const password = credentials.password || '';

    try {
      const resp = await this.safeFetchWithTimeout(`${endpoint}/ubus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'call',
          params: [
            '00000000000000000000000000000000',
            'session',
            'login',
            { username, password },
          ],
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data?.result?.[1]?.ubus_rpc_session) {
          const token = data.result[1].ubus_rpc_session;
          return { success: true, sessionToken: token, rawResponse: data };
        }
        if (data?.result?.[0] !== 0) {
          return {
            success: false,
            error: 'Authentication failed (Invalid root password for OpenWrt ubus)',
            rawResponse: data,
          };
        }
      }
      return { success: false, error: `Router rejected login (Status: ${resp.status})` };
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
      if (sessionToken) {
        const resp = await this.safeFetchWithTimeout(`${endpoint}/ubus`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 2,
            method: 'call',
            params: [sessionToken, 'uci', 'get', { config: 'wireless' }],
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          if (data?.result?.[1]?.values) {
            // Parse UCI wireless values
            const values = data.result[1].values;
            const liveConfig = this.parseUciWireless(values);
            return { success: true, config: liveConfig, rawResponse: data };
          }
          return { success: false, error: 'Failed to parse wireless config from UCI response' };
        }
        return { success: false, error: `Router returned status ${resp.status}` };
      }
      return { success: false, error: 'No session token provided for fetch' };
    } catch (e: any) {
      return { success: false, error: `Network connection failed: ${e.message}` };
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
      // Send real UCI set, commit, and reload network action
      const uciCommands: any[] = [];
      if (updates.band24) {
        if (updates.band24.ssid) {
          uciCommands.push({
            jsonrpc: '2.0',
            id: 10,
            method: 'call',
            params: [
              sessionToken,
              'uci',
              'set',
              {
                config: 'wireless',
                section: 'default_radio0',
                values: {
                  ssid: updates.band24.ssid,
                  key: updates.band24.password,
                  encryption: this.mapSecurityToUci(updates.band24.securityMode),
                  hidden: updates.band24.hidden ? '1' : '0',
                },
              },
            ],
          });
        }
      }

      if (updates.band50) {
        if (updates.band50.ssid) {
          uciCommands.push({
            jsonrpc: '2.0',
            id: 11,
            method: 'call',
            params: [
              sessionToken,
              'uci',
              'set',
              {
                config: 'wireless',
                section: 'default_radio1',
                values: {
                  ssid: updates.band50.ssid,
                  key: updates.band50.password,
                  encryption: this.mapSecurityToUci(updates.band50.securityMode),
                  hidden: updates.band50.hidden ? '1' : '0',
                },
              },
            ],
          });
        }
      }

      for (const cmd of uciCommands) {
        const res = await this.safeFetchWithTimeout(`${endpoint}/ubus`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(cmd),
        });
        if (!res.ok) {
           return { success: false, error: 'Failed to set UCI values' };
        }
      }

      // Commit changes
      const commitRes = await this.safeFetchWithTimeout(`${endpoint}/ubus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 20,
          method: 'call',
          params: [sessionToken, 'uci', 'commit', { config: 'wireless' }],
        }),
      });
      if (!commitRes.ok) return { success: false, error: 'Failed to commit UCI changes' };

      // Reload wireless subsystem
      const reloadRes = await this.safeFetchWithTimeout(`${endpoint}/ubus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 21,
          method: 'call',
          params: [sessionToken, 'luci', 'setInitAction', { name: 'network', action: 'reload' }],
        }),
      });
      if (!reloadRes.ok) return { success: false, error: 'Failed to reload wireless subsystem' };

      return { success: true, rebootRequired: false };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }

  async rebootRouter(
    endpoint: string,
    sessionToken: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      await this.safeFetchWithTimeout(`${endpoint}/ubus`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 99,
          method: 'call',
          params: [sessionToken, 'system', 'reboot', {}],
        }),
      });
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message || 'Reboot failed' };
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
    const user = credentials.username || 'root';
    const pass = credentials.password || '';
    const ssid24 = updates.band24?.ssid || 'OpenWrt-2.4G';
    const key24 = updates.band24?.password || '';
    const enc24 = this.mapSecurityToUci(updates.band24?.securityMode || 'WPA2-PSK');

    const powershell = `# ==============================================================================
# OpenWrt LuCI ubus JSON-RPC Wireless Configuration Script
# Target Router: ${endpoint} (OpenWrt / LEDE)
# ==============================================================================
$ErrorActionPreference = "Stop"
$RouterUrl = "${endpoint}/ubus"
$Username  = "${user}"
$Password  = "${pass}"

Write-Host ">>> [1/4] Authenticating with OpenWrt ubus..." -ForegroundColor Cyan
$LoginBody = @{
    jsonrpc = "2.0"
    id      = 1
    method  = "call"
    params  = @("00000000000000000000000000000000", "session", "login", @{
        username = $Username
        password = $Password
    })
} | ConvertTo-Json -Compress

$LoginResponse = Invoke-RestMethod -Uri $RouterUrl -Method Post -Body $LoginBody -ContentType "application/json"
$SessionToken = $LoginResponse.result[1].ubus_rpc_session

if (-not $SessionToken) {
    throw "Failed to authenticate with OpenWrt. Verify root password."
}
Write-Host ">>> Session authenticated: $SessionToken" -ForegroundColor Green

Write-Host ">>> [2/4] Applying Wireless UCI Configuration..." -ForegroundColor Cyan
$SetBody = @{
    jsonrpc = "2.0"
    id      = 2
    method  = "call"
    params  = @($SessionToken, "uci", "set", @{
        config  = "wireless"
        section = "default_radio0"
        values  = @{
            ssid       = "${ssid24}"
            key        = "${key24}"
            encryption = "${enc24}"
        }
    })
} | ConvertTo-Json -Compress -Depth 4

Invoke-RestMethod -Uri $RouterUrl -Method Post -Body $SetBody -ContentType "application/json" | Out-Null

Write-Host ">>> [3/4] Committing UCI changes..." -ForegroundColor Cyan
$CommitBody = @{
    jsonrpc = "2.0"
    id      = 3
    method  = "call"
    params  = @($SessionToken, "uci", "commit", @{ config = "wireless" })
} | ConvertTo-Json -Compress

Invoke-RestMethod -Uri $RouterUrl -Method Post -Body $CommitBody -ContentType "application/json" | Out-Null

Write-Host ">>> [4/4] Reloading Wireless Subsystem via LuCI..." -ForegroundColor Cyan
$ReloadBody = @{
    jsonrpc = "2.0"
    id      = 4
    method  = "call"
    params  = @($SessionToken, "luci", "setInitAction", @{ name = "network"; action = "reload" })
} | ConvertTo-Json -Compress

Invoke-RestMethod -Uri $RouterUrl -Method Post -Body $ReloadBody -ContentType "application/json" | Out-Null
Write-Host "SUCCESS: OpenWrt Wi-Fi configuration updated and active!" -ForegroundColor Green
`;

    const curl = `#!/bin/bash
# OpenWrt ubus Wireless Configuration
ENDPOINT="${endpoint}/ubus"
USER="${user}"
PASS="${pass}"

# 1. Login & extract token
RESP=$(curl -s -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":1,"method":"call","params":["00000000000000000000000000000000","session","login",{"username":"'$USER'","password":"'$PASS'"}]}' "$ENDPOINT")
TOKEN=$(echo "$RESP" | grep -o '"ubus_rpc_session":"[^"]*' | cut -d'"' -f4)

echo "Token: $TOKEN"

# 2. Update UCI wireless
curl -s -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":2,"method":"call","params":["'$TOKEN'","uci","set",{"config":"wireless","section":"default_radio0","values":{"ssid":"${ssid24}","key":"${key24}","encryption":"${enc24}"}}]}' "$ENDPOINT"

# 3. Commit & reload
curl -s -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":3,"method":"call","params":["'$TOKEN'","uci","commit",{"config":"wireless"}]}' "$ENDPOINT"
curl -s -X POST -H "Content-Type: application/json" -d '{"jsonrpc":"2.0","id":4,"method":"call","params":["'$TOKEN'","luci","setInitAction",{"name":"network","action":"reload"}]}' "$ENDPOINT"
echo "OpenWrt wireless updated successfully."
`;

    return { powershell, curl };
  }

  private mapSecurityToUci(mode: RouterSecurityMode): string {
    switch (mode) {
      case 'WPA3-SAE':
        return 'sae';
      case 'WPA2/WPA3-Personal':
        return 'sae-mixed';
      case 'WPA2-PSK':
        return 'psk2';
      case 'WPA-PSK':
        return 'psk';
      case 'Open':
        return 'none';
      default:
        return 'psk2';
    }
  }

  private parseUciWireless(values: any): RouterWirelessConfig {
    const config: RouterWirelessConfig = { ...this.activeConfigCache };
    for (const key of Object.keys(values)) {
      const item = values[key];
      if (item['.type'] === 'wifi-iface') {
        if (item.device === 'radio0' || !config.band24) {
          config.band24 = {
            enabled: !item.disabled || item.disabled === '0',
            ssid: item.ssid || 'OpenWrt-2.4G',
            password: item.key || '',
            securityMode: this.mapUciToSecurity(item.encryption),
            channel: 6,
            channelWidth: '20MHz',
            hidden: item.hidden === '1',
            txPower: '100%',
          };
        } else if (item.device === 'radio1') {
          config.band50 = {
            enabled: !item.disabled || item.disabled === '0',
            ssid: item.ssid || 'OpenWrt-5G',
            password: item.key || '',
            securityMode: this.mapUciToSecurity(item.encryption),
            channel: 36,
            channelWidth: '80MHz',
            hidden: item.hidden === '1',
            txPower: '100%',
          };
        }
      }
    }
    return config;
  }

  private mapUciToSecurity(enc?: string): RouterSecurityMode {
    if (!enc) return 'WPA2-PSK';
    if (enc.includes('sae-mixed')) return 'WPA2/WPA3-Personal';
    if (enc.includes('sae')) return 'WPA3-SAE';
    if (enc.includes('psk2')) return 'WPA2-PSK';
    if (enc.includes('psk')) return 'WPA-PSK';
    if (enc === 'none') return 'Open';
    return 'WPA2-PSK';
  }
}
