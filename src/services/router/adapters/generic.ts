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
    return { success: false, error: 'Generic adapter cannot guarantee compatibility. Please use a vendor-specific adapter.' };
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
    return { success: false, error: 'Unsupported router API.' };
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
    return { success: false, error: 'Unsupported router API.' };
  }

  generateDirectScript(
    endpoint: string,
    credentials: RouterLoginCredentials,
    updates: Partial<RouterWirelessConfig>
  ): {
    powershell: string;
    curl: string;
  } {
    return { 
      powershell: '# Unsupported generic router - vendor API required',
      curl: '# Unsupported generic router - vendor API required' 
    };
  }
}

