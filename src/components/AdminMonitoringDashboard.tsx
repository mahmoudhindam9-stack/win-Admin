import React from 'react';
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* CARD 1: CPU (PROCESSOR) MONITOR */}
          <div className="bg-[#161B2A] border border-[#1F293D] rounded-xl p-5 shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-[#1F293D]">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                  <Cpu className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    CPU (Processor)
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    AMD / Intel x64 • 8 Cores / 16 Threads
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-2xl font-extrabold font-mono text-cyan-400 tracking-tight">
                  {metrics.cpuUsagePercent}%
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {metrics.cpuClockSpeedGhz.toFixed(2)} GHz
                </div>
              </div>
            </div>

            {/* Gauge bar */}
            <div className="my-3">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                <span>Processor Utilization</span>
                <span className="font-mono text-slate-200">{metrics.cpuUsagePercent}%</span>
              </div>
              <div className="h-2 w-full bg-[#0B0F1A] rounded-full overflow-hidden border border-[#1F293D]">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    metrics.cpuUsagePercent > 75
                      ? 'bg-rose-500'
                      : metrics.cpuUsagePercent > 45
                      ? 'bg-amber-400'
                      : 'bg-gradient-to-r from-[#0284C7] to-cyan-400'
                  }`}
                  style={{ width: `${metrics.cpuUsagePercent}%` }}
                />
              </div>
            </div>

            {/* Sparkline Graph */}
            <div className="bg-[#0B0F1A] p-2.5 rounded-lg border border-[#1F293D] mb-3">
              <div className="text-[10px] text-slate-500 font-mono uppercase mb-1 flex items-center justify-between">
                <span>Load History (Last 20s)</span>
                <span className="text-cyan-400">Peak: {Math.max(...metrics.cpuHistory)}%</span>
              </div>
              {renderSparkline(metrics.cpuHistory, 100, '#0284C7')}
            </div>

            {/* Micro details grid */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-[#1F293D]">
              <div className="bg-[#0F1423] p-1.5 rounded border border-[#1F293D]">
                <div className="text-[10px] text-slate-500 font-mono">Processes</div>
                <div className="font-bold text-slate-200 font-mono">{metrics.cpuProcesses}</div>
              </div>
              <div className="bg-[#0F1423] p-1.5 rounded border border-[#1F293D]">
                <div className="text-[10px] text-slate-500 font-mono">Threads</div>
                <div className="font-bold text-slate-200 font-mono">{metrics.cpuThreads.toLocaleString()}</div>
              </div>
              <div className="bg-[#0F1423] p-1.5 rounded border border-[#1F293D]">
                <div className="text-[10px] text-slate-500 font-mono">Base Speed</div>
                <div className="font-bold text-slate-200 font-mono">3.60 GHz</div>
              </div>
            </div>
          </div>

          {/* CARD 2: RAM (MEMORY) MONITOR */}
          <div className="bg-[#161B2A] border border-[#1F293D] rounded-xl p-5 shadow-xl flex flex-col justify-between relative overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-[#1F293D]">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                    RAM (Physical Memory)
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    16.0 GB DDR4 • 3200 MHz
                  </div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-2xl font-extrabold font-mono text-emerald-400 tracking-tight">
                  {metrics.ramPercent}%
                </div>
                <div className="text-[10px] text-slate-400 font-mono">
                  {metrics.ramUsedGB.toFixed(1)} / {metrics.ramTotalGB.toFixed(1)} GB
                </div>
              </div>
            </div>

            {/* Gauge bar */}
            <div className="my-3">
              <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                <span>Committed & In-Use</span>
                <span className="font-mono text-slate-200">
                  {metrics.ramUsedGB.toFixed(1)} GB ({metrics.ramPercent}%)
                </span>
              </div>
              <div className="h-2 w-full bg-[#0B0F1A] rounded-full overflow-hidden border border-[#1F293D]">
                <div
                  className={`h-full transition-all duration-500 rounded-full ${
                    metrics.ramPercent > 80
                      ? 'bg-rose-500'
                      : metrics.ramPercent > 60
                      ? 'bg-amber-400'
                      : 'bg-gradient-to-r from-emerald-500 to-teal-400'
                  }`}
                  style={{ width: `${metrics.ramPercent}%` }}
                />
              </div>
            </div>

            {/* Sparkline Graph */}
            <div className="bg-[#0B0F1A] p-2.5 rounded-lg border border-[#1F293D] mb-3">
              <div className="text-[10px] text-slate-500 font-mono uppercase mb-1 flex items-center justify-between">
                <span>Memory History (Last 20s)</span>
                <span className="text-emerald-400">Standby Cache: {metrics.ramStandbyGB.toFixed(1)} GB</span>
              </div>
              {renderSparkline(metrics.ramHistory, 100, '#10B981')}
            </div>

            {/* Micro details grid */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs pt-1 border-t border-[#1F293D]">
              <div className="bg-[#0F1423] p-1.5 rounded border border-[#1F293D]">
                <div className="text-[10px] text-slate-500 font-mono">In-Use</div>
                <div className="font-bold text-slate-200 font-mono">{(metrics.ramUsedGB - metrics.ramStandbyGB).toFixed(1)} GB</div>
              </div>
              <div className="bg-[#0F1423] p-1.5 rounded border border-[#1F293D]">
                <div className="text-[10px] text-slate-500 font-mono">Standby Cache</div>
                <div className="font-bold text-cyan-300 font-mono">{metrics.ramStandbyGB.toFixed(1)} GB</div>
              </div>
              <div className="bg-[#0F1423] p-1.5 rounded border border-[#1F293D]">
                <div className="text-[10px] text-slate-500 font-mono">Available</div>
                <div className="font-bold text-emerald-400 font-mono">{(metrics.ramTotalGB - metrics.ramUsedGB).toFixed(1)} GB</div>
              </div>
            </div>
          </div>

          {/* CARD 3: STORAGE DRIVE & ACTIVE PROCESSES */}
          <div className="bg-[#161B2A] border border-[#1F293D] rounded-xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-[#1F293D]">
                <div className="flex items-center space-x-2.5">
                  <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <HardDrive className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                      System Drive (C:)
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      NVMe SSD • NTFS Primary
                    </div>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-bold font-mono text-purple-300">
                    {metrics.driveUsedGB} GB / {metrics.driveTotalGB} GB
                  </div>
                  <div className="text-[10px] text-slate-400 font-mono">
                    {(metrics.driveTotalGB - metrics.driveUsedGB)} GB Free
                  </div>
                </div>
              </div>

              {/* Drive Bar */}
              <div className="my-3">
                <div className="h-2 w-full bg-[#0B0F1A] rounded-full overflow-hidden border border-[#1F293D]">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 rounded-full"
                    style={{ width: `${(metrics.driveUsedGB / metrics.driveTotalGB) * 100}%` }}
                  />
                </div>
              </div>

              {/* Active Process List */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] text-slate-400 pb-1 border-b border-[#1F293D]">
                  <span className="font-semibold uppercase tracking-wider text-[10px]">Top Active Processes</span>
                  <span className="text-[10px] font-mono">CPU / RAM</span>
                </div>

                <div className="space-y-1 text-xs">
                  {metrics.topProcesses.map((p) => (
                    <div
                      key={p.pid}
                      className="flex items-center justify-between py-1 px-2 rounded bg-[#0F1423] border border-[#1F293D] font-mono text-[11px]"
                    >
                      <div className="flex items-center space-x-2 overflow-hidden">
                        <span className="text-slate-500 text-[10px]">[{p.pid}]</span>
                        <span className="font-medium text-slate-200 truncate">{p.name}</span>
                      </div>
                      <div className="flex items-center space-x-2 text-right">
                        <span className="text-cyan-300">{p.cpuPercent}%</span>
                        <span className="text-slate-400">{p.memMB}MB</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick action button right on the RAM card */}
            <div className="pt-3 mt-2 border-t border-[#1F293D] flex items-center justify-between">
              <span className="text-[11px] text-slate-400">Need instant RAM flush?</span>
              <button
                onClick={() => onSelectTask(OPTIMIZATION_TASKS.find((t) => t.id === 'ram')!)}
                disabled={isExecuting}
                className="px-2.5 py-1 bg-emerald-950/40 hover:bg-emerald-950/70 border border-emerald-700/60 text-emerald-300 text-xs font-semibold rounded-md flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <Zap className="w-3 h-3 text-emerald-400" />
                <span>Flush RAM Now</span>
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
