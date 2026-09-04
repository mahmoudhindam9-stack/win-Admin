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

  // Live Hardware Telemetry State
  const [isElevated, setIsElevated] = useState(false);
  const [metrics, setMetrics] = useState<HardwareMetrics>({
    cpuUsagePercent: 19,
    cpuClockSpeedGhz: 3.84,
    cpuThreads: 2842,
    cpuProcesses: 186,
    cpuHistory: [16, 18, 19, 21, 18, 17, 22, 19, 20, 18, 19, 17, 21, 23, 19, 18, 20, 19, 22, 19],
    ramUsedGB: 9.8,
    ramTotalGB: 16.0,
    ramStandbyGB: 3.2,
    ramPercent: 61,
    ramHistory: [61, 61, 62, 61, 61, 60, 61, 62, 61, 61, 62, 61, 61, 61, 62, 61, 61, 61, 62, 61],
    driveUsedGB: 284,
    driveTotalGB: 512,
    topProcesses: [
      { name: 'System', pid: 4, cpuPercent: 2.1, memMB: 128 },
      { name: 'powershell.exe', pid: 4920, cpuPercent: 0.8, memMB: 94 },
      { name: 'chrome.exe', pid: 8192, cpuPercent: 3.8, memMB: 1420 },
      { name: 'dwm.exe', pid: 1048, cpuPercent: 1.4, memMB: 186 },
      { name: 'SearchHost.exe', pid: 6312, cpuPercent: 0.5, memMB: 88 },
    ],
  });

  // Reference to current isExecuting for timer
  const isExecutingRef = useRef(isExecuting);
  useEffect(() => {
    isExecutingRef.current = isExecuting;
  }, [isExecuting]);

  // Real-time ticking telemetry loop (every 1000ms)
  useEffect(() => {
    const fetchMetrics = async () => {
      if (window.electronAPI) {
        try {
          const elevated = await window.electronAPI.checkElevation();
          setIsElevated(elevated);

          const realMetrics = await window.electronAPI.getSystemMetrics();
          if (realMetrics) {
            setMetrics(prev => {
              const newCpuHistory = [...prev.cpuHistory.slice(1), realMetrics.cpuUsagePercent];
              const newRamHistory = [...prev.ramHistory.slice(1), realMetrics.ramPercent];
              return {
                ...realMetrics,
                cpuHistory: newCpuHistory,
                ramHistory: newRamHistory
              };
            });
          }
        } catch (e) {
          console.error("Failed to fetch real telemetry:", e);
        }
      }
    };

    fetchMetrics(); // initial fetch
    const interval = setInterval(fetchMetrics, 2000); // 2s interval is gentler on real hardware

    return () => clearInterval(interval);
  }, []);

  // Handler: When user clicks ANY action button in Admin Dashboard
  // Strictly asks permission first, does NOT show raw scripts!
  const handleSelectTask = (task: OptimizationTaskInfo) => {
    setSelectedTask(task);
    setIsUACModalOpen(true);
  };

  // Handler: User clicks "Approve & Elevate" in UAC dialog
  // Directly accesses the PowerShell terminal and runs execution!
  const handleApproveUAC = (task: OptimizationTaskInfo) => {
    setIsUACModalOpen(false);
    setIsExecuting(true);
    setAutoStartTerminal(true);
    setActiveView('terminal');
  };

  // Handler: User cancels UAC dialog
  const handleCancelUAC = () => {
    setIsUACModalOpen(false);
  };

  // Handler: PowerShell Terminal finishes execution
  const handleExecutionComplete = (report: ExecutionReport) => {
    setIsExecuting(false);
    setAutoStartTerminal(false);
    setLastReport(report);

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
                <span>Disk C: <strong className="text-purple-300 font-mono">{(metrics.driveTotalGB - metrics.driveUsedGB)}GB Free</strong></span>
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
