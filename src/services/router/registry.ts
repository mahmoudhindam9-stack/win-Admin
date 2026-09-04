import { RouterAdapter, RouterBrand, RouterDeviceInfo, ProbeResult } from './types';
import { OpenWrtAdapter } from './adapters/openwrt';
import { AsuswrtAdapter } from './adapters/asuswrt';
import { TPLinkAdapter } from './adapters/tplink';
import { NetgearAdapter } from './adapters/netgear';
import { DLinkAdapter } from './adapters/dlink';
import { MikroTikAdapter } from './adapters/mikrotik';
import { GenericRouterAdapter } from './adapters/generic';

export class RouterAdapterRegistry {
  private static instance: RouterAdapterRegistry;
  private adapters: Map<RouterBrand, RouterAdapter> = new Map();

  private constructor() {
    this.register(new OpenWrtAdapter());
    this.register(new AsuswrtAdapter());
    this.register(new TPLinkAdapter());
    this.register(new NetgearAdapter());
    this.register(new DLinkAdapter());
    this.register(new MikroTikAdapter());
    this.register(new GenericRouterAdapter());
  }

  public static getInstance(): RouterAdapterRegistry {
    if (!RouterAdapterRegistry.instance) {
      RouterAdapterRegistry.instance = new RouterAdapterRegistry();
    }
    return RouterAdapterRegistry.instance;
  }

  public register(adapter: RouterAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  public getAdapter(brand: RouterBrand): RouterAdapter {
    const adapter = this.adapters.get(brand);
    if (!adapter) {
      return this.adapters.get('generic') || (this.adapters.values().next().value as RouterAdapter);
    }
    return adapter;
  }

  public getAllAdapters(): RouterAdapter[] {
    return Array.from(this.adapters.values());
  }

  public getSupportedBrands(): { id: RouterBrand; name: string; brandName: string; defaultGateways: string[] }[] {
    return this.getAllAdapters().map((a) => ({
      id: a.id,
      name: a.name,
      brandName: a.brandName,
      defaultGateways: a.defaultGateways,
    }));
  }

  /**
   * Probes all registered adapters to detect matching brand and model for the specified IP
   */
  public async probeAll(
    gatewayIp: string,
    port = 80,
    protocol: 'http' | 'https' = 'http'
  ): Promise<{
    bestMatch: RouterDeviceInfo;
    allProbes: ProbeResult[];
  }> {
    const probePromises = Array.from(this.adapters.values()).map(async (adapter) => {
      try {
        const result = await adapter.probeSignature(gatewayIp, port, protocol);
        return result;
      } catch {
        return {
          matches: false,
          confidence: 0,
          brand: adapter.id,
          supportedCapabilities: adapter.supportedCapabilities,
        };
      }
    });

    const allProbes = await Promise.all(probePromises);

    // Sort by highest confidence
    const sorted = [...allProbes].sort((a, b) => b.confidence - a.confidence);
    const bestProbe = sorted[0];

    let matchedAdapter = this.getAdapter(bestProbe.brand);
    if (!bestProbe.matches || bestProbe.confidence < 50) {
      // Check if the IP matches any default gateway list
      for (const adapter of this.adapters.values()) {
        if (adapter.defaultGateways.includes(gatewayIp)) {
          matchedAdapter = adapter;
          break;
        }
      }
    }

    const deviceInfo: RouterDeviceInfo = {
      brand: matchedAdapter.id,
      brandName: matchedAdapter.brandName,
      model: bestProbe.model || `${matchedAdapter.brandName} Wireless Gateway`,
      firmwareVersion: bestProbe.firmware || 'Detected via Web Signature',
      gatewayIp,
      port: bestProbe.suggestedPort || port,
      protocol: bestProbe.suggestedProtocol || protocol,
      managementProtocol: matchedAdapter.managementProtocol,
      authMethod: matchedAdapter.authMethod,
      supportedCapabilities: matchedAdapter.supportedCapabilities,
      detectionConfidence: bestProbe.confidence >= 80 ? 'confirmed' : bestProbe.confidence >= 40 ? 'probable' : 'manual',
      signatureMatch: bestProbe.signature || `Matched port ${port} signature`,
      hostname: gatewayIp,
    };

    return {
      bestMatch: deviceInfo,
      allProbes,
    };
  }
}
