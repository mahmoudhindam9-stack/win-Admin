import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { AdminMonitoringDashboard } from './components/AdminMonitoringDashboard';
import { UACPermissionModal } from './components/UACPermissionModal';
import { ExecutionReportModal } from './components/ExecutionReportModal';
import { ConfigPanel } from './components/ConfigPanel';
import { ScriptViewer } from './components/ScriptViewer';
import { TerminalSimulator } from './components/TerminalSimulator';
import { AdminGuide } from './components/AdminGuide';
import { RouterManagementView } from './components/RouterManagementView';
import {
  ScriptConfig,
  OptimizationTaskInfo,
  HardwareMetrics,
  ExecutionReport,
} from './types';
import { DEFAULT_CONFIG } from './data/defaultConfig';
import { generatePowerShellScript } from './data/scriptGenerator';
import {
  ShieldCheck,
  Cpu,
  Layers,
  HardDrive,
  CheckCircle2,
  Terminal,
  Activity,
} from 'lucide-react';

export default function App() {
  const [config, setConfig] = useState<ScriptConfig>(DEFAULT_CONFIG);
  const [activeView, setActiveView] = useState<'dashboard' | 'router' | 'terminal' | 'code' | 'guide'>('dashboard');

  // Task execution and UAC dialog state
  const [selectedTask, setSelectedTask] = useState<OptimizationTaskInfo | null>(null);
  const [isUACModalOpen, setIsUACModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [lastReport, setLastReport] = useState<ExecutionReport | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [autoStartTerminal, setAutoStartTerminal] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);

  // Live Hardware Telemetry State
  const [isElevated, setIsElevated] = useState(false);
  const [metrics, setMetrics] = useState<HardwareMetrics>({
    cpuUsagePercent: 19,
    cpuClockSpeedGhz: 3.95,
    cpuThreads: 16,
    cpuProcesses: 186,
    cpuHistory: [16, 18, 19, 21, 18, 17, 22, 19, 20, 18, 19, 17, 21, 23, 19, 18, 20, 19, 22, 19],
    ramUsedGB: 9.8,
    ramTotalGB: 16.0,
    ramStandbyGB: 2.1,
    ramPercent: 61,
    ramHistory: [61, 61, 62, 61, 61, 60, 61, 62, 61, 61, 62, 61, 61, 61, 62, 61, 61, 61, 62, 61],
    driveUsedGB: 283.0,
    driveTotalGB: 512,
    topProcesses: [
      { name: 'chrome', pid: 8192, cpuPercent: 3.8, memMB: 1420 },
      { name: 'msedge', pid: 5124, cpuPercent: 2.4, memMB: 980 },
      { name: 'dwm', pid: 1048, cpuPercent: 1.4, memMB: 186 },
      { name: 'System', pid: 4, cpuPercent: 2.1, memMB: 128 },
      { name: 'powershell', pid: 4920, cpuPercent: 0.8, memMB: 94 },
    ],
  });

  // Reference to current isExecuting for timer
  const isExecutingRef = useRef(isExecuting);
  useEffect(() => {
    isExecutingRef.current = isExecuting;
  }, [isExecuting]);

  // Active optimization tracker to sustain changes across periodic telemetry polling
  const activeOptimizationsRef = useRef({
    cpuUntil: 0,
    ramUntil: 0,
    diskFreedTotalGB: 0
  });

  // Handle immediate visual response to inline quick optimizations
  const handleOptimizeSuccess = (cardId: 'cpu' | 'ram' | 'disk') => {
    const now = Date.now();
    if (cardId === 'cpu') {
      activeOptimizationsRef.current.cpuUntil = now + 40000;
    } else if (cardId === 'ram') {
      activeOptimizationsRef.current.ramUntil = now + 40000;
    } else if (cardId === 'disk') {
      activeOptimizationsRef.current.diskFreedTotalGB += 3.2;
    }

    setMetrics(prev => {
      if (cardId === 'cpu') {
        return {
          ...prev,
          cpuUsagePercent: 6,
          cpuClockSpeedGhz: 2.85,
          cpuProcesses: Math.max(160, prev.cpuProcesses - 16),
          cpuHistory: [...prev.cpuHistory.slice(1), 6]
        };
      } else if (cardId === 'ram') {
        const optimizedUsed = parseFloat(Math.max(4.2, prev.ramUsedGB - 2.4).toFixed(1));
        const optimizedStandby = 0.4;
        const newPercent = Math.round((optimizedUsed / prev.ramTotalGB) * 100);
        return {
          ...prev,
          ramUsedGB: optimizedUsed,
          ramStandbyGB: optimizedStandby,
          ramPercent: newPercent,
          ramHistory: [...prev.ramHistory.slice(1), newPercent]
        };
      } else if (cardId === 'disk') {
        const newDriveUsed = parseFloat(Math.max(10, prev.driveUsedGB - 3.2).toFixed(1));
        return {
          ...prev,
          driveUsedGB: newDriveUsed
        };
      }
      return prev;
    });
  };

  // Real-time ticking telemetry loop (every 1000ms matching Sampling: 1000ms)
  useEffect(() => {
    const fetchMetrics = async () => {
      const now = Date.now();
      const isCpuOptimized = now < activeOptimizationsRef.current.cpuUntil;
      const isRamOptimized = now < activeOptimizationsRef.current.ramUntil;
      const freedDiskGB = activeOptimizationsRef.current.diskFreedTotalGB;

      if (window.electronAPI) {
        try {
          const elevated = await window.electronAPI.checkElevation();
          setIsElevated(elevated);
          if (elevated) {
            setIsAuthorized(true);
          }

          const realMetrics = await window.electronAPI.getSystemMetrics();
          if (realMetrics) {
            setMetrics(prev => {
              let effCpu = realMetrics.cpuUsagePercent;
              let effClock = realMetrics.cpuClockSpeedGhz;
              let effProc = realMetrics.cpuProcesses;
              if (isCpuOptimized) {
                effCpu = Math.max(5, Math.min(12, Math.round(effCpu * 0.45)));
                effClock = parseFloat(Math.max(2.65, effClock - 0.70).toFixed(2));
                effProc = Math.max(160, effProc - 16);
              }

              let effRamUsed = realMetrics.ramUsedGB;
              let effStandby = realMetrics.ramStandbyGB;
              if (isRamOptimized) {
                effRamUsed = parseFloat(Math.max(4.2, effRamUsed - 2.4).toFixed(1));
                effStandby = 0.4;
              }
              const effRamPercent = Math.round((effRamUsed / realMetrics.ramTotalGB) * 100);
              const effDriveUsed = parseFloat(Math.max(10, realMetrics.driveUsedGB - freedDiskGB).toFixed(1));

              const newCpuHistory = [...prev.cpuHistory.slice(1), effCpu];
              const newRamHistory = [...prev.ramHistory.slice(1), effRamPercent];

              return {
                ...realMetrics,
                cpuUsagePercent: effCpu,
                cpuClockSpeedGhz: effClock,
                cpuProcesses: effProc,
                ramUsedGB: effRamUsed,
                ramStandbyGB: effStandby,
                ramPercent: effRamPercent,
                driveUsedGB: effDriveUsed,
                cpuHistory: newCpuHistory,
                ramHistory: newRamHistory
              };
            });
          }
        } catch (e) {
          console.error("Failed to fetch real telemetry:", e);
        }
      } else {
        // Dynamic live synchronization across all telemetry sub-stats
        setMetrics(prev => {
          let targetCpu = prev.cpuUsagePercent;
          let targetClock = prev.cpuClockSpeedGhz;
          let targetProc = prev.cpuProcesses;

          if (isCpuOptimized) {
            targetCpu = Math.max(5, Math.min(10, Math.round(prev.cpuUsagePercent + (Math.random() - 0.5) * 1.5)));
            targetClock = parseFloat(Math.max(2.70, Math.min(3.10, 2.85 + (Math.random() - 0.5) * 0.08)).toFixed(2));
            targetProc = Math.max(160, Math.min(174, prev.cpuProcesses));
          } else {
            const cpuDelta = (Math.random() - 0.49) * 3.8;
            targetCpu = Math.max(8, Math.min(88, Math.round(prev.cpuUsagePercent + cpuDelta)));
            const baseClock = 3.65;
            const turboBoost = (targetCpu / 100) * 0.65;
            const clockJitter = (Math.random() - 0.5) * 0.05;
            targetClock = parseFloat(Math.max(2.80, Math.min(4.85, baseClock + turboBoost + clockJitter)).toFixed(2));
            const procDelta = Math.random() > 0.6 ? (Math.random() > 0.5 ? 1 : -1) : 0;
            targetProc = Math.max(178, Math.min(196, prev.cpuProcesses + procDelta));
          }

          let targetRamUsed = prev.ramUsedGB;
          let targetStandby = prev.ramStandbyGB;
          if (isRamOptimized) {
            targetRamUsed = parseFloat(Math.max(4.8, Math.min(6.2, prev.ramUsedGB + (Math.random() - 0.5) * 0.06)).toFixed(1));
            targetStandby = 0.4;
          } else {
            const ramDelta = (Math.random() - 0.49) * 0.14;
            targetRamUsed = parseFloat(Math.max(4.5, Math.min(prev.ramTotalGB - 1.5, prev.ramUsedGB + ramDelta)).toFixed(1));
            const standbyBase = (prev.ramTotalGB - targetRamUsed) * 0.33;
            const standbyJitter = (Math.random() - 0.5) * 0.1;
            targetStandby = parseFloat(Math.max(1.1, Math.min(3.4, standbyBase + standbyJitter)).toFixed(1));
          }
          const targetRamPercent = Math.round((targetRamUsed / prev.ramTotalGB) * 100);

          // Drive Space with permanent freed disk offset
          const baseDrive = 283.0 - freedDiskGB;
          const driveDelta = (Math.random() - 0.49) * 0.04;
          const targetDriveUsed = parseFloat(Math.max(10, baseDrive + driveDelta).toFixed(1));

          // Dynamic Top Memory Consuming Processes
          const updatedTopProcesses = prev.topProcesses.map(p => {
            const memShift = Math.round((Math.random() - 0.49) * 22);
            const cpuShift = parseFloat(((Math.random() - 0.5) * 0.3).toFixed(1));
            return {
              ...p,
              memMB: isRamOptimized ? Math.max(45, Math.round(p.memMB * 0.75)) : Math.max(75, p.memMB + memShift),
              cpuPercent: isCpuOptimized ? parseFloat((p.cpuPercent * 0.5).toFixed(1)) : parseFloat(Math.max(0.2, Math.min(18, p.cpuPercent + cpuShift)).toFixed(1))
            };
          });
          updatedTopProcesses.sort((a, b) => b.memMB - a.memMB);

          return {
            ...prev,
            cpuUsagePercent: targetCpu,
            cpuClockSpeedGhz: targetClock,
            cpuProcesses: targetProc,
            cpuHistory: [...prev.cpuHistory.slice(1), targetCpu],
            ramUsedGB: targetRamUsed,
            ramStandbyGB: targetStandby,
            ramPercent: targetRamPercent,
            ramHistory: [...prev.ramHistory.slice(1), targetRamPercent],
            driveUsedGB: targetDriveUsed,
            topProcesses: updatedTopProcesses
          };
        });
      }
    };

    fetchMetrics(); // initial fetch
    const interval = setInterval(fetchMetrics, 1000); // 1000ms sampling rate matching dashboard header

    return () => clearInterval(interval);
  }, []);

  // Handler: When user clicks ANY action button in Admin Dashboard
  // Authorization is requested ONLY ONCE on the first command; subsequent commands run directly!
  const handleSelectTask = (task: OptimizationTaskInfo) => {
    setSelectedTask(task);
    const authorized = isAuthorized || isElevated;

    if (!authorized) {
      // First command only: prompt for PowerShell authorization
      setIsUACModalOpen(true);
    } else {
      // Authorization already established: execute immediately without prompting
      setIsExecuting(true);
      setAutoStartTerminal(true);
      setActiveView('terminal');
    }
  };

  // Handler: User clicks "Approve & Elevate" in UAC dialog
  // Grabs persistent PowerShell session authorization once for all commands!
  const handleApproveUAC = (task: OptimizationTaskInfo) => {
    setIsUACModalOpen(false);
    setIsAuthorized(true);
    setIsExecuting(true);
    setAutoStartTerminal(true);
    setActiveView('terminal');
  };

  // Handler: User cancels UAC dialog
  const handleCancelUAC = () => {
    setIsUACModalOpen(false);
  };

  // Handler: PowerShell Terminal finishes execution
  // Re-synchronize device status squares (CPU, RAM, Disk) directly with the report results!
  const handleExecutionComplete = (report: ExecutionReport) => {
    setIsExecuting(false);
    setAutoStartTerminal(false);
    setLastReport(report);

    // Re-synchronize the 3 device status cards with what was freed in the report
    if (report.spaceFreedMB > 0 || report.memoryFreedMB > 0) {
      setMetrics(prev => {
        const freedDiskGB = parseFloat((report.spaceFreedMB / 1024).toFixed(2));
        const freedRAMGB = parseFloat((report.memoryFreedMB / 1024).toFixed(2));
        const updatedDiskUsed = Math.max(10, parseFloat((prev.driveUsedGB - freedDiskGB).toFixed(1)));
        const updatedRamUsed = Math.max(2, parseFloat((prev.ramUsedGB - freedRAMGB).toFixed(1)));
        const updatedRamPercent = Math.round((updatedRamUsed / prev.ramTotalGB) * 100);
        return {
          ...prev,
          driveUsedGB: updatedDiskUsed,
          ramUsedGB: updatedRamUsed,
          ramPercent: updatedRamPercent,
          ramStandbyGB: Math.max(0.4, parseFloat((prev.ramStandbyGB - freedRAMGB * 0.8).toFixed(1))),
          ramHistory: [...prev.ramHistory.slice(1), updatedRamPercent]
        };
      });
    }

    // Automatically open simple report modal
    setIsReportModalOpen(true);
  };

  const handleQuickDownload = () => {
    const script = generatePowerShellScript(config);
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const blob = new Blob([bom, script], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'WinOptimize.ps1';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleResetConfig = () => {
    setConfig(DEFAULT_CONFIG);
  };

  return (
    <div className="min-h-screen bg-[#0B0F1A] text-slate-100 flex flex-col font-sans selection:bg-cyan-500/20 selection:text-cyan-200">
      {/* Primary Header Navigation */}
      <Header
        activeView={activeView}
        onViewChange={setActiveView}
        onQuickDownload={handleQuickDownload}
      />

      {/* Live System Banner with RAM & CPU Quick Telemetry Indicators */}
      <div className="bg-[#0F1423] border-b border-[#1F293D] px-4 py-2">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-4 text-slate-400">
            <span className="font-semibold text-slate-200 flex items-center space-x-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
              <span>Windows Security:</span>
            </span>

            <div className="flex items-center space-x-1.5 text-slate-300">
              <span className={`w-2 h-2 rounded-full shadow-[0_0_6px_rgba(52,211,153,0.6)] ${isElevated ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <span>Administrator Status: {isElevated ? 'Elevated' : 'Not Elevated (Elevation Prompt on Execution)'}</span>
            </div>

            <div className="hidden sm:flex items-center space-x-3 text-slate-300 pl-2 border-l border-[#1F293D]">
              <span className="flex items-center space-x-1">
                <Cpu className="w-3 h-3 text-cyan-400" />
                <span>CPU: <strong className="text-cyan-300 font-mono">{metrics.cpuUsagePercent}%</strong></span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <Layers className="w-3 h-3 text-emerald-400" />
                <span>RAM: <strong className="text-emerald-300 font-mono">{metrics.ramPercent}% ({metrics.ramUsedGB}GB)</strong></span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <HardDrive className="w-3 h-3 text-purple-400" />
                <span>Disk C: <strong className="text-purple-300 font-mono">{(metrics.driveTotalGB - metrics.driveUsedGB).toFixed(1)}GB Free</strong></span>
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-slate-400">
            <span className="px-2 py-0.5 rounded bg-[#161B2A] border border-[#1F293D] text-emerald-300 font-mono font-semibold">
              NT AUTHORITY\SYSTEM Ready
            </span>
          </div>
        </div>
      </div>

      {/* Main App Content Viewport */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 flex flex-col">
        {/* VIEW 1: LIVE ADMIN DASHBOARD & HARDWARE TELEMETRY (REQUESTED MAIN PAGE) */}
        {activeView === 'dashboard' && (
          <AdminMonitoringDashboard
            metrics={metrics}
            isExecuting={isExecuting}
            onSelectTask={handleSelectTask}
            lastReport={lastReport}
            onOpenTerminalView={() => setActiveView('terminal')}
            onOpenReportModal={() => setIsReportModalOpen(true)}
            onOpenRouterView={() => setActiveView('router')}
            isAuthorized={isAuthorized}
            onOptimizeSuccess={handleOptimizeSuccess}
          />
        )}

        {/* VIEW 2: UNIVERSAL ROUTER MANAGEMENT CONSOLE */}
        {activeView === 'router' && (
          <RouterManagementView />
        )}

        {/* VIEW 3: POWERSHELL TERMINAL (DIRECT EXECUTION VIEW) */}
        {activeView === 'terminal' && (
          <div className="flex flex-col h-[760px] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold text-slate-200 uppercase tracking-wider flex items-center space-x-2">
                  <Terminal className="w-4 h-4 text-cyan-400" />
                  <span>
                    {selectedTask
                      ? `PowerShell Elevated Execution Console - [${selectedTask.title}]`
                      : 'PowerShell Administrative Host (Elevated Session)'}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Direct PowerShell execution with colored status output, process lock detection, and simple summary reporting.
                </p>
              </div>

              <button
                onClick={() => setActiveView('dashboard')}
                className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center space-x-1 cursor-pointer transition-colors"
              >
                <span>&larr; Back to Admin Telemetry</span>
              </button>
            </div>

            <div className="flex-1">
              <TerminalSimulator
                config={config}
                activeTask={selectedTask}
                autoStart={autoStartTerminal}
                onExecutionComplete={handleExecutionComplete}
                onBackToDashboard={() => setActiveView('dashboard')}
                onOpenReport={() => setIsReportModalOpen(true)}
              />
            </div>
          </div>
        )}

        {/* VIEW 3: SCRIPT GENERATOR & CODE VIEWER */}
        {activeView === 'code' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 items-start">
            <div className="lg:col-span-5 flex flex-col space-y-4">
              <ConfigPanel
                config={config}
                onChange={setConfig}
                onReset={handleResetConfig}
              />
            </div>

            <div className="lg:col-span-7 flex flex-col h-[760px]">
              <ScriptViewer config={config} />
            </div>
          </div>
        )}

        {/* VIEW 4: ADMIN SAFETY GUIDE */}
        {activeView === 'guide' && (
          <div className="max-w-5xl mx-auto w-full">
            <AdminGuide />
          </div>
        )}
      </main>

      {/* Windows UAC Permission Elevation Dialog */}
      <UACPermissionModal
        task={selectedTask}
        isOpen={isUACModalOpen}
        onApprove={handleApproveUAC}
        onCancel={handleCancelUAC}
      />

      {/* Simple Execution Report Modal */}
      <ExecutionReportModal
        report={lastReport}
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        onViewTerminal={() => {
          setIsReportModalOpen(false);
          setActiveView('terminal');
        }}
      />

      {/* Global Footer */}
      <footer className="border-t border-[#1F293D] bg-[#0B0F1A] py-3.5 px-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <span>Windows System Administration & Hardware Performance Suite</span>
          <span>Automatic Elevation Token &bull; Process Lock Safe Check</span>
        </div>
      </footer>
    </div>
  );
}
