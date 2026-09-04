export type RouterBrand =
  | 'generic'
  | 'openwrt'
  | 'asus'
  | 'tplink'
  | 'netgear'
  | 'dlink'
  | 'mikrotik'
  | 'ubiquiti';

export type ManagementProtocol =
  | 'ubus_jsonrpc'
  | 'asuswrt_http'
  | 'tplink_cgi'
  | 'netgear_soap'
  | 'dlink_hnap'
  | 'mikrotik_rest'
  | 'generic_tr064'
  | 'web_form';

export type AuthMethod =
  | 'none'
  | 'basic'
  | 'digest'
  | 'token'
  | 'challenge_md5'
  | 'ubus_session';

export type RouterCapability =
  | 'wifi_24ghz'
  | 'wifi_5ghz'
  | 'wifi_password'
  | 'security_mode'
  | 'channel_selection'
  | 'channel_width'
  | 'hide_ssid'
  | 'guest_network'
  | 'tx_power'
  | 'reboot'
  | 'connected_devices';

export type RouterSecurityMode =
  | 'WPA2-PSK'
  | 'WPA3-SAE'
  | 'WPA2/WPA3-Personal'
  | 'WPA-PSK'
  | 'Open';

export interface BandSettings {
  enabled: boolean;
  ssid: string;
  password: string;
  securityMode: RouterSecurityMode;
  channel: number | 'auto';
  channelWidth?: '20MHz' | '40MHz' | '80MHz' | '160MHz' | 'auto';
  hidden: boolean;
  txPower?: '100%' | '75%' | '50%' | '25%';
}

export interface GuestNetworkSettings {
  enabled: boolean;
  ssid: string;
  password: string;
  securityMode: RouterSecurityMode;
  isolateClients: boolean;
}

export interface RouterWirelessConfig {
  band24?: BandSettings;
  band50?: BandSettings;
  guestNetwork?: GuestNetworkSettings;
  lastRetrieved?: string;
}

export interface RouterDeviceInfo {
  brand: RouterBrand;
  brandName: string;
  model: string;
  firmwareVersion?: string;
  hardwareVersion?: string;
  gatewayIp: string;
  port: number;
  protocol: 'http' | 'https';
  managementProtocol: ManagementProtocol;
  authMethod: AuthMethod;
  supportedCapabilities: RouterCapability[];
  detectionConfidence: 'confirmed' | 'probable' | 'manual';
  signatureMatch?: string;
  hostname?: string;
  macAddress?: string;
  uptime?: string;
}

export type ConnectionStatus =
  | 'disconnected'
  | 'probing'
  | 'detected'
  | 'authenticating'
  | 'connected'
  | 'applying'
  | 'verifying'
  | 'error';

export interface VerifiedField {
  field: string;
  displayName: string;
  expected: string | number | boolean;
  actual: string | number | boolean;
  matched: boolean;
}

export interface VerificationResult {
  success: boolean;
  message: string;
  timestamp: string;
  verifiedFields: VerifiedField[];
  rawResponse?: any;
}

export interface RouterLoginCredentials {
  username?: string;
  password?: string;
}

export interface ProbeResult {
  matches: boolean;
  confidence: number; // 0 to 100
  brand: RouterBrand;
  model?: string;
  firmware?: string;
  signature?: string;
  supportedCapabilities: RouterCapability[];
  suggestedPort?: number;
  suggestedProtocol?: 'http' | 'https';
}

export interface RouterAdapter {
  id: RouterBrand;
  name: string;
  brandName: string;
  defaultGateways: string[];
  defaultPorts: number[];
  defaultProtocol: 'http' | 'https';
  defaultUsername?: string;
  supportedCapabilities: RouterCapability[];
  supportedSecurityModes: RouterSecurityMode[];
  managementProtocol: ManagementProtocol;
  authMethod: AuthMethod;

  probeSignature(
    gatewayIp: string,
    port: number,
    protocol: 'http' | 'https'
  ): Promise<ProbeResult>;

  login(
    endpoint: string,
    credentials: RouterLoginCredentials
  ): Promise<{
    success: boolean;
    sessionToken?: string;
    cookie?: string;
    error?: string;
    rawResponse?: any;
  }>;

  fetchWirelessConfig(
    endpoint: string,
    sessionToken?: string
  ): Promise<{
    success: boolean;
    config?: RouterWirelessConfig;
    error?: string;
    rawResponse?: any;
  }>;

  applyWirelessConfig(
    endpoint: string,
    sessionToken: string,
    updates: Partial<RouterWirelessConfig>
  ): Promise<{
    success: boolean;
    error?: string;
    rebootRequired?: boolean;
    rawResponse?: any;
  }>;

  verifyWirelessConfig(
    endpoint: string,
    sessionToken: string,
    expected: Partial<RouterWirelessConfig>
  ): Promise<VerificationResult>;

  rebootRouter?(
    endpoint: string,
    sessionToken: string
  ): Promise<{ success: boolean; error?: string }>;

  generateDirectScript(
    endpoint: string,
    credentials: RouterLoginCredentials,
    updates: Partial<RouterWirelessConfig>
  ): {
    powershell: string;
    curl: string;
  };
}
