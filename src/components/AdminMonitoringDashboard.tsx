import React, { useState } from 'react';
import {
  Cpu,
  Layers,
  HardDrive,
  Wifi,
  Globe,
  Sliders,
  Sparkles,
  ShieldCheck,
  Play,
  CheckCircle2,
  Activity,
  RotateCcw,
  Terminal,
  Zap,
  Trash2,
  RefreshCw,
  Clock,
  Check,
  Flame,
  AlertCircle,
  Router
} from 'lucide-react';
import { HardwareMetrics, OptimizationTaskInfo, OptimizationTaskId, ExecutionReport } from '../types';

interface AdminMonitoringDashboardProps {
  metrics: HardwareMetrics;
  isExecuting: boolean;
  onSelectTask: (task: OptimizationTaskInfo) => void;
  lastReport: ExecutionReport | null;
  onOpenTerminalView: () => void;
  onOpenReportModal: () => void;
  onOpenRouterView?: () => void;
}

export const OPTIMIZATION_TASKS: OptimizationTaskInfo[] = [
  {
    id: 'full',
    title: 'One-Click Full System Optimization',
    shortDesc: 'Executes comprehensive deep cleanup: Temp files, Recycle Bin, Windows Update cache, DNS flush, closed browser caches, and SysMain standby RAM purge.',
    icon: 'Zap',
    riskLevel: 'Safe',
    elevationScope: [
      'Purge User & Windows Temp folders (%TEMP%, C:\\Windows\\Temp)',
      'Empty Windows Recycle Bin across all volumes silently',
      'Purge Windows Prefetch directory (preserving boot layout)',
      'Pause wuauserv & bits, clear SoftwareDistribution update downloads',
      'Execute Clear-DnsClientCache and ipconfig /flushdns',
      'Detect running browsers and purge inactive cache directories',
      'Flush standby RAM cache & restart SysMain (SuperFetch) service'
    ],
    commandPreview: 'powershell.exe -ExecutionPolicy Bypass -File .\\WinOptimize.ps1 -Task FullOptimization -Elevated'
  },
  {
    id: 'temp',
    title: 'Clean Temp Files & Recycle Bin',
    shortDesc: 'Safely removes accumulated user temp files, Windows system temp, emptied recycle bin clutter, and old prefetch traces with locked-file protection.',
    icon: 'Trash2',
    riskLevel: 'Safe',
    elevationScope: [
      'Clean %LOCALAPPDATA%\\Temp and C:\\Windows\\Temp',
      'Purge Recycle Bin silently without confirmation popups',
      'Clean prefetch files excluding layout.ini and ReadyBoot traces'
    ],
    commandPreview: 'powershell.exe -ExecutionPolicy Bypass -File .\\WinOptimize.ps1 -Task CleanTemp -Elevated'
  },
  {
    id: 'ram',
    title: 'Free Standby RAM & Recycle SysMain',
    shortDesc: 'Reclaims bloated standby memory pages and recycles the Windows SuperFetch (SysMain) memory caching service to restore instant app responsiveness.',
    icon: 'Cpu',
    riskLevel: 'Safe',
    elevationScope: [
      'Purge Windows Standby Memory Cache list',
      'Restart SysMain (SuperFetch) service to flush stale indexes',
      'Refresh system working memory sets for foreground applications'
    ],
    commandPreview: 'powershell.exe -ExecutionPolicy Bypass -File .\\WinOptimize.ps1 -Task FreeMemory -Elevated'
  },
  {
    id: 'dns',
    title: 'Flush DNS Resolver & Reset Network',
    shortDesc: 'Flushes the local DNS client resolver cache, clears stale domain records, and refreshes network socket state to fix connection latency.',
    icon: 'Wifi',
    riskLevel: 'Safe',
    elevationScope: [
      'Execute Clear-DnsClientCache cmdlet',
      'Execute ipconfig /flushdns',
      'Refresh NetBIOS names and ARP routing table cache'
    ],
    commandPreview: 'powershell.exe -ExecutionPolicy Bypass -File .\\WinOptimize.ps1 -Task FlushNetwork -Elevated'
  },
  {
    id: 'browser',
    title: 'Clean Inactive Browser Caches',
    shortDesc: 'Checks whether Chrome, Edge, Firefox, or Brave are running. If closed, purges gigabytes of temporary cache; if open, safely skips without corrupting databases.',
    icon: 'Globe',
    riskLevel: 'Safe',
    elevationScope: [
      'Test for running chrome.exe, msedge.exe, firefox.exe, brave.exe',
      'Purge Google Chrome Service Worker and GPU Cache',
      'Purge Microsoft Edge EBWebView & user profile Cache',
      'Purge Mozilla Firefox cache2 disk files'
    ],
    commandPreview: 'powershell.exe -ExecutionPolicy Bypass -File .\\WinOptimize.ps1 -Task CleanBrowsers -Elevated'
  },
  {
    id: 'update',
    title: 'Purge Windows Update Cache',
    shortDesc: 'Safely pauses the Windows Update and BITS services, deletes orphaned downloaded update installers from SoftwareDistribution, and resumes services.',
    icon: 'RefreshCw',
    riskLevel: 'Safe',
    elevationScope: [
      'Stop-Service -Name wuauserv, bits -Force',
      'Remove-Item C:\\Windows\\SoftwareDistribution\\Download\\* -Recurse',
      'Restart-Service -Name wuauserv, bits in guaranteed finally block'
    ],
    commandPreview: 'powershell.exe -ExecutionPolicy Bypass -File .\\WinOptimize.ps1 -Task CleanUpdateCache -Elevated'
  }
];

export const AdminMonitoringDashboard: React.FC<AdminMonitoringDashboardProps> = ({
  metrics,
  isExecuting,
  onSelectTask,
  lastReport,
  onOpenTerminalView,
  onOpenReportModal,
  onOpenRouterView,
}) => {
  const [taskState, setTaskState] = useState<Record<string, 'ready' | 'running' | 'success' | 'failed'>>({
    cpu: 'ready',
    ram: 'ready',
    disk: 'ready',
  });

  const handleInlineTask = async (cardId: 'cpu' | 'ram' | 'disk', taskId: OptimizationTaskId) => {
    if (!window.electronAPI || isExecuting || taskState[cardId] === 'running') return;
    setTaskState(prev => ({ ...prev, [cardId]: 'running' }));
    
    // Create specific config for this task
    const inlineConfig = {
      cleanTempFiles: false,
      emptyRecycleBin: false,
      cleanPrefetch: false,
      cleanWindowsUpdateCache: false,
      cleanDeliveryOptimization: false,
      flushDnsCache: false,
      resetWinsockAndTcpIp: false,
      cleanChromeCache: false,
      cleanEdgeCache: false,
      cleanFirefoxCache: false,
      cleanBraveCache: false,
      restartPerformanceServices: false,
      adjustVisualEffects: false,
      optimizeCPU: false,
      visualEffectsPreset: 'balanced' as const,
      createRestorePoint: false,
      dryRunMode: false,
      logToFile: false
    };
    
    if (cardId === 'cpu') {
      inlineConfig.optimizeCPU = true;
    } else if (cardId === 'ram') {
      inlineConfig.restartPerformanceServices = true;
    } else if (cardId === 'disk') {
      inlineConfig.cleanTempFiles = true;
      inlineConfig.emptyRecycleBin = true;
    }

    try {
      const result = await window.electronAPI.runOptimizationTask(taskId, inlineConfig, true);
      if (result.success) {
        setTaskState(prev => ({ ...prev, [cardId]: 'success' }));
      } else {
        setTaskState(prev => ({ ...prev, [cardId]: 'failed' }));
      }
      setTimeout(() => setTaskState(prev => ({ ...prev, [cardId]: 'ready' })), 4000);
    } catch (e) {
      setTaskState(prev => ({ ...prev, [cardId]: 'failed' }));
      setTimeout(() => setTaskState(prev => ({ ...prev, [cardId]: 'ready' })), 4000);
    }
  };

  // Sparkline helper
  const renderSparkline = (data: number[], maxVal = 100, strokeColor = '#0284C7', fillColor = 'rgba(2, 132, 199, 0.15)') => {
    const width = 240;
    const height = 48;
    if (!data || data.length < 2) return null;

    const step = width / (data.length - 1);
    const points = data.map((val, idx) => {
      const x = idx * step;
      const normalized = Math.min(1, Math.max(0, val / maxVal));
      const y = height - normalized * (height - 6) - 3;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const pathD = `M ${points.join(' L ')}`;
    const areaD = `M 0,${height} L ${points.join(' L ')} L ${width},${height} Z`;

    return (
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-12 overflow-visible">
        <defs>
          <linearGradient id={`grad-${strokeColor.replace('#', '')}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={strokeColor} stopOpacity="0.3" />
            <stop offset="100%" stopColor={strokeColor} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill={`url(#grad-${strokeColor.replace('#', '')})`} />
        <path d={pathD} fill="none" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {/* Latest pulse point */}
        {data.length > 0 && (
          <circle
            cx={width}
            cy={height - Math.min(1, Math.max(0, data[data.length - 1] / maxVal)) * (height - 6) - 3}
            r="3.5"
            fill={strokeColor}
            className="animate-ping origin-center"
          />
        )}
      </svg>
    );
  };

  return (
    <div className="space-y-6 font-sans text-slate-100">
      {/* Top Banner: Admin Status & System Identification */}
      <div className="bg-[#161B2A] border border-[#1F293D] rounded-xl p-4 sm:p-5 shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-[#0284C7]/20 border border-[#0284C7]/40 flex items-center justify-center text-cyan-400 shadow-sm">
            <Activity className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-base sm:text-lg font-bold text-slate-100">
                Windows Administrative Performance Console
              </h2>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950/60 text-emerald-400 border border-emerald-800/60 flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                <span>Live Monitoring Active</span>
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Click any optimization task below. Each command asks for explicit UAC Administrator approval, then directly runs in PowerShell with live terminal execution and a complete cleanup report.
            </p>
          </div>
        </div>

        {/* Quick status badge & Last report link */}
        <div className="flex items-center space-x-3">
          {lastReport && (
            <button
              onClick={onOpenReportModal}
              className="px-3 py-1.5 bg-[#0C243C] hover:bg-[#133252] text-cyan-300 rounded-lg text-xs font-semibold border border-[#0284C7]/50 flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>View Last Report ({lastReport.filesDeleted.toLocaleString()} files freed)</span>
            </button>
          )}

          <button
            onClick={onOpenTerminalView}
            className="px-3 py-1.5 bg-[#1E293B]/70 hover:bg-[#1E293B] text-slate-300 rounded-lg text-xs font-medium border border-[#2D3A54] flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span>Open PowerShell Terminal</span>
          </button>
        </div>
      </div>

      {/* SECTION 1: LIVE HARDWARE TELEMETRY MONITOR (RAM & CPU) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Live Hardware Telemetry & Real-Time Monitoring
            </h3>
          </div>
          <div className="flex items-center space-x-2 text-[11px] text-slate-400 font-mono">
            <span>Sampling: 1000ms</span>
            <span>•</span>
            <span className="text-emerald-400">Kernel Polling: OK</span>
          </div>
        </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 relative">
          {/* Subtle background glow behind the cards */}
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-emerald-500/5 to-purple-500/5 blur-3xl -z-10 rounded-3xl" />

          {/* CARD 1: CPU */}
          <div className="group relative bg-gradient-to-b from-[#0F172A]/90 to-[#0B1121]/90 backdrop-blur-md rounded-2xl p-6 shadow-2xl flex flex-col justify-between overflow-hidden border border-slate-800/60 hover:border-cyan-900/50 transition-all duration-500">
            {/* Ambient Top Glow */}
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-cyan-950/40 flex items-center justify-center text-cyan-400 shadow-inner border border-cyan-800/30">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100 tracking-wide">Processor Core</h3>
                    <p className="text-[11px] text-slate-400 font-medium">AMD / Intel x64 Architecture</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-light tracking-tight text-cyan-400">
                    {metrics.cpuUsagePercent}<span className="text-lg text-cyan-700">%</span>
                  </div>
                </div>
              </div>

              {/* Minimal Sparkline */}
              <div className="mb-6 opacity-80 group-hover:opacity-100 transition-opacity">
                {renderSparkline(metrics.cpuHistory, 100, '#06b6d4')}
              </div>

              {/* Data Rows */}
              <div className="space-y-3 mb-8 text-xs font-medium">
                <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                  <span className="text-slate-500">Clock Speed</span>
                  <span className="text-slate-200 font-mono">{metrics.cpuClockSpeedGhz.toFixed(2)} GHz</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                  <span className="text-slate-500">Logical Cores</span>
                  <span className="text-slate-200 font-mono">16 Threads</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                  <span className="text-slate-500">Active Processes</span>
                  <span className="text-slate-200 font-mono">{metrics.cpuProcesses}</span>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="relative z-10">
              <button
                onClick={() => handleInlineTask('cpu', 'cpu')}
                disabled={taskState.cpu === 'running' || isExecuting}
                className={`w-full py-3 px-4 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg ${
                  taskState.cpu === 'running'
                    ? 'bg-cyan-950 text-cyan-400 border border-cyan-800 cursor-wait'
                    : taskState.cpu === 'success'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : taskState.cpu === 'failed'
                    ? 'bg-rose-950 text-rose-400 border border-rose-800'
                    : 'bg-[#1E293B] hover:bg-cyan-600 hover:shadow-cyan-900/50 text-slate-200 hover:text-white border border-slate-700 hover:border-cyan-500'
                }`}
              >
                {taskState.cpu === 'running' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : taskState.cpu === 'success' ? (
                  <Check className="w-4 h-4" />
                ) : taskState.cpu === 'failed' ? (
                  <AlertCircle className="w-4 h-4" />
                ) : (
                  <Zap className="w-4 h-4" />
                )}
                <span>
                  {taskState.cpu === 'running'
                    ? 'Optimizing CPU...'
                    : taskState.cpu === 'success'
                    ? 'CPU Optimized'
                    : taskState.cpu === 'failed'
                    ? 'Optimization Failed'
                    : 'Optimize CPU'}
                </span>
              </button>
            </div>
          </div>

          {/* CARD 2: RAM */}
          <div className="group relative bg-gradient-to-b from-[#0F172A]/90 to-[#0B1121]/90 backdrop-blur-md rounded-2xl p-6 shadow-2xl flex flex-col justify-between overflow-hidden border border-slate-800/60 hover:border-emerald-900/50 transition-all duration-500">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-emerald-500/40 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-950/40 flex items-center justify-center text-emerald-400 shadow-inner border border-emerald-800/30">
                    <Layers className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100 tracking-wide">System Memory</h3>
                    <p className="text-[11px] text-slate-400 font-medium">{metrics.ramTotalGB.toFixed(1)} GB Physical RAM</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-light tracking-tight text-emerald-400">
                    {metrics.ramPercent}<span className="text-lg text-emerald-700">%</span>
                  </div>
                </div>
              </div>

              {/* Minimal Sparkline */}
              <div className="mb-6 opacity-80 group-hover:opacity-100 transition-opacity">
                {renderSparkline(metrics.ramHistory, 100, '#10b981')}
              </div>

              {/* Data Rows */}
              <div className="space-y-3 mb-8 text-xs font-medium">
                <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                  <span className="text-slate-500">In-Use Memory</span>
                  <span className="text-slate-200 font-mono">{(metrics.ramUsedGB - metrics.ramStandbyGB).toFixed(1)} GB</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                  <span className="text-slate-500">Standby Cache</span>
                  <span className="text-emerald-400 font-mono">{metrics.ramStandbyGB.toFixed(1)} GB</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                  <span className="text-slate-500">Available Free</span>
                  <span className="text-slate-200 font-mono">{(metrics.ramTotalGB - metrics.ramUsedGB).toFixed(1)} GB</span>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="relative z-10">
              <button
                onClick={() => handleInlineTask('ram', 'ram')}
                disabled={taskState.ram === 'running' || isExecuting}
                className={`w-full py-3 px-4 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg ${
                  taskState.ram === 'running'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800 cursor-wait'
                    : taskState.ram === 'success'
                    ? 'bg-teal-950 text-teal-400 border border-teal-800'
                    : taskState.ram === 'failed'
                    ? 'bg-rose-950 text-rose-400 border border-rose-800'
                    : 'bg-[#1E293B] hover:bg-emerald-600 hover:shadow-emerald-900/50 text-slate-200 hover:text-white border border-slate-700 hover:border-emerald-500'
                }`}
              >
                {taskState.ram === 'running' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : taskState.ram === 'success' ? (
                  <Check className="w-4 h-4" />
                ) : taskState.ram === 'failed' ? (
                  <AlertCircle className="w-4 h-4" />
                ) : (
                  <RotateCcw className="w-4 h-4" />
                )}
                <span>
                  {taskState.ram === 'running'
                    ? 'Flushing Memory...'
                    : taskState.ram === 'success'
                    ? 'RAM Flushed'
                    : taskState.ram === 'failed'
                    ? 'Flush Failed'
                    : 'Flush RAM'}
                </span>
              </button>
            </div>
          </div>

          {/* CARD 3: DISK */}
          <div className="group relative bg-gradient-to-b from-[#0F172A]/90 to-[#0B1121]/90 backdrop-blur-md rounded-2xl p-6 shadow-2xl flex flex-col justify-between overflow-hidden border border-slate-800/60 hover:border-purple-900/50 transition-all duration-500">
            <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-purple-500/40 to-transparent opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
            
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-purple-950/40 flex items-center justify-center text-purple-400 shadow-inner border border-purple-800/30">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-100 tracking-wide">System Drive</h3>
                    <p className="text-[11px] text-slate-400 font-medium">OS Volume (C:)</p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-light tracking-tight text-purple-400">
                    {Math.round((metrics.driveUsedGB / metrics.driveTotalGB) * 100)}<span className="text-lg text-purple-700">%</span>
                  </div>
                </div>
              </div>

              {/* Minimal Storage Bar */}
              <div className="mb-6 pt-3">
                <div className="h-1.5 w-full bg-slate-800/50 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-500 rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(168,85,247,0.5)]"
                    style={{ width: `${(metrics.driveUsedGB / metrics.driveTotalGB) * 100}%` }}
                  />
                </div>
                <div className="flex justify-between mt-2 text-[10px] text-slate-500 font-medium">
                  <span>{metrics.driveUsedGB} GB Used</span>
                  <span>{metrics.driveTotalGB} GB Total</span>
                </div>
              </div>

              {/* Data Rows */}
              <div className="space-y-3 mb-8 text-xs font-medium">
                <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                  <span className="text-slate-500">Free Space</span>
                  <span className="text-purple-400 font-mono">{(metrics.driveTotalGB - metrics.driveUsedGB)} GB</span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                  <span className="text-slate-500">Top Process</span>
                  <span className="text-slate-200 truncate max-w-[120px] text-right">
                    {metrics.topProcesses[0]?.name || 'System Idle'}
                  </span>
                </div>
                <div className="flex justify-between items-center border-b border-slate-800/50 pb-2">
                  <span className="text-slate-500">Top Process RAM</span>
                  <span className="text-slate-200 font-mono">
                    {metrics.topProcesses[0]?.memMB || 0} MB
                  </span>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="relative z-10">
              <button
                onClick={() => handleInlineTask('disk', 'temp')}
                disabled={taskState.disk === 'running' || isExecuting}
                className={`w-full py-3 px-4 rounded-xl text-sm font-bold tracking-wide transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg ${
                  taskState.disk === 'running'
                    ? 'bg-purple-950 text-purple-400 border border-purple-800 cursor-wait'
                    : taskState.disk === 'success'
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : taskState.disk === 'failed'
                    ? 'bg-rose-950 text-rose-400 border border-rose-800'
                    : 'bg-[#1E293B] hover:bg-purple-600 hover:shadow-purple-900/50 text-slate-200 hover:text-white border border-slate-700 hover:border-purple-500'
                }`}
              >
                {taskState.disk === 'running' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : taskState.disk === 'success' ? (
                  <Check className="w-4 h-4" />
                ) : taskState.disk === 'failed' ? (
                  <AlertCircle className="w-4 h-4" />
                ) : (
                  <Trash2 className="w-4 h-4" />
                )}
                <span>
                  {taskState.disk === 'running'
                    ? 'Cleaning Drive...'
                    : taskState.disk === 'success'
                    ? 'Drive Cleaned'
                    : taskState.disk === 'failed'
                    ? 'Cleanup Failed'
                    : 'Clean Drive'}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
      {/* SECTION 2: COMMAND EXECUTION BUTTONS (NO RAW CODE - ASKS UAC -> RUNS POWERSHELL -> REPORTS) */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Zap className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              One-Click Optimization Actions (Direct PowerShell Execution)
            </h3>
          </div>
          <span className="text-xs text-slate-400">
            Triggers UAC Elevation Verification &bull; No code paste required
          </span>
        </div>

        {/* Highlighted Master Button: Full System Optimization */}
        <div className="mb-4">
          <div className="bg-gradient-to-r from-[#0C243C] via-[#0F1C32] to-[#1E293B] border-2 border-[#0284C7] rounded-xl p-5 shadow-xl shadow-sky-950/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3.5">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#0284C7] to-[#2563EB] flex items-center justify-center text-white shadow-lg shadow-sky-900/40 flex-shrink-0">
                <Zap className="w-6 h-6 fill-current" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="text-base font-bold text-white">
                    One-Click Full System Optimization
                  </h4>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold uppercase tracking-wider">
                    Recommended
                  </span>
                </div>
                <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                  Executes all verified maintenance routines in sequence: clears %TEMP% & Windows Temp, empties Recycle Bin, clears Prefetch and Windows Update download cache, flushes DNS, safely purges closed browser caches, and flushes Standby RAM cache.
                </p>
                <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-cyan-300 font-mono">
                  <span>✓ 7 Automated Modules</span>
                  <span>✓ Process Lock Protected</span>
                  <span>✓ Auto-generates Simple Report</span>
                </div>
              </div>
            </div>

            <button
              id="action-btn-full-optimization"
              onClick={() => onSelectTask(OPTIMIZATION_TASKS[0])}
              disabled={isExecuting}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-[#0284C7] via-[#0284C7] to-[#2563EB] hover:from-[#0369A1] hover:to-[#1D4ED8] text-white font-bold text-sm rounded-xl shadow-lg shadow-sky-950/60 border border-sky-300/30 transition-all active:scale-95 cursor-pointer flex items-center justify-center space-x-2 flex-shrink-0"
            >
              <Play className="w-4 h-4 fill-current text-sky-100" />
              <span>Execute Full Optimization</span>
            </button>
          </div>
        </div>

        {/* Modular Single-Task Buttons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {OPTIMIZATION_TASKS.slice(1).map((task) => (
            <div
              key={task.id}
              className="bg-[#161B2A] border border-[#1F293D] hover:border-[#2D3A54] rounded-xl p-4 shadow-lg flex flex-col justify-between transition-all group"
            >
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center space-x-2">
                    <div className="p-1.5 rounded-lg bg-[#0F1423] text-cyan-400 border border-[#1F293D] group-hover:border-cyan-500/40 transition-colors">
                      {task.id === 'temp' && <Trash2 className="w-4 h-4 text-rose-400" />}
                      {task.id === 'ram' && <Cpu className="w-4 h-4 text-emerald-400" />}
                      {task.id === 'dns' && <Wifi className="w-4 h-4 text-sky-400" />}
                      {task.id === 'browser' && <Globe className="w-4 h-4 text-amber-400" />}
                      {task.id === 'update' && <RefreshCw className="w-4 h-4 text-purple-400" />}
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono">
                      Module
                    </span>
                  </div>

                  <span className="text-[10px] font-semibold text-emerald-400 bg-[#064E3B]/40 px-2 py-0.5 rounded border border-emerald-700/50">
                    {task.riskLevel}
                  </span>
                </div>

                <h4 className="text-sm font-bold text-slate-100 mb-1 group-hover:text-cyan-300 transition-colors">
                  {task.title}
                </h4>
                <p className="text-xs text-slate-400 leading-relaxed mb-3">
                  {task.shortDesc}
                </p>

                {/* Scope chips */}
                <div className="space-y-1 mb-4 text-[11px] text-slate-400">
                  {task.elevationScope.slice(0, 2).map((item, idx) => (
                    <div key={idx} className="flex items-center space-x-1.5 text-slate-300">
                      <span className="text-cyan-400 font-bold">›</span>
                      <span className="truncate">{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button
                id={`action-btn-${task.id}`}
                onClick={() => onSelectTask(task)}
                disabled={isExecuting}
                className="w-full py-2 px-3 bg-[#0F1423] hover:bg-[#1E293B] text-slate-200 hover:text-white rounded-lg text-xs font-semibold border border-[#1F293D] hover:border-cyan-500/50 transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                <Play className="w-3.5 h-3.5 text-cyan-400 fill-current" />
                <span>Request Elevation & Execute</span>
              </button>
            </div>
          ))}
        </div>

        {/* Universal Router Management Spotlight Card */}
        {onOpenRouterView && (
          <div className="mt-5 bg-gradient-to-r from-[#0C1B2E] via-[#0F1423] to-[#161B2A] border border-cyan-500/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-md">
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-lg bg-cyan-950/80 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shadow-sm flex-shrink-0">
                <Router className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="text-sm font-bold text-slate-100">Universal Router Management & Wi-Fi Configuration</h4>
                  <span className="px-2 py-0.5 rounded-full bg-cyan-950 text-cyan-300 border border-cyan-500/30 text-[10px] font-bold uppercase tracking-wider">
                    New Feature
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Brand-agnostic wireless management: auto-detect gateway (OpenWrt, ASUS, TP-Link, Netgear, D-Link, MikroTik), update SSID/passwords, and verify committed changes.
                </p>
              </div>
            </div>
            <button
              onClick={onOpenRouterView}
              className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 flex-shrink-0 shadow-sm"
            >
              <Router className="w-3.5 h-3.5" />
              <span>Launch Router Console</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
