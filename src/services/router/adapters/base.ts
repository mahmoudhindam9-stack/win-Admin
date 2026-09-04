import {
  RouterAdapter,
  RouterBrand,
  RouterCapability,
  RouterLoginCredentials,
  RouterSecurityMode,
  RouterWirelessConfig,
  VerificationResult,
  ProbeResult,
  ManagementProtocol,
  AuthMethod,
  VerifiedField,
} from '../types';

export abstract class BaseRouterAdapter implements RouterAdapter {
  abstract id: RouterBrand;
  abstract name: string;
  abstract brandName: string;
  abstract defaultGateways: string[];
  abstract defaultPorts: number[];
  abstract defaultProtocol: 'http' | 'https';
  abstract defaultUsername?: string;
  abstract supportedCapabilities: RouterCapability[];
  abstract supportedSecurityModes: RouterSecurityMode[];
  abstract managementProtocol: ManagementProtocol;
  abstract authMethod: AuthMethod;

  abstract probeSignature(
    gatewayIp: string,
    port: number,
    protocol: 'http' | 'https'
  ): Promise<ProbeResult>;

  abstract login(
    endpoint: string,
    credentials: RouterLoginCredentials
  ): Promise<{
    success: boolean;
    sessionToken?: string;
    cookie?: string;
    error?: string;
    rawResponse?: any;
  }>;

  abstract fetchWirelessConfig(
    endpoint: string,
    sessionToken?: string
  ): Promise<{
    success: boolean;
    config?: RouterWirelessConfig;
    error?: string;
    rawResponse?: any;
  }>;

  abstract applyWirelessConfig(
    endpoint: string,
    sessionToken: string,
    updates: Partial<RouterWirelessConfig>
  ): Promise<{
    success: boolean;
    error?: string;
    rebootRequired?: boolean;
    rawResponse?: any;
  }>;

  async verifyWirelessConfig(
    endpoint: string,
    sessionToken: string,
    expected: Partial<RouterWirelessConfig>
  ): Promise<VerificationResult> {
    const verifiedFields: VerifiedField[] = [];
    const timestamp = new Date().toLocaleTimeString();

    try {
      // Query the live router config immediately after applying
      const fetchResult = await this.fetchWirelessConfig(endpoint, sessionToken);

      if (!fetchResult.success || !fetchResult.config) {
        return {
          success: false,
          message: `Verification query failed: ${fetchResult.error || 'Router did not return configuration'}`,
          timestamp,
          verifiedFields: [],
        };
      }

      const live = fetchResult.config;

      // Verify 2.4 GHz Band
      if (expected.band24 && live.band24) {
        if (expected.band24.ssid !== undefined) {
          const matched = live.band24.ssid === expected.band24.ssid;
          verifiedFields.push({
            field: 'band24.ssid',
            displayName: '2.4 GHz Wi-Fi Name (SSID)',
            expected: expected.band24.ssid,
            actual: live.band24.ssid,
            matched,
          });
        }
        if (expected.band24.securityMode !== undefined) {
          const matched = live.band24.securityMode === expected.band24.securityMode;
          verifiedFields.push({
            field: 'band24.securityMode',
            displayName: '2.4 GHz Security Mode',
            expected: expected.band24.securityMode,
            actual: live.band24.securityMode,
            matched,
          });
        }
        if (expected.band24.channel !== undefined) {
          const matched = String(live.band24.channel) === String(expected.band24.channel);
          verifiedFields.push({
            field: 'band24.channel',
            displayName: '2.4 GHz Channel',
            expected: expected.band24.channel,
            actual: live.band24.channel,
            matched,
          });
        }
        if (expected.band24.hidden !== undefined) {
          const matched = live.band24.hidden === expected.band24.hidden;
          verifiedFields.push({
            field: 'band24.hidden',
            displayName: '2.4 GHz SSID Broadcast',
            expected: expected.band24.hidden ? 'Hidden' : 'Visible',
            actual: live.band24.hidden ? 'Hidden' : 'Visible',
            matched,
          });
        }
      }

      // Verify 5.0 GHz Band
      if (expected.band50 && live.band50) {
        if (expected.band50.ssid !== undefined) {
          const matched = live.band50.ssid === expected.band50.ssid;
          verifiedFields.push({
            field: 'band50.ssid',
            displayName: '5 GHz Wi-Fi Name (SSID)',
            expected: expected.band50.ssid,
            actual: live.band50.ssid,
            matched,
          });
        }
        if (expected.band50.securityMode !== undefined) {
          const matched = live.band50.securityMode === expected.band50.securityMode;
          verifiedFields.push({
            field: 'band50.securityMode',
            displayName: '5 GHz Security Mode',
            expected: expected.band50.securityMode,
            actual: live.band50.securityMode,
            matched,
          });
        }
        if (expected.band50.channel !== undefined) {
          const matched = String(live.band50.channel) === String(expected.band50.channel);
          verifiedFields.push({
            field: 'band50.channel',
            displayName: '5 GHz Channel',
            expected: expected.band50.channel,
            actual: live.band50.channel,
            matched,
          });
        }
      }

      // Verify Guest Network if applicable
      if (expected.guestNetwork && live.guestNetwork) {
        if (expected.guestNetwork.enabled !== undefined) {
          const matched = live.guestNetwork.enabled === expected.guestNetwork.enabled;
          verifiedFields.push({
            field: 'guestNetwork.enabled',
            displayName: 'Guest Network Active',
            expected: expected.guestNetwork.enabled ? 'Enabled' : 'Disabled',
            actual: live.guestNetwork.enabled ? 'Enabled' : 'Disabled',
            matched,
          });
        }
        if (expected.guestNetwork.ssid !== undefined) {
          const matched = live.guestNetwork.ssid === expected.guestNetwork.ssid;
          verifiedFields.push({
            field: 'guestNetwork.ssid',
            displayName: 'Guest Network SSID',
            expected: expected.guestNetwork.ssid,
            actual: live.guestNetwork.ssid,
            matched,
          });
        }
      }

      const allMatched = verifiedFields.length > 0 && verifiedFields.every((f) => f.matched);

      return {
        success: allMatched,
        message: allMatched
          ? `All ${verifiedFields.length} settings verified successfully on ${this.brandName} router.`
          : 'Some settings could not be verified or differed from applied values.',
        timestamp,
        verifiedFields,
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Verification exception: ${err.message || String(err)}`,
        timestamp,
        verifiedFields,
      };
    }
  }

  abstract generateDirectScript(
    endpoint: string,
    credentials: RouterLoginCredentials,
    updates: Partial<RouterWirelessConfig>
  ): {
    powershell: string;
    curl: string;
  };

  protected safeFetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 4000): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeoutMs);
    return fetch(url, {
      ...options,
      signal: controller.signal,
    }).finally(() => clearTimeout(id));
  }
}
