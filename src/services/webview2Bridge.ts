// Universal Windows Bridge: Bridges Microsoft Edge WebView2 native host to Window.electronAPI
// This enables the exact same React UI to run natively in lightweight Windows WebView2 (~2MB) or Electron.

interface PendingRequest {
  resolve: (value: any) => void;
  reject: (reason: any) => void;
  timeout: any;
}

const pendingRequests = new Map<string, PendingRequest>();
const progressListeners = new Set<(data: { type: 'stdout' | 'stderr'; data: string }) => void>();
const updateListeners = new Set<(data: any) => void>();

function generateId(): string {
  return 'wv2_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now();
}

export function initWebView2Bridge(): void {
  if (typeof window === 'undefined') return;

  // 1. If Electron API is already present, Electron takes precedence
  if (window.electronAPI) {
    return;
  }

  // 2. Check for Microsoft Edge WebView2 runtime
  const hasWebView2 = Boolean(window.chrome?.webview?.postMessage);

  if (hasWebView2) {
    console.log('[WebView2Bridge] Detected Microsoft Edge WebView2 native host. Initializing bridge...');

    // Message listener from native C# / Host process
    window.chrome!.webview!.addEventListener('message', (event: any) => {
      const msg = event.data;
      if (!msg) return;

      // Event: Progress streaming
      if (msg.type === 'execution-progress') {
        progressListeners.forEach((fn) => fn(msg.payload));
        return;
      }

      // Event: Update status
      if (msg.type === 'update-status') {
        updateListeners.forEach((fn) => fn(msg.payload));
        return;
      }

      // RPC Responses
      if (msg.id && pendingRequests.has(msg.id)) {
        const req = pendingRequests.get(msg.id)!;
        clearTimeout(req.timeout);
        pendingRequests.delete(msg.id);

        if (msg.error) {
          req.reject(new Error(msg.error));
        } else {
          req.resolve(msg.result !== undefined ? msg.result : msg);
        }
      }
    });

    const sendRpc = (channel: string, data?: any): Promise<any> => {
      return new Promise((resolve, reject) => {
        const id = generateId();
        const timeout = setTimeout(() => {
          if (pendingRequests.has(id)) {
            pendingRequests.delete(id);
            reject(new Error(`WebView2 RPC timeout for channel '${channel}'`));
          }
        }, 60000); // 60s timeout

        pendingRequests.set(id, { resolve, reject, timeout });

        try {
          window.chrome!.webview!.postMessage({ id, channel, data });
        } catch (err) {
          pendingRequests.delete(id);
          clearTimeout(timeout);
          reject(err);
        }
      });
    };

    // Inject electronAPI implementation into window object
    window.electronAPI = {
      getSystemMetrics: () => sendRpc('get-system-metrics'),
      checkElevation: () => sendRpc('check-elevation'),
      runOptimizationTask: (taskId, config, elevate) =>
        sendRpc('run-optimization-task', { taskId, config, elevate }),
      onExecutionProgress: (callback) => {
        progressListeners.add(callback);
        return () => progressListeners.delete(callback);
      },
      routerApi: (action, data) => sendRpc('router-api', { action, data }),
      wifiApi: (action, data) => sendRpc('wifi-api', { action, data }),
      checkForUpdate: () => sendRpc('check-for-update'),
      downloadUpdate: () => sendRpc('download-update'),
      installUpdate: () => sendRpc('install-update'),
      getAppVersion: () => sendRpc('get-app-version'),
      openExternal: (url) => sendRpc('open-external', { url }),
      onUpdateStatus: (callback) => {
        updateListeners.add(callback);
        return () => updateListeners.delete(callback);
      },
    };

    console.log('[WebView2Bridge] Native WebView2 electronAPI bridge active.');
  }
}
