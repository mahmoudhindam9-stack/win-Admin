import React, { useState, useEffect } from 'react';
import {
  Wifi,
  Router,
  Shield,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sliders,
  Terminal,
  Download,
  ExternalLink,
  Lock,
  Eye,
  EyeOff,
  Radio,
  Layers,
  Activity,
  Server,
  Zap,
  Check,
  X,
  AlertTriangle,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import {
  RouterBrand,
  RouterDeviceInfo,
  RouterWirelessConfig,
  RouterSecurityMode,
  VerificationResult,
  ConnectionStatus,
  RouterLoginCredentials,
} from '../services/router/types';
import { RouterAdapterRegistry } from '../services/router/registry';
import { autoDetectRouterGateway, testGatewayPing } from '../services/router/detector';

interface RouterManagementViewProps {
  onExecuteScriptInTerminal?: (cmdTitle: string, powershellScript: string) => void;
}

export const RouterManagementView: React.FC<RouterManagementViewProps> = ({
  onExecuteScriptInTerminal,
}) => {
  const registry = RouterAdapterRegistry.getInstance();
  const supportedBrands = registry.getSupportedBrands();

  // Device & Connection State
  const [deviceInfo, setDeviceInfo] = useState<RouterDeviceInfo>({
    brand: 'openwrt',
    brandName: 'OpenWrt',
    model: 'OpenWrt Linux Wireless Router',
    firmwareVersion: 'OpenWrt 23.05 (LuCI ubus)',
    gatewayIp: '192.168.1.1',
    port: 80,
    protocol: 'http',
    managementProtocol: 'ubus_jsonrpc',
    authMethod: 'ubus_session',
    supportedCapabilities: [
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
    ],
    detectionConfidence: 'confirmed',
  });

  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('detected');
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectionLog, setDetectionLog] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Manual configuration drawer/inputs
  const [isManualConfigOpen, setIsManualConfigOpen] = useState(false);
  const [manualIp, setManualIp] = useState('192.168.1.1');
  const [manualPort, setManualPort] = useState(80);
  const [manualProtocol, setManualProtocol] = useState<'http' | 'https'>('http');
  const [manualBrand, setManualBrand] = useState<RouterBrand>('openwrt');

  // Credentials
  const [credentials, setCredentials] = useState<RouterLoginCredentials>({
    username: 'root',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showWifiPassword24, setShowWifiPassword24] = useState(false);
  const [showWifiPassword50, setShowWifiPassword50] = useState(false);

  // Live Wireless Configuration State
  const [wirelessConfig, setWirelessConfig] = useState<RouterWirelessConfig>({
    band24: {
      enabled: true,
      ssid: 'OpenWrt-2.4G',
      password: 'NetworkPassword2026',
      securityMode: 'WPA2-PSK',
      channel: 6,
      channelWidth: '20MHz',
      hidden: false,
      txPower: '100%',
    },
    band50: {
      enabled: true,
      ssid: 'OpenWrt-5G',
      password: 'NetworkPassword2026',
      securityMode: 'WPA3-SAE',
      channel: 36,
      channelWidth: '80MHz',
      hidden: false,
      txPower: '100%',
    },
    guestNetwork: {
      enabled: false,
      ssid: 'OpenWrt-Guest',
      password: 'GuestPassword123',
      securityMode: 'WPA2-PSK',
      isolateClients: true,
    },
    lastRetrieved: new Date().toLocaleTimeString(),
  });

  // Track original config to detect dirty fields
  const [originalConfig, setOriginalConfig] = useState<RouterWirelessConfig>(wirelessConfig);

  // Active Session & Verification Results
  const [sessionToken, setSessionToken] = useState<string>('ubus_session_active');
  const [isApplying, setIsApplying] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [showScriptModal, setShowScriptModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'wifi' | 'guest' | 'security' | 'direct'>('wifi');

  const currentAdapter = registry.getAdapter(deviceInfo.brand);

  // Initial gateway detection
  useEffect(() => {
    handleAutoDetect(false);
  }, []);

  const handleAutoDetect = async (forceRescan = true) => {
    setIsDetecting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    setDetectionLog('Initializing gateway route detection...');

    try {
      const result = await autoDetectRouterGateway((msg) => {
        setDetectionLog(msg);
      });

      setDeviceInfo(result.deviceInfo);
      setManualIp(result.gatewayIp);
      setManualPort(result.deviceInfo.port);
      setManualProtocol(result.deviceInfo.protocol);
      setManualBrand(result.deviceInfo.brand);

      const adapter = registry.getAdapter(result.deviceInfo.brand);
      setCredentials((prev) => ({
        ...prev,
        username: adapter.defaultUsername || 'admin',
      }));

      // Fetch live config for this adapter
      const configRes = await adapter.fetchWirelessConfig(
        `${result.deviceInfo.protocol}://${result.gatewayIp}:${result.deviceInfo.port}`
      );
      if (configRes.config) {
        setWirelessConfig(configRes.config);
        setOriginalConfig(configRes.config);
      }

      setConnectionStatus('detected');
      setSuccessMessage(
        `Detected ${result.deviceInfo.brandName} (${result.deviceInfo.model}) at ${result.gatewayIp}`
      );
    } catch (err: any) {
      setErrorMessage(`Gateway detection error: ${err.message || String(err)}`);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleManualApply = async () => {
    setIsDetecting(true);
    setErrorMessage(null);
    const adapter = registry.getAdapter(manualBrand);

    const newDeviceInfo: RouterDeviceInfo = {
      brand: manualBrand,
      brandName: adapter.brandName,
      model: `${adapter.brandName} Wireless Gateway`,
      firmwareVersion: `${adapter.brandName} OS`,
      gatewayIp: manualIp,
      port: manualPort,
      protocol: manualProtocol,
      managementProtocol: adapter.managementProtocol,
      authMethod: adapter.authMethod,
      supportedCapabilities: adapter.supportedCapabilities,
      detectionConfidence: 'manual',
    };

    setDeviceInfo(newDeviceInfo);
    setCredentials((prev) => ({
      ...prev,
      username: adapter.defaultUsername || 'admin',
    }));

    // Fetch config
    const configRes = await adapter.fetchWirelessConfig(
      `${manualProtocol}://${manualIp}:${manualPort}`
    );
    if (configRes.config) {
      setWirelessConfig(configRes.config);
      setOriginalConfig(configRes.config);
    }

    setIsDetecting(false);
    setIsManualConfigOpen(false);
    setSuccessMessage(`Router target set to ${adapter.brandName} at ${manualIp}`);
  };

  const handleConnectAndAuthenticate = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setConnectionStatus('authenticating');

    const endpoint = `${deviceInfo.protocol}://${deviceInfo.gatewayIp}:${deviceInfo.port}`;
    try {
      const loginRes = await currentAdapter.login(endpoint, credentials);
      if (!loginRes.success) {
        setConnectionStatus('error');
        setErrorMessage(loginRes.error || 'Authentication rejected by router.');
        return;
      }

      const token = loginRes.sessionToken || 'session_authenticated';
      setSessionToken(token);
      setConnectionStatus('connected');

      // Fetch live config
      const configRes = await currentAdapter.fetchWirelessConfig(endpoint, token);
      if (configRes.config) {
        setWirelessConfig(configRes.config);
        setOriginalConfig(configRes.config);
      }

      setSuccessMessage(`Successfully authenticated with ${deviceInfo.brandName} (${deviceInfo.managementProtocol})`);
    } catch (err: any) {
      setConnectionStatus('error');
      setErrorMessage(`Authentication failed: ${err.message || String(err)}`);
    }
  };

  // Apply wireless configuration and then VERIFY it
  const handleApplyAndVerify = async () => {
    setErrorMessage(null);
    setSuccessMessage(null);
    setIsApplying(true);
    setVerificationResult(null);

    const endpoint = `${deviceInfo.protocol}://${deviceInfo.gatewayIp}:${deviceInfo.port}`;

    // Validate inputs
    if (wirelessConfig.band24?.enabled) {
      if (!wirelessConfig.band24.ssid.trim()) {
        setErrorMessage('2.4 GHz SSID cannot be empty.');
        setIsApplying(false);
        return;
      }
      if (
        wirelessConfig.band24.securityMode !== 'Open' &&
        wirelessConfig.band24.password.length < 8
      ) {
        setErrorMessage('2.4 GHz Wi-Fi password must be at least 8 characters for WPA/WPA2/WPA3.');
        setIsApplying(false);
        return;
      }
    }

    if (wirelessConfig.band50?.enabled) {
      if (!wirelessConfig.band50.ssid.trim()) {
        setErrorMessage('5 GHz SSID cannot be empty.');
        setIsApplying(false);
        return;
      }
      if (
        wirelessConfig.band50.securityMode !== 'Open' &&
        wirelessConfig.band50.password.length < 8
      ) {
        setErrorMessage('5 GHz Wi-Fi password must be at least 8 characters for WPA/WPA2/WPA3.');
        setIsApplying(false);
        return;
      }
    }

    try {
      // Step 1: Apply to router
      setConnectionStatus('applying');
      const applyRes = await currentAdapter.applyWirelessConfig(
        endpoint,
        sessionToken,
        wirelessConfig
      );

      if (!applyRes.success) {
        throw new Error(applyRes.error || 'Router rejected the wireless configuration payload.');
      }

      // Step 2: Query router to VERIFY the change was accepted
      setConnectionStatus('verifying');
      setIsVerifying(true);

      // Brief pause to allow router firmware NVRAM/UCI commit to register
      await new Promise((r) => setTimeout(r, 600));

      const vResult = await currentAdapter.verifyWirelessConfig(
        endpoint,
        sessionToken,
        wirelessConfig
      );

      setVerificationResult(vResult);
      setOriginalConfig({ ...wirelessConfig });
      setConnectionStatus('connected');

      if (vResult.success) {
        setSuccessMessage(`Changes verified successfully on ${deviceInfo.brandName} router!`);
      } else {
        setErrorMessage(`Configuration applied, but verification note: ${vResult.message}`);
      }
    } catch (err: any) {
      setConnectionStatus('error');
      setErrorMessage(`Failed to apply configuration: ${err.message || String(err)}`);
    } finally {
      setIsApplying(false);
      setIsVerifying(false);
    }
  };

  const handleExportScript = () => {
    const endpoint = `${deviceInfo.protocol}://${deviceInfo.gatewayIp}:${deviceInfo.port}`;
    const scripts = currentAdapter.generateDirectScript(endpoint, credentials, wirelessConfig);
    const blob = new Blob([scripts.powershell], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Configure-Router-${deviceInfo.brand}.ps1`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleExecuteInTerminal = () => {
    if (!onExecuteScriptInTerminal) return;
    const endpoint = `${deviceInfo.protocol}://${deviceInfo.gatewayIp}:${deviceInfo.port}`;
    const scripts = currentAdapter.generateDirectScript(endpoint, credentials, wirelessConfig);
    onExecuteScriptInTerminal(
      `Configure ${deviceInfo.brandName} Wi-Fi Settings`,
      scripts.powershell
    );
  };

  const handleReboot = async () => {
    if (!window.confirm(`Are you sure you want to reboot the ${deviceInfo.brandName} router at ${deviceInfo.gatewayIp}? Wi-Fi will temporarily disconnect for ~60 seconds.`)) {
      return;
    }

    const endpoint = `${deviceInfo.protocol}://${deviceInfo.gatewayIp}:${deviceInfo.port}`;
    try {
      if (currentAdapter.rebootRouter) {
        await currentAdapter.rebootRouter(endpoint, sessionToken);
      }
      setSuccessMessage(`Reboot signal sent to ${deviceInfo.brandName} router. Gateway is restarting.`);
    } catch (e: any) {
      setErrorMessage(`Reboot command failed: ${e.message}`);
    }
  };

  // Helper check for capability
  const supports = (cap: any) => currentAdapter.supportedCapabilities.includes(cap);

  return (
    <div className="flex flex-col space-y-6">
      {/* Top Header Card: Gateway Status & Auto-Detection */}
      <div className="bg-[#0F1423] border border-[#1F293D] rounded-xl p-5 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-white shadow-md shadow-cyan-950/50 border border-cyan-400/30">
              <Router className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-base font-bold text-slate-100">
                  Universal Router Management Console
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-cyan-950/70 border border-cyan-500/40 text-[11px] font-semibold text-cyan-300">
                  {deviceInfo.brandName}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#161B2A] border border-[#1F293D] text-[10px] font-mono text-slate-400">
                  {deviceInfo.managementProtocol}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Polymorphic router adapter suite with live gateway discovery, credentials management, and real-time settings verification.
              </p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center space-x-2.5">
            <button
              id="btn-auto-detect-gateway"
              onClick={() => handleAutoDetect(true)}
              disabled={isDetecting}
              className="px-3.5 py-2 bg-[#161B2A] hover:bg-[#1E293B] text-slate-200 hover:text-white rounded-lg text-xs font-semibold border border-[#1F293D] hover:border-cyan-500/40 flex items-center space-x-2 transition-all cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-cyan-400 ${isDetecting ? 'animate-spin' : ''}`} />
              <span>{isDetecting ? 'Scanning Subnet...' : 'Auto-Detect Gateway'}</span>
            </button>

            <button
              id="btn-toggle-manual-config"
              onClick={() => setIsManualConfigOpen(!isManualConfigOpen)}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer flex items-center space-x-1.5 ${
                isManualConfigOpen
                  ? 'bg-cyan-950/60 border-cyan-500/60 text-cyan-300'
                  : 'bg-[#161B2A] hover:bg-[#1E293B] border-[#1F293D] text-slate-300'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>Manual IP / Model</span>
            </button>

            <a
              href={`${deviceInfo.protocol}://${deviceInfo.gatewayIp}:${deviceInfo.port}`}
              target="_blank"
              rel="noreferrer"
              className="px-3 py-2 bg-[#161B2A] hover:bg-[#1E293B] text-slate-300 hover:text-white rounded-lg text-xs font-semibold border border-[#1F293D] flex items-center space-x-1.5 transition-colors cursor-pointer"
              title="Open router web portal in new tab"
            >
              <ExternalLink className="w-3.5 h-3.5 text-cyan-400" />
              <span>Open Portal</span>
            </a>
          </div>
        </div>

        {/* Live Detected Info Bar */}
        <div className="mt-4 pt-4 border-t border-[#1F293D] grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 text-xs">
          <div className="bg-[#0B0F1A] p-2.5 rounded-lg border border-[#1F293D]">
            <span className="text-[11px] text-slate-400 block">Gateway IP</span>
            <span className="font-mono font-bold text-cyan-300">{deviceInfo.gatewayIp}</span>
          </div>

          <div className="bg-[#0B0F1A] p-2.5 rounded-lg border border-[#1F293D]">
            <span className="text-[11px] text-slate-400 block">Detected Model</span>
            <span className="font-semibold text-slate-200 truncate block">{deviceInfo.model}</span>
          </div>

          <div className="bg-[#0B0F1A] p-2.5 rounded-lg border border-[#1F293D]">
            <span className="text-[11px] text-slate-400 block">Management API</span>
            <span className="font-mono text-emerald-400 truncate block">
              {deviceInfo.managementProtocol}
            </span>
          </div>

          <div className="bg-[#0B0F1A] p-2.5 rounded-lg border border-[#1F293D]">
            <span className="text-[11px] text-slate-400 block">Auth Method</span>
            <span className="font-mono text-purple-300">{deviceInfo.authMethod}</span>
          </div>

          <div className="bg-[#0B0F1A] p-2.5 rounded-lg border border-[#1F293D]">
            <span className="text-[11px] text-slate-400 block">Confidence</span>
            <span className="font-semibold capitalize text-cyan-400 flex items-center space-x-1">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>{deviceInfo.detectionConfidence}</span>
            </span>
          </div>

          <div className="bg-[#0B0F1A] p-2.5 rounded-lg border border-[#1F293D]">
            <span className="text-[11px] text-slate-400 block">Connection Status</span>
            <span
              className={`font-semibold capitalize flex items-center space-x-1 ${
                connectionStatus === 'connected'
                  ? 'text-emerald-400'
                  : connectionStatus === 'authenticating' || connectionStatus === 'verifying'
                  ? 'text-amber-400'
                  : connectionStatus === 'error'
                  ? 'text-rose-400'
                  : 'text-cyan-400'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${
                connectionStatus === 'connected' ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]' : 'bg-cyan-400'
              }`} />
              <span>{connectionStatus}</span>
            </span>
          </div>
        </div>

        {/* Progress or detection status message */}
        {isDetecting && detectionLog && (
          <div className="mt-3 p-2 bg-[#0B0F1A] border border-cyan-900/50 rounded-lg text-xs text-cyan-300 flex items-center space-x-2 font-mono">
            <Activity className="w-3.5 h-3.5 animate-spin text-cyan-400" />
            <span>{detectionLog}</span>
          </div>
        )}

        {/* Feedback Alert Banners */}
        {successMessage && (
          <div className="mt-3 p-3 bg-emerald-950/40 border border-emerald-800/50 rounded-lg text-xs text-emerald-300 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{successMessage}</span>
          </div>
        )}

        {errorMessage && (
          <div className="mt-3 p-3 bg-rose-950/40 border border-rose-800/50 rounded-lg text-xs text-rose-300 flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Manual Configuration Dropdown Panel */}
        {isManualConfigOpen && (
          <div className="mt-4 pt-4 border-t border-[#1F293D] bg-[#0B0F1A] p-4 rounded-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                <span>Manual Router Gateway & Model Selection</span>
              </h3>
              <span className="text-[11px] text-slate-400">
                Override automatic detection if your router is on a custom subnet
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Router IP or Hostname
                </label>
                <input
                  type="text"
                  value={manualIp}
                  onChange={(e) => setManualIp(e.target.value)}
                  placeholder="192.168.1.1"
                  className="w-full px-3 py-1.5 bg-[#161B2A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-xs font-mono text-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Port & Protocol
                </label>
                <div className="flex space-x-2">
                  <select
                    value={manualProtocol}
                    onChange={(e) => setManualProtocol(e.target.value as any)}
                    className="px-2 py-1.5 bg-[#161B2A] border border-[#1F293D] rounded-lg text-xs font-mono text-slate-200 outline-none"
                  >
                    <option value="http">HTTP</option>
                    <option value="https">HTTPS</option>
                  </select>
                  <input
                    type="number"
                    value={manualPort}
                    onChange={(e) => setManualPort(parseInt(e.target.value) || 80)}
                    className="w-full px-3 py-1.5 bg-[#161B2A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-xs font-mono text-slate-200 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Router Brand / Firmware Type
                </label>
                <select
                  value={manualBrand}
                  onChange={(e) => setManualBrand(e.target.value as RouterBrand)}
                  className="w-full px-3 py-1.5 bg-[#161B2A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-xs font-sans text-slate-200 outline-none"
                >
                  {supportedBrands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-end">
                <button
                  onClick={handleManualApply}
                  className="w-full py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-sm"
                >
                  Confirm Target Router
                </button>
              </div>
            </div>

            {/* Quick-select common router IPs */}
            <div className="flex flex-wrap items-center gap-1.5 pt-2">
              <span className="text-[11px] text-slate-400 mr-1">Common Presets:</span>
              {['192.168.1.1', '192.168.0.1', '192.168.50.1', '192.168.88.1', '10.0.0.1', 'tplinkwifi.net', 'routerlogin.net'].map((ip) => (
                <button
                  key={ip}
                  type="button"
                  onClick={() => setManualIp(ip)}
                  className="px-2 py-0.5 rounded bg-[#161B2A] hover:bg-[#1E293B] text-slate-300 hover:text-white border border-[#1F293D] text-[11px] font-mono cursor-pointer transition-colors"
                >
                  {ip}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Main Grid: Router Login & Capabilities on Left, Live Wi-Fi Controls on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Router Credentials & Supported Capabilities */}
        <div className="lg:col-span-4 space-y-6">
          {/* Router Authentication Card */}
          <div className="bg-[#0F1423] border border-[#1F293D] rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Lock className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-slate-100">Router Authentication</h3>
              </div>
              <span className="text-[11px] font-mono text-slate-400">
                {currentAdapter.authMethod}
              </span>
            </div>

            <p className="text-xs text-slate-400">
              Enter administrator credentials for {deviceInfo.brandName} to manage and commit settings.
            </p>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Admin Username
                </label>
                <input
                  type="text"
                  value={credentials.username}
                  onChange={(e) =>
                    setCredentials((prev) => ({ ...prev, username: e.target.value }))
                  }
                  placeholder="admin or root"
                  className="w-full px-3 py-2 bg-[#0B0F1A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-xs text-slate-200 outline-none"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">
                  Admin Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={credentials.password}
                    onChange={(e) =>
                      setCredentials((prev) => ({ ...prev, password: e.target.value }))
                    }
                    placeholder="Router admin password"
                    className="w-full px-3 py-2 pr-9 bg-[#0B0F1A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-xs text-slate-200 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <button
                id="btn-router-auth-connect"
                onClick={handleConnectAndAuthenticate}
                disabled={connectionStatus === 'authenticating'}
                className="w-full py-2 bg-gradient-to-r from-[#0284C7] to-[#2563EB] hover:from-[#0369A1] hover:to-[#1D4ED8] text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-2 shadow-sm"
              >
                <KeyRound className="w-3.5 h-3.5" />
                <span>
                  {connectionStatus === 'connected'
                    ? 'Session Active &bull; Re-Verify'
                    : 'Connect & Fetch Live Config'}
                </span>
              </button>
            </div>
          </div>

          {/* Supported Capabilities Inspection Card */}
          <div className="bg-[#0F1423] border border-[#1F293D] rounded-xl p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Shield className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-slate-100">Adapter Capabilities</h3>
              </div>
              <span className="text-[10px] bg-emerald-950/70 border border-emerald-700/50 text-emerald-300 px-2 py-0.5 rounded-full font-semibold">
                Only Verified Shown
              </span>
            </div>

            <p className="text-xs text-slate-400">
              The application dynamically adapts to only expose controls supported by {deviceInfo.brandName}:
            </p>

            <div className="space-y-2 pt-1">
              {[
                { id: 'wifi_24ghz', label: '2.4 GHz Primary Radio' },
                { id: 'wifi_5ghz', label: '5.0 GHz High-Band Radio' },
                { id: 'wifi_password', label: 'WPA2 / WPA3 Passphrase Management' },
                { id: 'security_mode', label: 'WPA3-SAE / WPA2-PSK Mode Switching' },
                { id: 'channel_selection', label: 'Manual Channel & Auto-DFS Selection' },
                { id: 'channel_width', label: 'Channel Bandwidth (20/40/80/160 MHz)' },
                { id: 'hide_ssid', label: 'Hide SSID Broadcast' },
                { id: 'guest_network', label: 'Isolated Guest Wi-Fi Subnet' },
                { id: 'reboot', label: 'Remote Hardware Reboot API' },
              ].map((cap) => {
                const isSupported = supports(cap.id);
                return (
                  <div
                    key={cap.id}
                    className="flex items-center justify-between text-xs py-1 px-2 rounded bg-[#0B0F1A] border border-[#1F293D]"
                  >
                    <span className={isSupported ? 'text-slate-300' : 'text-slate-500 line-through'}>
                      {cap.label}
                    </span>
                    {isSupported ? (
                      <span className="text-emerald-400 font-semibold flex items-center space-x-1 text-[11px]">
                        <Check className="w-3 h-3" />
                        <span>Supported</span>
                      </span>
                    ) : (
                      <span className="text-slate-500 text-[11px]">Not Available</span>
                    )}
                  </div>
                );
              })}
            </div>

            {supports('reboot') && (
              <div className="pt-2">
                <button
                  onClick={handleReboot}
                  className="w-full py-1.5 px-3 bg-rose-950/40 hover:bg-rose-900/40 text-rose-300 border border-rose-800/40 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reboot Router Hardware</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Wireless Settings & Verification Panel */}
        <div className="lg:col-span-8 space-y-6">
          {/* Settings Tabs Bar */}
          <div className="bg-[#0F1423] border border-[#1F293D] rounded-xl p-1.5 flex items-center space-x-1 text-xs">
            <button
              onClick={() => setActiveTab('wifi')}
              className={`flex-1 py-2 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'wifi'
                  ? 'bg-[#0284C7] text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#161B2A]'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Primary Dual-Band Wi-Fi</span>
            </button>

            {supports('guest_network') && (
              <button
                onClick={() => setActiveTab('guest')}
                className={`flex-1 py-2 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                  activeTab === 'guest'
                    ? 'bg-[#0284C7] text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-[#161B2A]'
                }`}
              >
                <Wifi className="w-3.5 h-3.5" />
                <span>Guest Wi-Fi Network</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('direct')}
              className={`flex-1 py-2 rounded-lg font-semibold flex items-center justify-center space-x-2 transition-all cursor-pointer ${
                activeTab === 'direct'
                  ? 'bg-[#0284C7] text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#161B2A]'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>PowerShell & Script Bridge</span>
            </button>
          </div>

          {/* TAB 1: PRIMARY DUAL-BAND WI-FI */}
          {activeTab === 'wifi' && (
            <div className="space-y-6">
              {/* 2.4 GHz Band Card */}
              {supports('wifi_24ghz') && wirelessConfig.band24 && (
                <div className="bg-[#0F1423] border border-[#1F293D] rounded-xl p-5 shadow-lg space-y-4">
                  <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-sky-950/70 border border-sky-500/30 flex items-center justify-center text-sky-400">
                        <Radio className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-100">
                          2.4 GHz Wireless Settings
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          Long-range frequency band for general IoT and smart home devices
                        </p>
                      </div>
                    </div>

                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={wirelessConfig.band24.enabled}
                        onChange={(e) =>
                          setWirelessConfig((prev) => ({
                            ...prev,
                            band24: { ...prev.band24!, enabled: e.target.checked },
                          }))
                        }
                        className="rounded border-[#1F293D] text-cyan-600 focus:ring-0 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-slate-300">Enable 2.4G</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Wi-Fi Name (SSID)
                      </label>
                      <input
                        type="text"
                        value={wirelessConfig.band24.ssid}
                        onChange={(e) =>
                          setWirelessConfig((prev) => ({
                            ...prev,
                            band24: { ...prev.band24!, ssid: e.target.value },
                          }))
                        }
                        placeholder="e.g. Home_Network_2.4G"
                        className="w-full px-3 py-2 bg-[#0B0F1A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-xs font-mono text-slate-200 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        Wi-Fi Password (WPA Key)
                      </label>
                      <div className="relative">
                        <input
                          type={showWifiPassword24 ? 'text' : 'password'}
                          value={wirelessConfig.band24.password}
                          onChange={(e) =>
                            setWirelessConfig((prev) => ({
                              ...prev,
                              band24: { ...prev.band24!, password: e.target.value },
                            }))
                          }
                          placeholder="At least 8 characters"
                          className="w-full px-3 py-2 pr-9 bg-[#0B0F1A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-xs font-mono text-slate-200 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowWifiPassword24(!showWifiPassword24)}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                        >
                          {showWifiPassword24 ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {supports('security_mode') && (
                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1">
                          Security Mode
                        </label>
                        <select
                          value={wirelessConfig.band24.securityMode}
                          onChange={(e) =>
                            setWirelessConfig((prev) => ({
                              ...prev,
                              band24: {
                                ...prev.band24!,
                                securityMode: e.target.value as RouterSecurityMode,
                              },
                            }))
                          }
                          className="w-full px-3 py-2 bg-[#0B0F1A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-xs text-slate-200 outline-none"
                        >
                          {currentAdapter.supportedSecurityModes.map((mode) => (
                            <option key={mode} value={mode}>
                              {mode}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {supports('channel_selection') && (
                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1">
                          Wireless Channel
                        </label>
                        <select
                          value={wirelessConfig.band24.channel}
                          onChange={(e) =>
                            setWirelessConfig((prev) => ({
                              ...prev,
                              band24: {
                                ...prev.band24!,
                                channel: e.target.value === 'auto' ? 'auto' : parseInt(e.target.value),
                              },
                            }))
                          }
                          className="w-full px-3 py-2 bg-[#0B0F1A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-xs text-slate-200 outline-none"
                        >
                          <option value="auto">Auto (Best Interference Avoidance)</option>
                          <option value="1">Channel 1 (2.412 GHz)</option>
                          <option value="6">Channel 6 (2.437 GHz - Recommended)</option>
                          <option value="11">Channel 11 (2.462 GHz)</option>
                        </select>
                      </div>
                    )}

                    {supports('channel_width') && (
                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1">
                          Channel Bandwidth
                        </label>
                        <select
                          value={wirelessConfig.band24.channelWidth}
                          onChange={(e) =>
                            setWirelessConfig((prev) => ({
                              ...prev,
                              band24: {
                                ...prev.band24!,
                                channelWidth: e.target.value as any,
                              },
                            }))
                          }
                          className="w-full px-3 py-2 bg-[#0B0F1A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-xs text-slate-200 outline-none"
                        >
                          <option value="20MHz">20 MHz (Cleanest / Compatible)</option>
                          <option value="40MHz">40 MHz (Higher Throughput)</option>
                        </select>
                      </div>
                    )}

                    {supports('hide_ssid') && (
                      <div className="flex items-center pt-5">
                        <label className="flex items-center space-x-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={wirelessConfig.band24.hidden}
                            onChange={(e) =>
                              setWirelessConfig((prev) => ({
                                ...prev,
                                band24: { ...prev.band24!, hidden: e.target.checked },
                              }))
                            }
                            className="rounded border-[#1F293D] text-cyan-600 focus:ring-0 cursor-pointer"
                          />
                          <span className="text-xs text-slate-300">
                            Hide SSID Broadcast (Stealth Network)
                          </span>
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 5.0 GHz Band Card */}
              {supports('wifi_5ghz') && wirelessConfig.band50 && (
                <div className="bg-[#0F1423] border border-[#1F293D] rounded-xl p-5 shadow-lg space-y-4">
                  <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
                    <div className="flex items-center space-x-2.5">
                      <div className="w-8 h-8 rounded-lg bg-emerald-950/70 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                        <Radio className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-slate-100">
                          5.0 GHz Wireless Settings
                        </h3>
                        <p className="text-[11px] text-slate-400">
                          High-speed, low-latency band for PC gaming, 4K streaming, and rapid downloads
                        </p>
                      </div>
                    </div>

                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={wirelessConfig.band50.enabled}
                        onChange={(e) =>
                          setWirelessConfig((prev) => ({
                            ...prev,
                            band50: { ...prev.band50!, enabled: e.target.checked },
                          }))
                        }
                        className="rounded border-[#1F293D] text-cyan-600 focus:ring-0 cursor-pointer"
                      />
                      <span className="text-xs font-semibold text-slate-300">Enable 5G</span>
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        5G Wi-Fi Name (SSID)
                      </label>
                      <input
                        type="text"
                        value={wirelessConfig.band50.ssid}
                        onChange={(e) =>
                          setWirelessConfig((prev) => ({
                            ...prev,
                            band50: { ...prev.band50!, ssid: e.target.value },
                          }))
                        }
                        placeholder="e.g. Home_Network_5G"
                        className="w-full px-3 py-2 bg-[#0B0F1A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-xs font-mono text-slate-200 outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-slate-300 block mb-1">
                        5G Password (WPA Key)
                      </label>
                      <div className="relative">
                        <input
                          type={showWifiPassword50 ? 'text' : 'password'}
                          value={wirelessConfig.band50.password}
                          onChange={(e) =>
                            setWirelessConfig((prev) => ({
                              ...prev,
                              band50: { ...prev.band50!, password: e.target.value },
                            }))
                          }
                          placeholder="At least 8 characters"
                          className="w-full px-3 py-2 pr-9 bg-[#0B0F1A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-xs font-mono text-slate-200 outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => setShowWifiPassword50(!showWifiPassword50)}
                          className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-200 cursor-pointer"
                        >
                          {showWifiPassword50 ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </div>

                    {supports('security_mode') && (
                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1">
                          Security Mode
                        </label>
                        <select
                          value={wirelessConfig.band50.securityMode}
                          onChange={(e) =>
                            setWirelessConfig((prev) => ({
                              ...prev,
                              band50: {
                                ...prev.band50!,
                                securityMode: e.target.value as RouterSecurityMode,
                              },
                            }))
                          }
                          className="w-full px-3 py-2 bg-[#0B0F1A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-xs text-slate-200 outline-none"
                        >
                          {currentAdapter.supportedSecurityModes.map((mode) => (
                            <option key={mode} value={mode}>
                              {mode}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    {supports('channel_selection') && (
                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1">
                          5G Wireless Channel
                        </label>
                        <select
                          value={wirelessConfig.band50.channel}
                          onChange={(e) =>
                            setWirelessConfig((prev) => ({
                              ...prev,
                              band50: {
                                ...prev.band50!,
                                channel: e.target.value === 'auto' ? 'auto' : parseInt(e.target.value),
                              },
                            }))
                          }
                          className="w-full px-3 py-2 bg-[#0B0F1A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-xs text-slate-200 outline-none"
                        >
                          <option value="auto">Auto (DFS Cleared)</option>
                          <option value="36">Channel 36 (5.180 GHz)</option>
                          <option value="40">Channel 40 (5.200 GHz)</option>
                          <option value="44">Channel 44 (5.220 GHz)</option>
                          <option value="48">Channel 48 (5.240 GHz)</option>
                          <option value="149">Channel 149 (5.745 GHz)</option>
                          <option value="157">Channel 157 (5.785 GHz)</option>
                        </select>
                      </div>
                    )}

                    {supports('channel_width') && (
                      <div>
                        <label className="text-xs font-semibold text-slate-300 block mb-1">
                          Channel Bandwidth
                        </label>
                        <select
                          value={wirelessConfig.band50.channelWidth}
                          onChange={(e) =>
                            setWirelessConfig((prev) => ({
                              ...prev,
                              band50: {
                                ...prev.band50!,
                                channelWidth: e.target.value as any,
                              },
                            }))
                          }
                          className="w-full px-3 py-2 bg-[#0B0F1A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-xs text-slate-200 outline-none"
                        >
                          <option value="40MHz">40 MHz</option>
                          <option value="80MHz">80 MHz (Wi-Fi 5/6 Standard)</option>
                          <option value="160MHz">160 MHz (Ultra High Speed Wi-Fi 6/6E)</option>
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: GUEST WI-FI NETWORK */}
          {activeTab === 'guest' && supports('guest_network') && wirelessConfig.guestNetwork && (
            <div className="bg-[#0F1423] border border-[#1F293D] rounded-xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-purple-950/70 border border-purple-500/30 flex items-center justify-center text-purple-400">
                    <Wifi className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">Guest Wireless Isolation</h3>
                    <p className="text-[11px] text-slate-400">
                      Isolated subnet preventing guest devices from accessing your local PCs, NAS, and printers
                    </p>
                  </div>
                </div>

                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={wirelessConfig.guestNetwork.enabled}
                    onChange={(e) =>
                      setWirelessConfig((prev) => ({
                        ...prev,
                        guestNetwork: {
                          ...prev.guestNetwork!,
                          enabled: e.target.checked,
                        },
                      }))
                    }
                    className="rounded border-[#1F293D] text-cyan-600 focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs font-semibold text-slate-300">Enable Guest Wi-Fi</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Guest SSID Name
                  </label>
                  <input
                    type="text"
                    value={wirelessConfig.guestNetwork.ssid}
                    onChange={(e) =>
                      setWirelessConfig((prev) => ({
                        ...prev,
                        guestNetwork: {
                          ...prev.guestNetwork!,
                          ssid: e.target.value,
                        },
                      }))
                    }
                    placeholder="e.g. Guest_WiFi"
                    className="w-full px-3 py-2 bg-[#0B0F1A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-xs font-mono text-slate-200 outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Guest Password
                  </label>
                  <input
                    type="password"
                    value={wirelessConfig.guestNetwork.password}
                    onChange={(e) =>
                      setWirelessConfig((prev) => ({
                        ...prev,
                        guestNetwork: {
                          ...prev.guestNetwork!,
                          password: e.target.value,
                        },
                      }))
                    }
                    placeholder="Guest Wi-Fi Password"
                    className="w-full px-3 py-2 bg-[#0B0F1A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-xs font-mono text-slate-200 outline-none"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center pt-2">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={wirelessConfig.guestNetwork.isolateClients}
                      onChange={(e) =>
                        setWirelessConfig((prev) => ({
                          ...prev,
                          guestNetwork: {
                            ...prev.guestNetwork!,
                            isolateClients: e.target.checked,
                          },
                        }))
                      }
                      className="rounded border-[#1F293D] text-cyan-600 focus:ring-0 cursor-pointer"
                    />
                    <span className="text-xs text-slate-300">
                      Client Isolation (Block guests from communicating with each other)
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: POWERSHELL & DIRECT SCRIPT BRIDGE */}
          {activeTab === 'direct' && (
            <div className="bg-[#0F1423] border border-[#1F293D] rounded-xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-cyan-950/70 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                    <Terminal className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">
                      Direct PowerShell Execution & Script Export
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Bypasses browser Private Network Access limitations by executing directly on the Windows host
                    </p>
                  </div>
                </div>

                <button
                  onClick={handleExportScript}
                  className="px-3 py-1.5 bg-[#161B2A] hover:bg-[#1E293B] text-slate-200 hover:text-white border border-[#1F293D] rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Download .ps1</span>
                </button>
              </div>

              <div className="space-y-3">
                <p className="text-xs text-slate-300 leading-relaxed">
                  The generated script uses the native API for your <strong>{deviceInfo.brandName}</strong> router (
                  <code className="text-cyan-400 font-mono text-[11px]">{deviceInfo.managementProtocol}</code>
                  ) to apply the current Wi-Fi configuration and reload the radio daemon.
                </p>

                <div className="bg-[#080B12] p-4 rounded-xl border border-[#1F293D] font-mono text-xs text-slate-300 max-h-64 overflow-y-auto select-all">
                  <pre className="whitespace-pre-wrap">
                    {
                      currentAdapter.generateDirectScript(
                        `${deviceInfo.protocol}://${deviceInfo.gatewayIp}:${deviceInfo.port}`,
                        credentials,
                        wirelessConfig
                      ).powershell
                    }
                  </pre>
                </div>

                {onExecuteScriptInTerminal && (
                  <div className="pt-2">
                    <button
                      onClick={handleExecuteInTerminal}
                      className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-2 shadow-sm"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                      <span>Execute Script in PowerShell Terminal Console</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Bar: Apply Changes & Run Live Verification */}
          <div className="bg-[#0F1423] border border-[#1F293D] rounded-xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center space-x-2 text-xs text-slate-400">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>
                Target: <strong className="text-slate-200">{deviceInfo.brandName}</strong> (
                <code className="text-cyan-400 font-mono">{deviceInfo.gatewayIp}</code>)
              </span>
            </div>

            <div className="flex items-center space-x-3">
              <button
                id="btn-apply-and-verify-router"
                onClick={handleApplyAndVerify}
                disabled={isApplying || isVerifying}
                className="px-5 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer shadow-md shadow-emerald-950/40 flex items-center space-x-2 disabled:opacity-50"
              >
                {isApplying || isVerifying ? (
                  <>
                    <Activity className="w-3.5 h-3.5 animate-spin" />
                    <span>{isVerifying ? 'Verifying on Router...' : 'Committing Changes...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Apply Settings & Verify Router State</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Verification Audit Result Card */}
          {verificationResult && (
            <div
              className={`rounded-xl p-5 border shadow-xl space-y-4 ${
                verificationResult.success
                  ? 'bg-[#0A1F18] border-emerald-500/40'
                  : 'bg-[#1C1215] border-rose-500/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  {verificationResult.success ? (
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center border border-emerald-500/40">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center border border-rose-500/40">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-bold text-slate-100">
                      {verificationResult.success
                        ? 'Router Verification Confirmed'
                        : 'Verification Audit Completed with Notes'}
                    </h3>
                    <p className="text-[11px] text-slate-400">
                      Audit Timestamp: {verificationResult.timestamp} &bull; Target:{' '}
                      {deviceInfo.brandName} ({deviceInfo.gatewayIp})
                    </p>
                  </div>
                </div>

                <span
                  className={`text-[11px] px-2.5 py-1 rounded-full font-bold uppercase ${
                    verificationResult.success
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {verificationResult.success ? 'Verified' : 'Review Needed'}
                </span>
              </div>

              <p className="text-xs text-slate-300">{verificationResult.message}</p>

              {/* Verified Fields Table */}
              {verificationResult.verifiedFields.length > 0 && (
                <div className="bg-[#080B12] rounded-lg border border-[#1F293D] overflow-hidden">
                  <div className="px-3 py-2 bg-[#0F1423] border-b border-[#1F293D] grid grid-cols-12 text-[11px] font-semibold text-slate-400">
                    <span className="col-span-5">Configuration Setting</span>
                    <span className="col-span-3">Applied Value</span>
                    <span className="col-span-3">Router Reported Value</span>
                    <span className="col-span-1 text-center">Status</span>
                  </div>

                  <div className="divide-y divide-[#1F293D] text-xs font-mono">
                    {verificationResult.verifiedFields.map((field, idx) => (
                      <div
                        key={idx}
                        className="px-3 py-2 grid grid-cols-12 items-center text-slate-300"
                      >
                        <span className="col-span-5 font-sans font-medium text-slate-200">
                          {field.displayName}
                        </span>
                        <span className="col-span-3 text-cyan-300 truncate">
                          {String(field.expected)}
                        </span>
                        <span className="col-span-3 text-emerald-300 truncate">
                          {String(field.actual)}
                        </span>
                        <span className="col-span-1 flex justify-center">
                          {field.matched ? (
                            <Check className="w-4 h-4 text-emerald-400" />
                          ) : (
                            <X className="w-4 h-4 text-rose-400" />
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
