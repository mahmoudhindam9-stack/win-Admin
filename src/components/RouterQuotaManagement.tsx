import React, { useState, useEffect, useRef } from 'react';
import {
  RouterQuotaManager,
} from '../services/router/quotaEngine';
import {
  RouterQuotaDatabase,
  ConnectedIPQuota,
  QuotaHistoricalRecord,
} from '../services/router/quotaTypes';
import {
  Gauge,
  RotateCcw,
  AlertTriangle,
  ShieldAlert,
  ShieldCheck,
  Calendar,
  Clock,
  HardDrive,
  Wifi,
  Laptop,
  Smartphone,
  Tv,
  Tablet,
  CheckCircle2,
  XCircle,
  Edit3,
  Sliders,
  History,
  Info,
  TrendingUp,
  DownloadCloud,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  PlusCircle,
  Trash2,
  Activity,
  Globe,
} from 'lucide-react';

interface RouterQuotaManagementProps {
  onNavigateToGuest?: () => void;
  onNavigateToParental?: (targetIp?: string) => void;
  routerConnectionStatus?: string;
  routerDeviceInfo?: any;
  sessionToken?: string;
  onConnectRouter?: () => void;
  onRefreshRouterDevices?: () => Promise<any>;
}

export function RouterQuotaManagement({
  onNavigateToGuest,
  onNavigateToParental,
  routerConnectionStatus = 'disconnected',
  routerDeviceInfo,
  sessionToken,
  onConnectRouter,
  onRefreshRouterDevices,
}: RouterQuotaManagementProps) {
  const manager = RouterQuotaManager.getInstance();
  const [db, setDb] = useState<RouterQuotaDatabase>(manager.getSnapshot());

  // Local editing states
  const [isEditingConfig, setIsEditingConfig] = useState(false);
  const [editTotalQuotaGB, setEditTotalQuotaGB] = useState<number>(db.config.totalQuotaGB);
  const [editValidityDays, setEditValidityDays] = useState<number>(db.config.validityPeriodDays);
  const [editWarn80, setEditWarn80] = useState<boolean>(db.config.warningThresholds.warn80);
  const [editAlert90, setEditAlert90] = useState<boolean>(db.config.warningThresholds.alert90);
  const [editLimit100, setEditLimit100] = useState<boolean>(db.config.warningThresholds.limit100);
  const [editAutoEnforce, setEditAutoEnforce] = useState<boolean>(db.config.autoEnforceRestriction);

  // Manual Reset Confirmation Modal
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetNotes, setResetNotes] = useState('');
  const [resetSuccessMessage, setResetSuccessMessage] = useState<string | null>(null);

  // Individual IP Quota Edit Modal
  const [editingDevice, setEditingDevice] = useState<ConnectedIPQuota | null>(null);
  const [deviceQuotaInput, setDeviceQuotaInput] = useState<string>('');

  // History expansion
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<QuotaHistoricalRecord | null>(null);

  // Guest Wi-Fi edit state
  const [isEditingGuestQuota, setIsEditingGuestQuota] = useState(false);
  const [guestQuotaInput, setGuestQuotaInput] = useState<number>(db.guestWifi.quotaLimitGB);

  // Real-time network sync rate
  const [currentBwSpeed, setCurrentBwSpeed] = useState<{ rxSec: number; txSec: number }>({ rxSec: 0, txSec: 0 });
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<string>('Just now');

  // Real device discovery & live synchronization states
  const [isScanningDevices, setIsScanningDevices] = useState(false);
  const [deviceSyncFeedback, setDeviceSyncFeedback] = useState<string | null>(null);

  // Manual Real IP Add Modal
  const [isAddIpModalOpen, setIsAddIpModalOpen] = useState(false);
  const [manualIp, setManualIp] = useState('');
  const [manualHostname, setManualHostname] = useState('');
  const [manualMac, setManualMac] = useState('');
  const [manualQuotaGB, setManualQuotaGB] = useState('');
  const [manualConnectionType, setManualConnectionType] = useState<'Ethernet' | '5.0GHz' | '2.4GHz'>('5.0GHz');
  const [addIpError, setAddIpError] = useState<string | null>(null);

  // Subscribe to quota manager updates
  useEffect(() => {
    const unsubscribe = manager.subscribe((newDb) => {
      setDb(newDb);
    });
    return () => unsubscribe();
  }, [manager]);

  // Real network traffic background poller
  useEffect(() => {
    let isMounted = true;

    async function pollNetwork() {
      try {
        if ((window as any).electronAPI?.routerApi) {
          const res = await (window as any).electronAPI.routerApi('getNetworkTraffic');
          if (res && res.success && isMounted) {
            manager.syncRealTraffic(res.totalRxBytes || 0, res.totalTxBytes || 0);
            setCurrentBwSpeed({ rxSec: res.rxSec || 0, txSec: res.txSec || 0 });
            setLastSyncTime(new Date().toLocaleTimeString());
          }
        } else {
          // In Vite dev/preview mode, fetch from /api/router/quota/traffic
          const res = await fetch('/api/router/quota/traffic')
            .then((r) => r.json())
            .catch(() => null);
          if (res && res.success && isMounted) {
            manager.syncRealTraffic(res.totalRxBytes || 0, res.totalTxBytes || 0);
            setCurrentBwSpeed({ rxSec: res.rxSec || 0, txSec: res.txSec || 0 });
            setLastSyncTime(new Date().toLocaleTimeString());
          }
        }
      } catch (err) {
        // silent catch
      }
    }

    pollNetwork();
    const interval = setInterval(pollNetwork, 4000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [manager]);

  // Scan Real Network Devices
  const handleScanRealDevices = async () => {
    setIsScanningDevices(true);
    setDeviceSyncFeedback(null);
    try {
      let foundDevices: any[] = [];
      if (onRefreshRouterDevices) {
        foundDevices = await onRefreshRouterDevices();
      } else if ((window as any).electronAPI?.routerApi) {
        const res = await (window as any).electronAPI.routerApi('getConnectedDevices');
        if (res && res.success && Array.isArray(res.devices)) {
          foundDevices = res.devices;
        }
      } else {
        const res = await fetch('/api/router/quota/devices')
          .then((r) => r.json())
          .catch(() => null);
        if (res && res.success && Array.isArray(res.devices)) {
          foundDevices = res.devices;
        }
      }

      if (Array.isArray(foundDevices) && foundDevices.length > 0) {
        manager.syncRealDevices(foundDevices, { replaceAll: true, source: 'network_scan' });
        setDeviceSyncFeedback(`Synchronized ${foundDevices.length} live network device(s) into quota monitoring.`);
      } else {
        // Keep list clean
        manager.syncRealDevices([], { replaceAll: true, source: 'network_scan' });
        setDeviceSyncFeedback('ARP network scan complete: 0 active host leases found on current subnet.');
      }
    } catch (e: any) {
      setDeviceSyncFeedback(`Discovery note: ${e.message || String(e)}`);
    } finally {
      setIsScanningDevices(false);
    }
  };

  // Permanently clear default mock data
  const handleWipeAllMockData = () => {
    if (confirm('Clear all listed network devices from this view?')) {
      manager.clearAllMockData();
      manager.clearAllDevices();
      setDeviceSyncFeedback('All device data cleared. Ready for live router connection.');
    }
  };

  // Add Real IP Manually
  const handleAddManualDevice = (e: React.FormEvent) => {
    e.preventDefault();
    setAddIpError(null);
    const ipTrimmed = manualIp.trim();
    const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

    if (!ipRegex.test(ipTrimmed)) {
      setAddIpError('Please enter a valid IPv4 address (e.g. 192.168.1.105)');
      return;
    }

    const quotaNum = manualQuotaGB.trim() ? parseFloat(manualQuotaGB) : null;
    if (quotaNum !== null && (isNaN(quotaNum) || quotaNum <= 0)) {
      setAddIpError('Quota limit must be a positive number in GB or left empty for uncapped');
      return;
    }

    manager.addManualDevice({
      ip: ipTrimmed,
      hostname: manualHostname.trim() || undefined,
      mac: manualMac.trim() || undefined,
      quotaLimitGB: quotaNum,
      connectionType: manualConnectionType,
    });

    setIsAddIpModalOpen(false);
    setManualIp('');
    setManualHostname('');
    setManualMac('');
    setManualQuotaGB('');
    setDeviceSyncFeedback(`Added device ${ipTrimmed} to real quota monitoring.`);
  };

  // Handle saving modified quota configuration
  const handleSaveConfig = () => {
    const parsedTotal = Number(editTotalQuotaGB);
    const parsedDays = Number(editValidityDays);

    if (isNaN(parsedTotal) || parsedTotal <= 0) {
      alert('Please enter a valid total quota amount greater than 0 GB.');
      return;
    }
    if (isNaN(parsedDays) || parsedDays <= 0) {
      alert('Please enter a valid validity period of at least 1 day.');
      return;
    }

    manager.updateQuotaConfig(
      parsedTotal,
      parsedDays,
      { warn80: editWarn80, alert90: editAlert90, limit100: editLimit100 },
      editAutoEnforce
    );
    setIsEditingConfig(false);
  };

  // Handle Manual Quota Reset
  const handleExecuteReset = () => {
    const record = manager.manualResetQuota(resetNotes || undefined);
    setIsResetModalOpen(false);
    setResetNotes('');
    setResetSuccessMessage(
      `Quota successfully reset! Cycle #${record.cycleNumber} archived to history. A fresh ${db.config.validityPeriodDays}-day quota cycle has started.`
    );
    setTimeout(() => {
      setResetSuccessMessage(null);
    }, 6000);
  };

  // Handle Individual IP Quota save
  const handleSaveDeviceQuota = () => {
    if (!editingDevice) return;
    const trimmed = deviceQuotaInput.trim();
    if (trimmed === '' || trimmed === '0' || trimmed.toLowerCase() === 'unlimited') {
      manager.setDeviceQuota(editingDevice.ip, null);
    } else {
      const num = parseFloat(trimmed);
      if (isNaN(num) || num <= 0) {
        alert('Please enter a valid positive number for the GB limit.');
        return;
      }
      manager.setDeviceQuota(editingDevice.ip, num);
    }
    setEditingDevice(null);
  };

  // Handle Guest Quota save
  const handleSaveGuestQuota = () => {
    if (guestQuotaInput <= 0) {
      alert('Guest quota must be greater than 0 GB.');
      return;
    }
    manager.updateGuestWifiConfig(guestQuotaInput);
    setIsEditingGuestQuota(false);
  };

  // Calculate days remaining
  const expDate = new Date(db.activeCycle.expirationDate);
  const startDate = new Date(db.activeCycle.startDate);
  const now = new Date();
  const msRemaining = expDate.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.ceil(msRemaining / (1000 * 60 * 60 * 24)));
  const isPeriodExpired = now.getTime() > expDate.getTime();

  // Progress bar styling based on percentage
  const usagePercent = db.activeCycle.usagePercent;
  let progressColor = 'bg-cyan-500';
  let badgeColor = 'bg-cyan-950/60 text-cyan-400 border-cyan-800/60';
  if (usagePercent >= 100) {
    progressColor = 'bg-rose-500';
    badgeColor = 'bg-rose-950/70 text-rose-300 border-rose-700/60';
  } else if (usagePercent >= 90) {
    progressColor = 'bg-amber-500';
    badgeColor = 'bg-amber-950/70 text-amber-300 border-amber-700/60';
  } else if (usagePercent >= 80) {
    progressColor = 'bg-yellow-500';
    badgeColor = 'bg-yellow-950/70 text-yellow-300 border-yellow-700/60';
  }

  // Device icon helper
  const getDeviceIcon = (hostname: string, type: string) => {
    const lower = hostname.toLowerCase();
    if (lower.includes('phone') || lower.includes('galaxy') || lower.includes('iphone')) {
      return <Smartphone className="w-4 h-4 text-emerald-400" />;
    }
    if (lower.includes('tv')) {
      return <Tv className="w-4 h-4 text-purple-400" />;
    }
    if (lower.includes('pad') || lower.includes('tablet')) {
      return <Tablet className="w-4 h-4 text-blue-400" />;
    }
    return <Laptop className="w-4 h-4 text-cyan-400" />;
  };

  return (
    <div className="space-y-6">
      {/* 1. STATUS & ENFORCEMENT NOTIFICATION BANNERS */}
      {resetSuccessMessage && (
        <div className="bg-emerald-950/70 border border-emerald-500/50 rounded-xl p-4 flex items-center space-x-3 text-emerald-200 animate-in fade-in slide-in-from-top-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
          <div className="text-xs font-medium">{resetSuccessMessage}</div>
        </div>
      )}

      {/* Critical Quota Exhaustion & Restriction Banner */}
      {db.internetRestricted && (
        <div className="bg-rose-950/80 border-2 border-rose-500 rounded-xl p-4 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className="w-9 h-9 rounded-lg bg-rose-900/80 border border-rose-500/50 flex items-center justify-center text-rose-300 flex-shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-bold text-white tracking-wide">
                  INTERNET ACCESS RESTRICTED &bull; QUOTA EXHAUSTED (100%)
                </h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500 text-white uppercase">
                  Enforced
                </span>
              </div>
              <p className="text-xs text-rose-200/90 mt-1">
                Active usage has reached {db.activeCycle.usedDataGB.toFixed(2)} GB of your{' '}
                {db.activeCycle.totalQuotaGB} GB allowance. Internet traffic is restricted per policy.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              onClick={() => setIsResetModalOpen(true)}
              className="flex-1 sm:flex-initial px-3.5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold flex items-center justify-center space-x-1.5 shadow-md cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Quota Now</span>
            </button>
            <button
              onClick={() => {
                manager.updateQuotaConfig(db.activeCycle.totalQuotaGB + 50);
              }}
              className="flex-1 sm:flex-initial px-3 py-2 bg-[#161B2A] hover:bg-[#1F293D] border border-rose-500/40 text-rose-200 rounded-lg text-xs font-semibold flex items-center justify-center space-x-1 cursor-pointer transition-colors"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+50 GB Add-on</span>
            </button>
          </div>
        </div>
      )}

      {/* Cycle Period Expired Banner (DO NOT AUTO RESET - AWAITING MANUAL RESET) */}
      {isPeriodExpired && !db.internetRestricted && (
        <div className="bg-amber-950/60 border border-amber-500/50 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-start space-x-3">
            <Clock className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-bold text-amber-200 uppercase tracking-wider flex items-center space-x-2">
                <span>Cycle Period Complete ({db.activeCycle.validityPeriodDays} Days Passed)</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] bg-amber-900/80 text-amber-300 font-bold">
                  Manual Reset Required
                </span>
              </div>
              <p className="text-xs text-amber-200/80 mt-0.5">
                The configured validity period has ended. In accordance with policy, the quota is{' '}
                <strong>never reset automatically</strong>. Usage continues to be tracked until you explicitly
                click &ldquo;Reset Quota&rdquo;.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsResetModalOpen(true)}
            className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-black font-bold rounded-lg text-xs flex items-center space-x-1.5 cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Quota</span>
          </button>
        </div>
      )}

      {/* 2. MAIN ROUTER ADMIN QUOTA EXECUTIVE DASHBOARD */}
      <div className="bg-[#0F1423] border border-[#1F293D] rounded-xl p-5 shadow-lg space-y-5">
        {/* Header with Title, Mode Badges & Action Buttons */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-[#1F293D] pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-inner">
              <Gauge className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2 flex-wrap">
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                  Router Administration Quota
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                  Cycle #{db.activeCycle.cycleNumber}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  Manual Reset Only
                </span>
                {routerConnectionStatus === 'connected' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-700 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span>Router Admin Connected ({routerDeviceInfo?.brandName || 'Live'})</span>
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700 flex items-center space-x-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-500"></span>
                    <span>Router Admin Disconnected</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Central ISP/WAN data quota monitoring, automated limit warnings, and real network bandwidth tracking
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsEditingConfig(!isEditingConfig)}
              className="px-3 py-1.5 bg-[#161B2A] hover:bg-[#1F293D] border border-[#1F293D] text-slate-200 hover:text-white rounded-lg text-xs font-semibold flex items-center space-x-1.5 cursor-pointer transition-colors"
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400" />
              <span>{isEditingConfig ? 'Close Settings' : 'Configure Quota'}</span>
            </button>

            <button
              onClick={() => setIsResetModalOpen(true)}
              className="px-4 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-md hover:shadow-cyan-500/20 cursor-pointer transition-all"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Quota</span>
            </button>
          </div>
        </div>

        {/* Live Network Bandwidth Telemetry Bar */}
        <div className="flex items-center justify-between text-xs px-3 py-2 bg-[#0B0F1A] border border-[#1F293D] rounded-lg text-slate-400">
          <div className="flex items-center space-x-2">
            <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-slate-300 font-medium">Real-time Interface Traffic:</span>
            <span className="font-mono text-cyan-400 font-semibold">
              &darr; {(currentBwSpeed.rxSec / 1024).toFixed(1)} KB/s
            </span>
            <span className="font-mono text-blue-400 font-semibold">
              &uarr; {(currentBwSpeed.txSec / 1024).toFixed(1)} KB/s
            </span>
          </div>
          <div className="flex items-center space-x-2 text-[11px]">
            <span>Last Sync: {lastSyncTime}</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
          </div>
        </div>

        {/* Quota Progress Visualization */}
        <div className="space-y-2">
          <div className="flex items-end justify-between">
            <div>
              <span className="text-2xl font-extrabold text-white font-mono">
                {db.activeCycle.usedDataGB.toFixed(2)}
              </span>
              <span className="text-xs text-slate-400 ml-1.5 font-medium">
                GB used of{' '}
                <strong className="text-slate-200 font-mono">{db.activeCycle.totalQuotaGB} GB</strong>
              </span>
            </div>

            <div className="flex items-center space-x-3 text-right">
              <div>
                <span className="text-xs text-slate-400 block">Remaining</span>
                <span className="text-base font-bold font-mono text-cyan-400">
                  {db.activeCycle.remainingDataGB.toFixed(2)} GB
                </span>
              </div>
              <div className={`px-2.5 py-1 rounded-lg border font-mono font-bold text-xs ${badgeColor}`}>
                {usagePercent.toFixed(1)}%
              </div>
            </div>
          </div>

          {/* Progress Bar with 80% and 90% Markers */}
          <div className="relative w-full h-3.5 bg-[#0B0F1A] rounded-full overflow-hidden border border-[#1F293D]">
            <div
              className={`h-full ${progressColor} transition-all duration-500 rounded-full`}
              style={{ width: `${Math.min(100, Math.max(0, usagePercent))}%` }}
            ></div>

            {/* Threshold Indicators */}
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-yellow-400/80"
              style={{ left: '80%' }}
              title="80% Warning Threshold"
            ></div>
            <div
              className="absolute top-0 bottom-0 w-0.5 bg-amber-500/90"
              style={{ left: '90%' }}
              title="90% Alert Threshold"
            ></div>
          </div>

          <div className="flex items-center justify-between text-[11px] text-slate-400 px-0.5">
            <span>0 GB</span>
            <span className="text-yellow-400/80">80% (Warn)</span>
            <span className="text-amber-400/80">90% (Alert)</span>
            <span>{db.activeCycle.totalQuotaGB} GB (100% Limit)</span>
          </div>
        </div>

        {/* Quota Cycle Schedule & Details Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          {/* Card 1: Quota Start Date */}
          <div className="bg-[#0B0F1A] border border-[#1F293D] rounded-lg p-3">
            <div className="flex items-center space-x-1.5 text-slate-400 text-[11px] mb-1">
              <Calendar className="w-3.5 h-3.5 text-cyan-400" />
              <span>Quota Start Date</span>
            </div>
            <div className="text-xs font-semibold text-slate-200 font-mono">
              {startDate.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
              {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>

          {/* Card 2: Quota Expiration Date */}
          <div className="bg-[#0B0F1A] border border-[#1F293D] rounded-lg p-3">
            <div className="flex items-center space-x-1.5 text-slate-400 text-[11px] mb-1">
              <Clock className="w-3.5 h-3.5 text-cyan-400" />
              <span>Expiration Date</span>
            </div>
            <div className="text-xs font-semibold text-slate-200 font-mono">
              {expDate.toLocaleDateString(undefined, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
              })}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Validity: {db.activeCycle.validityPeriodDays} days
            </div>
          </div>

          {/* Card 3: Days Remaining */}
          <div className="bg-[#0B0F1A] border border-[#1F293D] rounded-lg p-3">
            <div className="flex items-center space-x-1.5 text-slate-400 text-[11px] mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
              <span>Days Remaining</span>
            </div>
            <div
              className={`text-xs font-bold font-mono ${
                isPeriodExpired ? 'text-amber-400' : 'text-slate-100'
              }`}
            >
              {isPeriodExpired ? '0 Days (Expired)' : `${daysRemaining} Days Left`}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {isPeriodExpired ? 'Awaiting Reset' : 'Active billing period'}
            </div>
          </div>

          {/* Card 4: Policy Mode */}
          <div className="bg-[#0B0F1A] border border-[#1F293D] rounded-lg p-3">
            <div className="flex items-center space-x-1.5 text-slate-400 text-[11px] mb-1">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Reset Policy</span>
            </div>
            <div className="text-xs font-bold text-cyan-400 font-mono">Manual Reset Only</div>
            <div className="text-[10px] text-slate-400 mt-0.5">Never resets automatically</div>
          </div>
        </div>

        {/* 2B. INLINE CONFIGURATION PANEL (Admin can change quota amount at any time) */}
        {isEditingConfig && (
          <div className="bg-[#0B0F1A] border border-cyan-500/40 rounded-xl p-4 space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between border-b border-[#1F293D] pb-2">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Configure Quota Allowance & Validity Period
                </h4>
              </div>
              <span className="text-[11px] text-cyan-400">
                Upgrading or downgrading quota never erases current usage.
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Total Quota Input with Quick Presets */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Total Quota Amount (GB)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={editTotalQuotaGB}
                    onChange={(e) => setEditTotalQuotaGB(Number(e.target.value))}
                    className="flex-1 px-3 py-2 bg-[#161B2A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-xs font-mono text-slate-100 outline-none"
                    placeholder="e.g. 250"
                  />
                  <span className="text-xs text-slate-400 font-mono">GB</span>
                </div>

                {/* Fast presets */}
                <div className="flex items-center space-x-1.5 mt-2">
                  {[100, 200, 250, 500, 1000].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setEditTotalQuotaGB(preset)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                        editTotalQuotaGB === preset
                          ? 'bg-cyan-600 text-white font-bold'
                          : 'bg-[#161B2A] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {preset} GB
                    </button>
                  ))}
                </div>
              </div>

              {/* Validity Period with Presets */}
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  Quota Validity Period (Days)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={editValidityDays}
                    onChange={(e) => setEditValidityDays(Number(e.target.value))}
                    className="flex-1 px-3 py-2 bg-[#161B2A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-xs font-mono text-slate-100 outline-none"
                    placeholder="Default 30"
                  />
                  <span className="text-xs text-slate-400 font-mono">Days</span>
                </div>

                {/* Period presets */}
                <div className="flex items-center space-x-1.5 mt-2">
                  {[7, 14, 30, 60, 90].map((days) => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setEditValidityDays(days)}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono cursor-pointer transition-colors ${
                        editValidityDays === days
                          ? 'bg-cyan-600 text-white font-bold'
                          : 'bg-[#161B2A] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {days} {days === 30 ? '(Default)' : 'd'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Warning Thresholds & Enforcement Settings */}
            <div className="pt-2 border-t border-[#1F293D] grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-slate-300 block">
                  Automatic Notification Thresholds
                </span>
                <div className="flex items-center space-x-4 text-xs">
                  <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={editWarn80}
                      onChange={(e) => setEditWarn80(e.target.checked)}
                      className="rounded border-[#1F293D] text-cyan-600 focus:ring-0 cursor-pointer"
                    />
                    <span>Warn at 80%</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={editAlert90}
                      onChange={(e) => setEditAlert90(e.target.checked)}
                      className="rounded border-[#1F293D] text-cyan-600 focus:ring-0 cursor-pointer"
                    />
                    <span>Alert at 90%</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer text-slate-300">
                    <input
                      type="checkbox"
                      checked={editLimit100}
                      onChange={(e) => setEditLimit100(e.target.checked)}
                      className="rounded border-[#1F293D] text-cyan-600 focus:ring-0 cursor-pointer"
                    />
                    <span>Alert at 100%</span>
                  </label>
                </div>
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-300 block mb-1">
                  Enforcement Policy
                </span>
                <label className="flex items-center space-x-2 cursor-pointer text-xs text-slate-300">
                  <input
                    type="checkbox"
                    checked={editAutoEnforce}
                    onChange={(e) => setEditAutoEnforce(e.target.checked)}
                    className="rounded border-[#1F293D] text-rose-600 focus:ring-0 cursor-pointer"
                  />
                  <span>Enforce Internet Restriction when 100% Quota is Reached</span>
                </label>
              </div>
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setIsEditingConfig(false)}
                className="px-3 py-1.5 bg-[#161B2A] text-slate-300 hover:text-white rounded-lg text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveConfig}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-xs shadow cursor-pointer"
              >
                Apply Quota Settings
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 3. CONNECTED IP QUOTAS & GUEST WI-FI MANAGEMENT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left 8 Cols: Connected IP Quotas */}
        <div className="lg:col-span-8 bg-[#0F1423] border border-[#1F293D] rounded-xl p-5 shadow-lg space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[#1F293D] pb-3">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-950/80 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                <Laptop className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                  Connected IP Quotas
                </h3>
                <p className="text-[11px] text-slate-400">
                  Per-IP data allocation, real usage counters, and direct internet access blocking
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2 flex-wrap gap-y-1.5">
              <span className="text-[11px] text-slate-400 font-mono">
                {db.connectedDevices.length} Live Host{db.connectedDevices.length === 1 ? '' : 's'}
              </span>

              <button
                onClick={handleScanRealDevices}
                disabled={isScanningDevices}
                title="Perform live ARP network scan for active hosts"
                className="px-2.5 py-1 bg-[#161B2A] hover:bg-[#1F293D] border border-[#1F293D] text-slate-200 hover:text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 cursor-pointer transition-colors"
              >
                <RefreshCw className={`w-3 h-3 text-cyan-400 ${isScanningDevices ? 'animate-spin' : ''}`} />
                <span>{isScanningDevices ? 'Scanning...' : 'Scan Real Network'}</span>
              </button>

              <button
                onClick={() => setIsAddIpModalOpen(true)}
                title="Add real host IP manually"
                className="px-2.5 py-1 bg-cyan-950/60 hover:bg-cyan-900/60 border border-cyan-700/60 text-cyan-300 text-xs font-semibold rounded-lg flex items-center space-x-1.5 cursor-pointer transition-colors"
              >
                <PlusCircle className="w-3 h-3 text-cyan-400" />
                <span>Add Real IP</span>
              </button>

              {onNavigateToParental && (
                <button
                  onClick={() => onNavigateToParental()}
                  title="Open Parental Controls & Web Filtering Console"
                  className="px-2.5 py-1 bg-indigo-950/60 hover:bg-indigo-900/60 border border-indigo-700/60 text-indigo-300 text-xs font-semibold rounded-lg flex items-center space-x-1.5 cursor-pointer transition-colors"
                >
                  <Globe className="w-3 h-3 text-indigo-400" />
                  <span>Web Filtering</span>
                </button>
              )}

              {db.connectedDevices.length > 0 && (
                <button
                  onClick={handleWipeAllMockData}
                  title="Clear all devices from monitoring"
                  className="px-2 py-1 bg-[#161B2A] hover:bg-rose-950/40 border border-[#1F293D] text-slate-400 hover:text-rose-400 text-xs rounded-lg flex items-center space-x-1 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>
          </div>

          {/* Feedback message banner */}
          {deviceSyncFeedback && (
            <div className="bg-cyan-950/50 border border-cyan-800/60 rounded-lg p-2.5 flex items-center justify-between text-cyan-200 text-xs animate-in fade-in">
              <div className="flex items-center space-x-2">
                <Info className="w-4 h-4 text-cyan-400 shrink-0" />
                <span>{deviceSyncFeedback}</span>
              </div>
              <button
                onClick={() => setDeviceSyncFeedback(null)}
                className="text-cyan-400 hover:text-white cursor-pointer ml-2"
              >
                <XCircle className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* If 0 devices, show clean empty state prompting real router connect */}
          {db.connectedDevices.length === 0 ? (
            <div className="py-12 px-6 text-center bg-[#0B0F1A]/60 rounded-xl border border-dashed border-[#1F293D] space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <HardDrive className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-200">
                  Default Mock Data Cleared &bull; Live Network Ready
                </h4>
                <p className="text-xs text-slate-400 max-w-md mx-auto mt-1">
                  All placeholder and dummy devices have been purged. Connect and authenticate with your router admin page or run a local ARP network scan to import real live devices.
                </p>
              </div>
              <div className="flex items-center justify-center space-x-3 pt-2 flex-wrap gap-y-2">
                <button
                  onClick={handleScanRealDevices}
                  disabled={isScanningDevices}
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold rounded-lg flex items-center space-x-2 cursor-pointer shadow transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isScanningDevices ? 'animate-spin' : ''}`} />
                  <span>{isScanningDevices ? 'Scanning Network...' : 'Scan Real Network (ARP)'}</span>
                </button>

                {routerConnectionStatus !== 'connected' && onConnectRouter && (
                  <button
                    onClick={onConnectRouter}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center space-x-2 cursor-pointer shadow transition-colors"
                  >
                    <Wifi className="w-3.5 h-3.5" />
                    <span>Connect to Router Admin</span>
                  </button>
                )}

                <button
                  onClick={() => setIsAddIpModalOpen(true)}
                  className="px-3.5 py-2 bg-[#161B2A] hover:bg-[#1E293B] text-slate-300 hover:text-white border border-[#1F293D] text-xs font-semibold rounded-lg flex items-center space-x-1.5 cursor-pointer transition-colors"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Add IP Manually</span>
                </button>
              </div>
            </div>
          ) : (
            /* Connected IP Table */
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#1F293D] text-[11px] text-slate-400 uppercase tracking-wider">
                    <th className="pb-2 font-semibold">Device / Hostname</th>
                    <th className="pb-2 font-semibold">IP / MAC</th>
                    <th className="pb-2 font-semibold">Band</th>
                    <th className="pb-2 font-semibold">Used</th>
                    <th className="pb-2 font-semibold">Limit</th>
                    <th className="pb-2 font-semibold">Remaining</th>
                    <th className="pb-2 font-semibold">Access</th>
                    <th className="pb-2 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1F293D]/60 font-mono">
                  {db.connectedDevices.map((device) => {
                    const hasLimit = device.quotaLimitGB !== null && device.quotaLimitGB > 0;
                    const devPercent = device.usagePercent;
                    let devBarColor = 'bg-cyan-500';
                    if (devPercent >= 100) devBarColor = 'bg-rose-500';
                    else if (devPercent >= 90) devBarColor = 'bg-amber-500';

                    return (
                      <tr
                        key={device.id}
                        className={`hover:bg-[#141A2E] transition-colors ${
                          device.isBlocked ? 'bg-rose-950/20' : ''
                        }`}
                      >
                        {/* Device & Hostname */}
                        <td className="py-3 font-sans">
                          <div className="flex items-center space-x-2">
                            {getDeviceIcon(device.hostname, device.connectionType)}
                            <div>
                              <span className="text-xs font-bold text-slate-200 block">
                                {device.hostname}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">
                                {device.lastActive}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* IP & MAC */}
                        <td className="py-3 text-[11px]">
                          <span className="text-slate-200 font-semibold block">{device.ip}</span>
                          <span className="text-slate-400 text-[10px]">{device.mac}</span>
                        </td>

                        {/* Connection Type */}
                        <td className="py-3 text-[11px] font-sans">
                          <span className="px-1.5 py-0.5 rounded bg-[#161B2A] border border-[#1F293D] text-slate-300 text-[10px]">
                            {device.connectionType}
                          </span>
                        </td>

                        {/* Used Data */}
                        <td className="py-3 font-bold text-slate-200">
                          {device.usedDataGB.toFixed(2)} GB
                        </td>

                        {/* Quota Limit */}
                        <td className="py-3">
                          {hasLimit ? (
                            <span className="text-cyan-300 font-bold">{device.quotaLimitGB} GB</span>
                          ) : (
                            <span className="text-slate-400 text-[11px] font-sans italic">
                              Uncapped (Pool)
                            </span>
                          )}
                        </td>

                        {/* Remaining & Progress */}
                        <td className="py-3">
                          {hasLimit ? (
                            <div className="space-y-1">
                              <span
                                className={`text-[11px] font-bold ${
                                  device.isExhausted ? 'text-rose-400' : 'text-slate-200'
                                }`}
                              >
                                {device.remainingDataGB?.toFixed(2)} GB ({devPercent.toFixed(0)}%)
                              </span>
                              <div className="w-16 h-1.5 bg-[#0B0F1A] rounded-full overflow-hidden border border-[#1F293D]">
                                <div
                                  className={`h-full ${devBarColor}`}
                                  style={{ width: `${Math.min(100, devPercent)}%` }}
                                ></div>
                              </div>
                            </div>
                          ) : (
                            <span className="text-slate-400 text-[11px] font-sans">&mdash;</span>
                          )}
                        </td>

                        {/* Internet Access Status */}
                        <td className="py-3 font-sans">
                          {device.isBlocked ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800 flex items-center space-x-1 w-max">
                              <XCircle className="w-3 h-3" />
                              <span>Blocked</span>
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 flex items-center space-x-1 w-max">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Allowed</span>
                            </span>
                          )}
                        </td>

                        {/* Action Buttons */}
                        <td className="py-3 text-right font-sans">
                          <div className="flex items-center justify-end space-x-1">
                            {/* Set/Edit Quota */}
                            <button
                              onClick={() => {
                                setEditingDevice(device);
                                setDeviceQuotaInput(
                                  device.quotaLimitGB ? String(device.quotaLimitGB) : ''
                                );
                              }}
                              title="Set or Edit Device Quota"
                              className="p-1.5 rounded-lg bg-[#161B2A] hover:bg-[#1F293D] text-slate-300 hover:text-cyan-400 border border-[#1F293D] cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            {/* Block/Unblock Internet */}
                            <button
                              onClick={() => manager.toggleDeviceBlock(device.ip)}
                              title={device.isBlocked ? 'Unblock Internet Access' : 'Block Internet Access'}
                              className={`p-1.5 rounded-lg border cursor-pointer transition-colors ${
                                device.isBlocked
                                  ? 'bg-rose-900/60 hover:bg-rose-800 border-rose-700 text-rose-200'
                                  : 'bg-[#161B2A] hover:bg-rose-950/40 border-[#1F293D] text-slate-400 hover:text-rose-400'
                              }`}
                            >
                              {device.isBlocked ? (
                                <ShieldCheck className="w-3.5 h-3.5" />
                              ) : (
                                <ShieldAlert className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* Quick Parental Filter rule */}
                            {onNavigateToParental && (
                              <button
                                onClick={() => onNavigateToParental(device.ip)}
                                title={`Configure Parental Controls / Web Filtering for ${device.ip}`}
                                className="p-1.5 rounded-lg bg-[#161B2A] hover:bg-indigo-950/50 border border-[#1F293D] text-slate-400 hover:text-indigo-400 cursor-pointer transition-colors"
                              >
                                <Globe className="w-3.5 h-3.5" />
                              </button>
                            )}

                            {/* Remove Device */}
                            <button
                              onClick={() => {
                                if (confirm(`Remove device ${device.ip} (${device.hostname}) from quota tracking?`)) {
                                  manager.removeDevice(device.ip);
                                  setDeviceSyncFeedback(`Removed ${device.ip} from quota monitoring.`);
                                }
                              }}
                              title="Remove device"
                              className="p-1.5 rounded-lg bg-[#161B2A] hover:bg-rose-950/40 border border-[#1F293D] text-slate-400 hover:text-rose-400 cursor-pointer transition-colors"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-[#1F293D]">
            <span>
              Connected IP usage resets only when the admin clicks &ldquo;Reset Quota&rdquo;.
            </span>
            <span className="font-mono text-cyan-400">
              Total Active: {db.connectedDevices.filter((d) => !d.isBlocked).length} devices allowed
            </span>
          </div>
        </div>

        {/* Right 4 Cols: Guest Wi-Fi Quota & Policy */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-[#0F1423] border border-[#1F293D] rounded-xl p-5 shadow-lg space-y-4">
            <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-purple-950/80 border border-purple-500/40 flex items-center justify-center text-purple-400">
                  <Wifi className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                    Guest Wi-Fi Quota
                  </h3>
                  <p className="text-[11px] text-slate-400">Independent guest bandwidth cap</p>
                </div>
              </div>

              <button
                onClick={() => setIsEditingGuestQuota(!isEditingGuestQuota)}
                className="p-1.5 rounded-lg bg-[#161B2A] hover:bg-[#1F293D] text-slate-300 hover:text-cyan-400 border border-[#1F293D] cursor-pointer"
                title="Edit Guest Wi-Fi Quota Limit"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Guest Quota Stats */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">SSID:</span>
                <span className="font-mono text-slate-200 font-bold">{db.guestWifi.ssid}</span>
              </div>

              <div className="flex items-end justify-between">
                <div>
                  <span className="text-xl font-bold text-white font-mono">
                    {db.guestWifi.usedDataGB.toFixed(2)}
                  </span>
                  <span className="text-xs text-slate-400 ml-1 font-medium">
                    / {db.guestWifi.quotaLimitGB} GB
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-xs font-bold text-purple-400 font-mono">
                    {db.guestWifi.remainingDataGB.toFixed(2)} GB Left
                  </span>
                </div>
              </div>

              {/* Guest Progress */}
              <div className="w-full h-2.5 bg-[#0B0F1A] rounded-full overflow-hidden border border-[#1F293D]">
                <div
                  className={`h-full ${
                    db.guestWifi.usagePercent >= 100
                      ? 'bg-rose-500'
                      : db.guestWifi.usagePercent >= 80
                      ? 'bg-amber-500'
                      : 'bg-purple-500'
                  }`}
                  style={{ width: `${Math.min(100, db.guestWifi.usagePercent)}%` }}
                ></div>
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-400">
                <span>Usage: {db.guestWifi.usagePercent.toFixed(1)}%</span>
                <span>
                  Status:{' '}
                  {db.guestWifi.isExhausted ? (
                    <strong className="text-rose-400">Exhausted (Restricted)</strong>
                  ) : (
                    <strong className="text-emerald-400">Active</strong>
                  )}
                </span>
              </div>
            </div>

            {/* Guest Quota Edit Form */}
            {isEditingGuestQuota && (
              <div className="bg-[#0B0F1A] border border-purple-500/40 rounded-lg p-3 space-y-2.5 animate-in fade-in">
                <label className="text-xs font-semibold text-slate-300 block">
                  Maximum Guest Quota (GB)
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={guestQuotaInput}
                    onChange={(e) => setGuestQuotaInput(Number(e.target.value))}
                    className="flex-1 px-3 py-1.5 bg-[#161B2A] border border-[#1F293D] rounded-lg text-xs font-mono text-slate-100 outline-none"
                  />
                  <button
                    onClick={handleSaveGuestQuota}
                    className="px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-lg text-xs cursor-pointer"
                  >
                    Save
                  </button>
                </div>
              </div>
            )}

            <div className="p-3 bg-[#0B0F1A] border border-[#1F293D] rounded-lg text-[11px] text-slate-400 space-y-1">
              <div className="flex items-center space-x-1.5 text-slate-300 font-semibold">
                <Info className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
                <span>Guest Wi-Fi Quota Policy:</span>
              </div>
              <p>
                Does not automatically reset when the period expires. Guest usage resets only when
                the admin manually clicks &ldquo;Reset Quota&rdquo;.
              </p>
            </div>
          </div>

          {/* Quick Historical Cycle Audit Drawer Card */}
          <div className="bg-[#0F1423] border border-[#1F293D] rounded-xl p-5 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <History className="w-4 h-4 text-cyan-400" />
                <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Cycle History ({db.history.length} Saved)
                </h4>
              </div>

              <button
                onClick={() => setShowHistory(!showHistory)}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 cursor-pointer"
              >
                <span>{showHistory ? 'Hide Records' : 'View Audit'}</span>
                {showHistory ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            </div>

            <p className="text-[11px] text-slate-400">
              All previous cycles are permanently archived whenever a manual quota reset is executed.
            </p>

            {/* Expandable History Table */}
            {showHistory && (
              <div className="space-y-2 pt-2 border-t border-[#1F293D]">
                {db.history.length === 0 ? (
                  <div className="text-xs text-slate-400 py-2 italic text-center">
                    No historical cycles archived yet. Previous cycles will appear here when you click Reset Quota.
                  </div>
                ) : (
                  db.history.map((record) => (
                    <div
                      key={record.cycleId}
                      onClick={() =>
                        setSelectedHistoryRecord(
                          selectedHistoryRecord?.cycleId === record.cycleId ? null : record
                        )
                      }
                      className="p-2.5 bg-[#0B0F1A] border border-[#1F293D] hover:border-cyan-500/50 rounded-lg cursor-pointer transition-all space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200 font-mono">
                          Cycle #{record.cycleNumber}
                        </span>
                        <span className="text-[11px] text-cyan-400 font-mono font-bold">
                          {record.finalUsedGB.toFixed(1)} GB / {record.totalQuotaGB} GB ({record.usagePercent.toFixed(1)}%)
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>
                          {new Date(record.startDate).toLocaleDateString()} &rarr;{' '}
                          {new Date(record.resetDate).toLocaleDateString()}
                        </span>
                        <span>{record.connectedDevicesCount} Devices</span>
                      </div>

                      {/* Detail drilldown */}
                      {selectedHistoryRecord?.cycleId === record.cycleId && (
                        <div className="pt-2 border-t border-[#1F293D] space-y-1 text-[11px] font-sans">
                          <div className="text-slate-300 font-semibold">Archived Device Usage:</div>
                          <div className="space-y-1 max-h-36 overflow-y-auto font-mono text-[10px]">
                            {record.deviceUsages.map((du, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between text-slate-400 py-0.5"
                              >
                                <span>{du.hostname || du.ip}</span>
                                <span className="text-slate-200 font-bold">{du.usedDataGB.toFixed(2)} GB</span>
                              </div>
                            ))}
                          </div>
                          {record.notes && (
                            <div className="text-[10px] text-slate-400 italic pt-1 border-t border-[#1F293D]">
                              Note: {record.notes}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MODAL 1: MANUAL QUOTA RESET CONFIRMATION */}
      {isResetModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0F1423] border border-cyan-500/50 rounded-2xl p-6 max-w-lg w-full shadow-2xl space-y-5">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-950/90 border border-cyan-500/50 flex items-center justify-center text-cyan-400 flex-shrink-0">
                <RotateCcw className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-wide">
                  Execute Manual Quota Reset
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Confirm starting a new quota cycle for the router and all connected clients.
                </p>
              </div>
            </div>

            {/* Reset Summary Box */}
            <div className="bg-[#0B0F1A] border border-[#1F293D] rounded-xl p-4 space-y-2.5 text-xs text-slate-300">
              <div className="font-semibold text-slate-200 flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                <span>Actions that will be executed:</span>
              </div>
              <ul className="list-disc list-inside space-y-1 text-slate-400 pl-1 text-[11px]">
                <li>
                  <strong>Reset router usage to 0.00 GB</strong> from current {db.activeCycle.usedDataGB.toFixed(2)} GB.
                </li>
                <li>
                  <strong>Start a new quota cycle (Cycle #{db.activeCycle.cycleNumber + 1})</strong> starting right now.
                </li>
                <li>
                  <strong>Archive all current cycle records and device breakdown</strong> to permanent history.
                </li>
                <li>
                  <strong>Recalculate expiration date</strong> for the next {db.config.validityPeriodDays} days.
                </li>
                <li>
                  <strong>Reset all connected IP usage counters</strong> to 0 GB while preserving their custom quota rules.
                </li>
                <li>
                  <strong>Reset Guest Wi-Fi usage</strong> to 0 GB while keeping configured limits.
                </li>
                <li>
                  <strong>Lift any active quota-exhausted internet restrictions</strong>.
                </li>
              </ul>
            </div>

            {/* Optional Reset Note */}
            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Admin Reset Note / Invoice Reference (Optional)
              </label>
              <input
                type="text"
                value={resetNotes}
                onChange={(e) => setResetNotes(e.target.value)}
                placeholder="e.g. Monthly refill paid & activated"
                className="w-full px-3 py-2 bg-[#0B0F1A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-xs text-slate-200 outline-none"
              />
            </div>

            {/* Modal Buttons */}
            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsResetModalOpen(false)}
                className="px-4 py-2 bg-[#161B2A] hover:bg-[#1F293D] text-slate-300 hover:text-white rounded-lg text-xs font-semibold cursor-pointer transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleExecuteReset}
                className="px-5 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-lg text-xs shadow-lg hover:shadow-cyan-500/30 flex items-center space-x-1.5 cursor-pointer transition-all"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Confirm & Reset Quota</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: SET / EDIT INDIVIDUAL IP QUOTA */}
      {editingDevice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#0F1423] border border-cyan-500/50 rounded-2xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-950/90 border border-cyan-500/50 flex items-center justify-center text-cyan-400 flex-shrink-0">
                <Laptop className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white tracking-wide">
                  Configure Device Quota Limit
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Set, modify, or remove the individual data allowance for this IP.
                </p>
              </div>
            </div>

            <div className="bg-[#0B0F1A] border border-[#1F293D] rounded-xl p-3 text-xs space-y-1.5 font-mono">
              <div className="flex justify-between text-slate-300">
                <span className="font-sans text-slate-400">Hostname:</span>
                <span className="font-bold">{editingDevice.hostname}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="font-sans text-slate-400">IP Address:</span>
                <span>{editingDevice.ip}</span>
              </div>
              <div className="flex justify-between text-slate-300">
                <span className="font-sans text-slate-400">Current Used:</span>
                <span>{editingDevice.usedDataGB.toFixed(2)} GB</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-slate-300 block mb-1">
                Data Quota Limit (GB)
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  value={deviceQuotaInput}
                  onChange={(e) => setDeviceQuotaInput(e.target.value)}
                  placeholder="Leave empty or 0 for Unlimited / Pool"
                  className="flex-1 px-3 py-2 bg-[#0B0F1A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-xs font-mono text-slate-100 outline-none"
                />
                <span className="text-xs text-slate-400 font-mono">GB</span>
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Enter a GB limit, or clear the input to set this device back to uncapped pool share.
              </p>
            </div>

            {/* Presets */}
            <div className="flex items-center space-x-2">
              {[10, 25, 50, 100].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setDeviceQuotaInput(String(preset))}
                  className="px-2.5 py-1 rounded bg-[#161B2A] hover:bg-[#1F293D] text-slate-300 text-xs font-mono cursor-pointer"
                >
                  {preset} GB
                </button>
              ))}
              <button
                type="button"
                onClick={() => setDeviceQuotaInput('')}
                className="px-2.5 py-1 rounded bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 text-xs cursor-pointer"
              >
                Clear (Uncapped)
              </button>
            </div>

            <div className="flex items-center justify-end space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setEditingDevice(null)}
                className="px-4 py-2 bg-[#161B2A] text-slate-300 hover:text-white rounded-lg text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveDeviceQuota}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-xs shadow cursor-pointer"
              >
                Save Device Quota
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD REAL IP MANUALLY MODAL */}
      {isAddIpModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-[#0F1423] border border-[#1F293D] rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1F293D] pb-3">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                  <PlusCircle className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100 uppercase tracking-wide">
                    Add Real Network Device
                  </h3>
                  <p className="text-[11px] text-slate-400">Track an active LAN/Wi-Fi client device by IP</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsAddIpModalOpen(false);
                  setAddIpError(null);
                }}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {addIpError && (
              <div className="p-2.5 rounded-lg bg-rose-950/70 border border-rose-800 text-rose-300 text-xs flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{addIpError}</span>
              </div>
            )}

            <form onSubmit={handleAddManualDevice} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-slate-300 block mb-1">
                  IPv4 Address <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={manualIp}
                  onChange={(e) => setManualIp(e.target.value)}
                  placeholder="e.g. 192.168.1.120"
                  className="w-full px-3 py-2 bg-[#0B0F1A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-xs font-mono text-slate-100 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Hostname (Optional)
                  </label>
                  <input
                    type="text"
                    value={manualHostname}
                    onChange={(e) => setManualHostname(e.target.value)}
                    placeholder="e.g. Work-Laptop"
                    className="w-full px-3 py-2 bg-[#0B0F1A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-xs text-slate-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    MAC Address (Optional)
                  </label>
                  <input
                    type="text"
                    value={manualMac}
                    onChange={(e) => setManualMac(e.target.value)}
                    placeholder="AA:BB:CC:DD:EE:FF"
                    className="w-full px-3 py-2 bg-[#0B0F1A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-xs font-mono text-slate-100 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Quota Limit in GB
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={manualQuotaGB}
                    onChange={(e) => setManualQuotaGB(e.target.value)}
                    placeholder="Empty for uncapped"
                    className="w-full px-3 py-2 bg-[#0B0F1A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-xs font-mono text-slate-100 outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-300 block mb-1">
                    Connection Band
                  </label>
                  <select
                    value={manualConnectionType}
                    onChange={(e) => setManualConnectionType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-[#0B0F1A] border border-[#1F293D] focus:border-cyan-500 rounded-lg text-xs text-slate-100 outline-none"
                  >
                    <option value="5.0GHz">5.0 GHz Wi-Fi</option>
                    <option value="2.4GHz">2.4 GHz Wi-Fi</option>
                    <option value="Ethernet">Ethernet / LAN</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddIpModalOpen(false);
                    setAddIpError(null);
                  }}
                  className="px-4 py-2 bg-[#161B2A] text-slate-300 hover:text-white rounded-lg text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-lg text-xs shadow cursor-pointer transition-colors"
                >
                  Add Real Device
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
