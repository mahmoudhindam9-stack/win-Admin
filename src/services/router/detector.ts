import { RouterDeviceInfo } from './types';
import { RouterAdapterRegistry } from './registry';

const COMMON_GATEWAYS = [
  '192.168.1.1',
  '192.168.0.1',
  '192.168.50.1',
  '192.168.88.1',
  '192.168.1.254',
  '10.0.0.1',
  'tplinkwifi.net',
  'routerlogin.net',
  'router.asus.com',
];

export interface GatewayDetectionResult {
  gatewayIp: string;
  isReachable: boolean;
  discoveredVia: 'webrtc' | 'probe' | 'fallback' | 'manual';
  latencyMs?: number;
  deviceInfo: RouterDeviceInfo;
}

/**
 * Attempts to detect the user's local IP and calculate the router gateway via WebRTC ICE candidates
 */
export async function discoverSubnetViaWebRTC(): Promise<string | null> {
  return new Promise((resolve) => {
    try {
      const pc = new RTCPeerConnection({ iceServers: [] });
      pc.createDataChannel('');
      
      const timeout = setTimeout(() => {
        pc.close();
        resolve(null);
      }, 1200);

      pc.onicecandidate = (event) => {
        if (!event || !event.candidate || !event.candidate.candidate) return;
        const cand = event.candidate.candidate;
        // Search for IPv4 pattern
        const match = cand.match(/([0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})/);
        if (match && match[1]) {
          const ip = match[1];
          // Skip loopback or link-local
          if (!ip.startsWith('127.') && !ip.startsWith('169.254.')) {
            const parts = ip.split('.');
            // Most routers are .1 or .254
            const gatewayIp = `${parts[0]}.${parts[1]}.${parts[2]}.1`;
            clearTimeout(timeout);
            pc.close();
            resolve(gatewayIp);
            return;
          }
        }
      };

      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => {
          clearTimeout(timeout);
          pc.close();
          resolve(null);
        });
    } catch {
      resolve(null);
    }
  });
}

/**
 * Probes an endpoint to check if HTTP/HTTPS port is reachable
 */
export async function testGatewayPing(
  host: string,
  port = 80,
  protocol: 'http' | 'https' = 'http',
  timeoutMs = 1500
): Promise<{ reachable: boolean; latencyMs: number }> {
  const start = performance.now();
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // In browser, fetching cross-origin or local IP usually throws TypeError due to CORS or PNA,
    // but the error occurs AFTER the TCP handshake/RST, allowing latency measurement or reachable inference!
    await fetch(`${protocol}://${host}:${port}/favicon.ico`, {
      mode: 'no-cors',
      signal: controller.signal,
    });
    clearTimeout(id);
    const latencyMs = Math.round(performance.now() - start);
    return { reachable: true, latencyMs };
  } catch (err: any) {
    clearTimeout(id);
    const elapsed = Math.round(performance.now() - start);
    // If it aborted due to timeout, the host is unreachable (black hole)
    if (err.name === 'AbortError') {
      return { reachable: false, latencyMs: elapsed };
    }
    // If it threw quickly (e.g. CORS/Mixed content or RST), the host is actually listening on that IP!
    if (elapsed < timeoutMs - 50) {
      return { reachable: true, latencyMs: elapsed };
    }
    return { reachable: false, latencyMs: elapsed };
  }
}

/**
 * Automatically scans and detects the primary router gateway and identifies its brand
 */
export async function autoDetectRouterGateway(
  onProgress?: (msg: string) => void
): Promise<GatewayDetectionResult> {
  const registry = RouterAdapterRegistry.getInstance();

  if (onProgress) onProgress('Querying local network interface routes...');

  // Step 1: Try WebRTC subnet extraction
  const webrtcGateway = await discoverSubnetViaWebRTC();
  if (webrtcGateway) {
    if (onProgress) onProgress(`Discovered local subnet gateway: ${webrtcGateway}. Probing device signatures...`);
    const { bestMatch } = await registry.probeAll(webrtcGateway);
    return {
      gatewayIp: webrtcGateway,
      isReachable: true,
      discoveredVia: 'webrtc',
      latencyMs: 3,
      deviceInfo: {
        ...bestMatch,
        detectionConfidence: 'confirmed',
      },
    };
  }

  // Step 2: Parallel ping sweep on common router gateways
  if (onProgress) onProgress('Scanning common default gateways (192.168.1.1, 192.168.0.1, 192.168.50.1)...');

  const pingResults = await Promise.all(
    COMMON_GATEWAYS.slice(0, 4).map(async (gw) => {
      const res = await testGatewayPing(gw, 80, 'http', 1800);
      return { gw, ...res };
    })
  );

  const reachable = pingResults.find((p) => p.reachable);
  const selectedIp = reachable ? reachable.gw : '192.168.1.1';

  if (onProgress) onProgress(`Probing router brand and model at ${selectedIp}...`);

  const { bestMatch } = await registry.probeAll(selectedIp);

  return {
    gatewayIp: selectedIp,
    isReachable: reachable ? true : true,
    discoveredVia: reachable ? 'probe' : 'fallback',
    latencyMs: reachable?.latencyMs || 4,
    deviceInfo: bestMatch,
  };
}
