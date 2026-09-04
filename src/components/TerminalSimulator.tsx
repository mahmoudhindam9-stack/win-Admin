import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  RotateCcw,
  ShieldCheck,
  Terminal as TerminalIcon,
  Pause,
  FastForward,
  CheckCircle2,
  ArrowLeft,
  FileText,
  Zap,
  Activity,
  Download
} from 'lucide-react';
import { ScriptConfig, TerminalLog, ExecutionSummary, OptimizationTaskInfo, ExecutionReport } from '../types';

interface TerminalSimulatorProps {
  config: ScriptConfig;
  activeTask?: OptimizationTaskInfo | null;
  autoStart?: boolean;
  onExecutionComplete?: (report: ExecutionReport) => void;
  onBackToDashboard?: () => void;
  onOpenReport?: () => void;
}

export const TerminalSimulator: React.FC<TerminalSimulatorProps> = ({
  config,
  activeTask = null,
  autoStart = false,
  onExecutionComplete,
  onBackToDashboard,
  onOpenReport,
}) => {
  const [logs, setLogs] = useState<TerminalLog[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState<number>(2); // Default fast 2x for smooth responsive experience
  const [browserRunningMock, setBrowserRunningMock] = useState(false);
  const [summary, setSummary] = useState<ExecutionSummary | null>(null);
  const [completedReport, setCompletedReport] = useState<ExecutionReport | null>(null);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const executionRef = useRef<{ cancel: boolean; pause: boolean }>({ cancel: false, pause: false });

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  const addLog = (type: TerminalLog['type'], text: string, detail?: string) => {
    const time = new Date().toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const newLog: TerminalLog = {
      id: Math.random().toString(36).substring(2, 9),
      type,
      text,
      timestamp: time,
      detail,
    };
    setLogs((prev) => [...prev, newLog]);
  };

  const sleep = (ms: number) => {
    const adjusted = Math.max(10, ms / speed);
    return new Promise((resolve) => setTimeout(resolve, adjusted));
  };

  const runSimulation = async (taskToRun: OptimizationTaskInfo | null = activeTask) => {
    if (isRunning) return;
    setIsRunning(true);
    setIsPaused(false);
    setProgress(0);
    setSummary(null);
    setCompletedReport(null);
    setLogs([]);
    executionRef.current = { cancel: false, pause: false };

    let freedMB = 0;
    let freedRAM = 0;
    let filesDeleted = 0;
    let completed = 0;
    let skipped = 0;
    let warnings = 0;
    let errors = 0;
    let skippedLocks = 0;
    const servicesRecycled: string[] = [];
    const networkActions: string[] = [];
    const detailedLogSummary: string[] = [];

    const startTime = Date.now();
    const taskId = taskToRun?.id || 'full';
    const taskTitle = taskToRun?.title || 'One-Click Full System Optimization';

    // PowerShell startup banner
    addLog('header', 'Windows PowerShell (x64) [Version 7.4.2]');
    addLog('header', 'Copyright (C) Microsoft Corporation. All rights reserved.');
    addLog('header', 'Loading elevated administrative session environment...');
    await sleep(150);

    const cmdStr = taskToRun
      ? taskToRun.commandPreview
      : 'powershell.exe -ExecutionPolicy Bypass -File .\\WinOptimize.ps1 -Elevated';

    addLog('command', `PS C:\\WINDOWS\\system32> ${cmdStr}`);
    await sleep(250);

    // Elevation verification
    addLog('info', 'Verifying security principal and elevation token...');
    await sleep(200);
    addLog('success', 'Security principal: S-1-5-32-544 (BUILTIN\\Administrators) High Mandatory Token');
    await sleep(200);

    addLog('header', '================================================================================');
    addLog('header', `  EXECUTING: ${taskTitle.toUpperCase()}`);
    addLog('header', '================================================================================');
    addLog('info', `Host System: Windows 11 Enterprise x64 [Build 22631.3296]`);
    addLog('info', `Administrative Context: NT AUTHORITY\\SYSTEM / Elevated Administrator`);
    addLog('success', `Safety Guardrails: In-Use Process Lock Protection ENABLED`);
    addLog('header', '--------------------------------------------------------------------------------');
    setProgress(15);
    await sleep(250);

    // TASK-SPECIFIC BRANCHING:
    if (taskId === 'temp' || taskId === 'full') {
      addLog('header', '>>> [MODULE: TEMPORARY FILES & STORAGE RECLAMATION]');
      
      addLog('info', 'Scanning User Temp directory: %LOCALAPPDATA%\\Temp...');
      await sleep(300);
      const uFiles = 1048;
      const uMB = 1280;
      filesDeleted += uFiles;
      freedMB += uMB;
      skippedLocks += 3;
      completed++;
      detailedLogSummary.push(`Purged User Temp (%LOCALAPPDATA%\\Temp): ${uFiles} files deleted (${uMB} MB freed, 3 active locks bypassed)`);
      addLog('success', `Cleaned User Temp: ${uFiles} files deleted (~${uMB} MB freed, 3 locked files safely preserved).`);

      await sleep(250);
      addLog('info', 'Scanning Windows System Temp directory: C:\\Windows\\Temp...');
      await sleep(250);
      const sFiles = 412;
      const sMB = 480;
      filesDeleted += sFiles;
      freedMB += sMB;
      skippedLocks += 1;
      completed++;
      detailedLogSummary.push(`Purged Windows System Temp (C:\\Windows\\Temp): ${sFiles} files deleted (${sMB} MB freed)`);
      addLog('success', `Cleaned Windows System Temp: ${sFiles} files deleted (~${sMB} MB freed).`);

      await sleep(250);
      addLog('info', 'Purging Windows Recycle Bin across all mounted fixed drives (C:, D:)...');
      await sleep(300);
      const binFiles = 382;
      const binMB = 820;
      filesDeleted += binFiles;
      freedMB += binMB;
      completed++;
      detailedLogSummary.push(`Emptied Windows Recycle Bin across all drives: ${binFiles} items removed (${binMB} MB freed)`);
      addLog('success', `Recycle Bin successfully emptied: ${binFiles} items permanently deleted (~${binMB} MB freed).`);

      await sleep(200);
      addLog('info', 'Scanning Windows Prefetch folder (C:\\Windows\\Prefetch)...');
      await sleep(250);
      const pfFiles = 142;
      const pfMB = 125;
      filesDeleted += pfFiles;
      freedMB += pfMB;
      completed++;
      detailedLogSummary.push(`Cleaned Prefetch cache: ${pfFiles} files removed (${pfMB} MB freed, layout.ini & ReadyBoot intact)`);
      addLog('success', `Cleaned Prefetch: ${pfFiles} stale traces deleted (~${pfMB} MB freed, boot layout.ini protected).`);

      setProgress(taskId === 'temp' ? 85 : 40);
    }

    if (taskId === 'ram' || taskId === 'full') {
      addLog('header', '>>> [MODULE: MEMORY CACHE & SYSMAIN RECYCLING]');
      addLog('info', 'Querying Windows Virtual Memory subsystem and Standby List...');
      await sleep(300);
      
      const ramReleasedMB = 680;
      freedRAM += ramReleasedMB;
      addLog('success', `Flushed Windows Standby Page List: ${ramReleasedMB} MB cached memory returned to Free pool.`);

      await sleep(250);
      addLog('info', 'Recycling SysMain (SuperFetch) memory indexing service...');
      await sleep(300);
      servicesRecycled.push('SysMain (SuperFetch)');
      completed++;
      detailedLogSummary.push(`Flushed Standby Memory List & recycled SysMain service (${ramReleasedMB} MB RAM freed)`);
      addLog('success', 'SysMain service stopped, stale page index flushed, and service restarted successfully.');

      setProgress(taskId === 'ram' ? 85 : 55);
    }

    if (taskId === 'dns' || taskId === 'full') {
      addLog('header', '>>> [MODULE: DNS RESOLVER & NETWORK STACK]');
      addLog('info', 'Executing Clear-DnsClientCache cmdlet...');
      await sleep(250);
      networkActions.push('Clear-DnsClientCache (Resolver Flushed)');
      completed++;
      addLog('success', 'Clear-DnsClientCache: Local DNS resolver cache flushed successfully.');

      await sleep(200);
      addLog('info', 'Executing ipconfig /flushdns...');
      await sleep(200);
      networkActions.push('ipconfig /flushdns (Windows IP Configuration updated)');
      detailedLogSummary.push('Flushed DNS client cache and refreshed local resolver socket cache');
      addLog('success', 'Windows IP Configuration: Successfully flushed the DNS Resolver Cache.');

      setProgress(taskId === 'dns' ? 85 : 70);
    }

    if (taskId === 'browser' || taskId === 'full') {
      addLog('header', '>>> [MODULE: INACTIVE BROWSER CACHES]');
      addLog('info', 'Scanning active processes for Google Chrome, Microsoft Edge, Firefox, Brave...');
      await sleep(300);

      if (browserRunningMock) {
        addLog('warning', 'Active browser detected (chrome.exe). Skipped to prevent SQLite database corruption.');
        warnings++;
        skipped++;
        detailedLogSummary.push('Google Chrome: Active process detected, safely skipped to protect user SQLite profile');
      } else {
        addLog('info', 'Verifying Chrome & Edge processes are idle/closed...');
        await sleep(250);
        const bFiles = 840;
        const bMB = 920;
        filesDeleted += bFiles;
        freedMB += bMB;
        completed++;
        detailedLogSummary.push(`Purged Chrome & Edge Web Caches: ${bFiles} cache objects deleted (${bMB} MB freed)`);
        addLog('success', `Browser Caches: Purged ${bFiles} cached objects across Chrome & Edge (~${bMB} MB freed).`);
      }

      setProgress(taskId === 'browser' ? 85 : 85);
    }

    if (taskId === 'update' || taskId === 'full') {
      addLog('header', '>>> [MODULE: WINDOWS UPDATE CACHE]');
      addLog('info', 'Temporarily pausing Windows Update (wuauserv) and BITS background services...');
      await sleep(350);
      addLog('success', 'Services paused safely.');

      addLog('info', 'Purging obsolete installer packages in C:\\Windows\\SoftwareDistribution\\Download...');
      await sleep(400);
      const wuFiles = 210;
      const wuMB = 1240;
      filesDeleted += wuFiles;
      freedMB += wuMB;
      completed++;
      detailedLogSummary.push(`Purged Windows Update Cache (SoftwareDistribution\\Download): ${wuFiles} packages deleted (${wuMB} MB freed)`);
      addLog('success', `SoftwareDistribution cleaned: ${wuFiles} orphaned files deleted (~${wuMB} MB freed).`);

      addLog('info', 'Restarting Windows Update (wuauserv) and BITS services in guaranteed finally block...');
      await sleep(300);
      servicesRecycled.push('wuauserv (Windows Update)', 'bits (Background Transfer)');
      addLog('success', 'Windows Update & BITS services verified running and healthy.');

      setProgress(taskId === 'update' ? 85 : 95);
    }

    if (taskId === 'router_config') {
      addLog('header', '>>> [MODULE: UNIVERSAL ROUTER MANAGEMENT & GATEWAY DISCOVERY]');
      addLog('info', 'Querying local network routing table for default gateway (Get-NetRoute)...');
      await sleep(250);
      networkActions.push('Get-NetRoute (Gateway Discovered: 192.168.1.1)');
      completed++;
      addLog('success', 'Detected active local gateway interface on NextHop: 192.168.1.1.');

      await sleep(250);
      addLog('info', 'Connecting to router management API endpoint...');
      await sleep(250);
      addLog('success', 'Router session established: Security token validated.');

      await sleep(300);
      addLog('info', 'Dispatching wireless configuration payload (SSID, WPA3/WPA2, Channel, Radio Daemon)...');
      await sleep(350);
      networkActions.push('Committed wireless configuration payload to NVRAM/UCI');
      completed++;
      addLog('success', 'Router NVRAM/UCI write successful: All wireless settings committed.');

      await sleep(250);
      addLog('info', 'Issuing wireless subsystem daemon reload command...');
      await sleep(300);
      servicesRecycled.push('Router hostapd & wireless radio subsystem');
      completed++;
      detailedLogSummary.push('Successfully applied new wireless parameters and verified router state via native API');
      addLog('success', 'Router reports wireless radio reload complete. Wi-Fi broadcast active.');

      setProgress(85);
    }

    // Final Report Generation
    setProgress(100);
    await sleep(300);

    const durationSeconds = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));

    addLog('header', '================================================================================');
    addLog('header', '                         OPTIMIZATION REPORT SUMMARY                            ');
    addLog('header', '================================================================================');
    addLog('metric', `STATUS:                 SUCCESS (All requested operations verified)`);
    addLog('metric', `TOTAL FILES DELETED:    ${filesDeleted.toLocaleString()} files`);
    addLog('metric', `STORAGE SPACE RECLAIMED: ${freedMB > 1024 ? (freedMB / 1024).toFixed(2) + ' GB' : freedMB + ' MB'}`);
    if (freedRAM > 0) {
      addLog('metric', `STANDBY RAM RELEASED:   ${freedRAM} MB RAM`);
    }
    addLog('metric', `SAFE IN-USE LOCKS:      ${skippedLocks} files preserved without crash`);
    addLog('metric', `EXECUTION DURATION:     ${durationSeconds} seconds`);
    addLog('header', '================================================================================');
    addLog('info', 'PS C:\\WINDOWS\\system32> [Script finished with exit code 0]');

    const execSummary: ExecutionSummary = {
      tempFilesCleanedMB: Math.round(freedMB * 0.6),
      browserCacheCleanedMB: Math.round(freedMB * 0.2),
      updateCacheCleanedMB: Math.round(freedMB * 0.2),
      totalSpaceFreedMB: freedMB,
      tasksCompleted: completed,
      tasksSkipped: skipped,
      warningsCount: warnings,
      errorsCount: errors,
      durationSeconds,
      rebootRecommended: false,
    };
    setSummary(execSummary);

    const report: ExecutionReport = {
      taskId,
      taskTitle,
      timestamp: new Date().toLocaleTimeString(),
      durationSeconds,
      success: true,
      filesDeleted,
      spaceFreedMB: freedMB,
      memoryFreedMB: freedRAM,
      servicesRecycled,
      networkActions,
      lockedFilesSkipped: skippedLocks,
      detailedLogSummary,
    };
    setCompletedReport(report);
    setIsRunning(false);

    if (onExecutionComplete) {
      onExecutionComplete(report);
    }
  };

  // Auto-start when triggered by UAC approval
  useEffect(() => {
    if (autoStart && activeTask && !isRunning) {
      runSimulation(activeTask);
    }
  }, [autoStart, activeTask]);

  const clearTerminal = () => {
    setLogs([]);
    setSummary(null);
    setCompletedReport(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#0B0F1A] border border-[#1F293D] rounded-xl overflow-hidden shadow-2xl font-mono text-xs">
      {/* Terminal Title Bar */}
      <div className="bg-[#0F1423] px-4 py-2.5 border-b border-[#1F293D] flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-3">
          {onBackToDashboard && (
            <button
              onClick={onBackToDashboard}
              className="px-2.5 py-1 bg-[#161B2A] hover:bg-[#1E293B] text-slate-300 hover:text-white rounded-md text-xs font-sans font-semibold border border-[#1F293D] flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5 text-cyan-400" />
              <span>Back to Admin Monitor</span>
            </button>
          )}

          <div className="flex items-center space-x-1.5">
            <div className="w-3 h-3 rounded-full bg-rose-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
          </div>

          <div className="flex items-center space-x-2 text-slate-300 font-sans font-semibold text-xs ml-2">
            <TerminalIcon className="w-3.5 h-3.5 text-cyan-400" />
            <span>
              {activeTask
                ? `Administrator: PowerShell - [${activeTask.title}]`
                : 'Administrator: Windows PowerShell (Elevated)'}
            </span>
          </div>
        </div>

        {/* Action controls */}
        <div className="flex items-center space-x-2">
          {/* Speed Toggle */}
          <div className="flex items-center space-x-1 bg-[#161B2A] p-0.5 rounded-lg border border-[#1F293D] text-[10px]">
            <button
              onClick={() => setSpeed(1)}
              className={`px-1.5 py-0.5 rounded ${speed === 1 ? 'bg-[#0284C7] text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              title="Normal speed"
            >
              1x
            </button>
            <button
              onClick={() => setSpeed(2)}
              className={`px-1.5 py-0.5 rounded ${speed === 2 ? 'bg-[#0284C7] text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              title="Fast speed"
            >
              2x
            </button>
            <button
              onClick={() => setSpeed(5)}
              className={`px-1.5 py-0.5 rounded ${speed === 5 ? 'bg-[#0284C7] text-white font-bold' : 'text-slate-400 hover:text-slate-200'}`}
              title="Instant speed"
            >
              5x
            </button>
          </div>

          {/* Run button if not running */}
          {!isRunning ? (
            <button
              id="run-terminal-simulation-btn"
              onClick={() => runSimulation(activeTask)}
              className="px-3 py-1 bg-gradient-to-r from-[#0284C7] to-[#2563EB] hover:from-[#0369A1] hover:to-[#1D4ED8] text-white rounded-lg text-xs font-sans font-bold flex items-center space-x-1.5 transition-all cursor-pointer shadow-sm"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>{logs.length > 0 ? 'Re-Run Command' : 'Execute Command'}</span>
            </button>
          ) : (
            <div className="px-3 py-1 bg-cyan-950/60 border border-cyan-700/60 text-cyan-300 rounded-lg text-xs flex items-center space-x-1.5 font-sans font-semibold">
              <Activity className="w-3.5 h-3.5 animate-spin text-cyan-400" />
              <span>PowerShell Executing...</span>
            </div>
          )}

          {completedReport && onOpenReport && (
            <button
              onClick={onOpenReport}
              className="px-3 py-1 bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-700/60 rounded-lg text-xs font-sans font-bold flex items-center space-x-1.5 transition-colors cursor-pointer"
            >
              <FileText className="w-3 h-3 text-emerald-400" />
              <span>View Report Card</span>
            </button>
          )}

          <button
            id="clear-terminal-logs-btn"
            onClick={clearTerminal}
            disabled={isRunning}
            title="Clear Console Output"
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-[#1E293B] disabled:opacity-40 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Progress Bar when running */}
      {isRunning && (
        <div className="h-1 w-full bg-[#0B0F1A] overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#0284C7] via-[#06B6D4] to-[#10B981] transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Execution Alert Banner if finished */}
      {completedReport && (
        <div className="bg-[#0C243C] border-b border-[#0284C7]/40 px-4 py-2 flex flex-wrap items-center justify-between gap-2 font-sans text-xs">
          <div className="flex items-center space-x-2 text-slate-200">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>
              <strong>{completedReport.taskTitle}</strong> completed in {completedReport.durationSeconds}s:
            </span>
            <span className="text-emerald-300 font-semibold font-mono">
              {completedReport.filesDeleted.toLocaleString()} files deleted
            </span>
            <span>•</span>
            <span className="text-cyan-300 font-semibold font-mono">
              {completedReport.spaceFreedMB > 1024
                ? (completedReport.spaceFreedMB / 1024).toFixed(2) + ' GB'
                : completedReport.spaceFreedMB + ' MB'} freed
            </span>
          </div>

          <div className="flex items-center space-x-2">
            {onOpenReport && (
              <button
                onClick={onOpenReport}
                className="px-2.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] transition-colors cursor-pointer"
              >
                Open Simple Report Modal
              </button>
            )}
            {onBackToDashboard && (
              <button
                onClick={onBackToDashboard}
                className="px-2.5 py-0.5 rounded bg-[#161B2A] hover:bg-[#1E293B] text-slate-300 text-[11px] border border-[#1F293D] transition-colors cursor-pointer"
              >
                Return to Live Dashboard
              </button>
            )}
          </div>
        </div>
      )}

      {/* Terminal Content Screen */}
      <div className="flex-1 p-4 overflow-y-auto text-xs leading-relaxed space-y-1 select-text bg-[#080B12]">
        {logs.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-slate-500 py-16 space-y-3 font-sans">
            <TerminalIcon className="w-12 h-12 text-slate-700 animate-pulse" />
            <div className="text-center max-w-md">
              <p className="font-semibold text-slate-300">
                {activeTask ? `Ready to execute ${activeTask.title}` : 'PowerShell Terminal Ready'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Click <strong>Execute Command</strong> to start elevated PowerShell automation.
              </p>
            </div>
            <button
              onClick={() => runSimulation(activeTask)}
              className="mt-2 px-4 py-2 bg-[#0F1423] border border-[#1F293D] hover:border-cyan-500/50 text-cyan-400 hover:text-cyan-300 rounded-lg text-xs font-semibold transition-all flex items-center space-x-2 cursor-pointer shadow-sm"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>Launch Execution Now</span>
            </button>
          </div>
        )}

        {logs.map((log) => {
          let textClass = 'text-slate-300';
          let tagClass = 'text-slate-400';

          if (log.type === 'header') {
            textClass = 'text-cyan-400 font-bold';
          } else if (log.type === 'command') {
            textClass = 'text-amber-300 font-semibold';
          } else if (log.type === 'success') {
            tagClass = 'text-emerald-400 font-bold';
            textClass = 'text-emerald-200';
          } else if (log.type === 'warning') {
            tagClass = 'text-amber-400 font-bold';
            textClass = 'text-amber-200';
          } else if (log.type === 'error') {
            tagClass = 'text-rose-400 font-bold';
            textClass = 'text-rose-200';
          } else if (log.type === 'metric') {
            textClass = 'text-emerald-300 font-mono font-medium';
          } else if (log.type === 'info') {
            tagClass = 'text-sky-400';
            textClass = 'text-slate-300';
          }

          if (log.type === 'header' || log.type === 'command') {
            return (
              <div key={log.id} className={`${textClass} whitespace-pre-wrap`}>
                {log.text}
              </div>
            );
          }

          return (
            <div key={log.id} className="flex items-start space-x-2 font-mono">
              <span className="text-slate-600 select-none">[{log.timestamp}]</span>
              <span className={`select-none ${tagClass}`}>[{log.type.toUpperCase()}]</span>
              <span className={`${textClass} flex-1`}>{log.text}</span>
            </div>
          );
        })}
        <div ref={terminalEndRef} />
      </div>

      {/* Terminal Footer Summary Bar */}
      {summary && (
        <div className="px-4 py-2.5 bg-[#0F1423] border-t border-[#1F293D] flex flex-wrap items-center justify-between gap-3 text-xs font-sans">
          <div className="flex items-center space-x-2 text-emerald-400 font-semibold">
            <CheckCircle2 className="w-4 h-4" />
            <span>PowerShell Exit Code 0 &bull; Completed ({summary.durationSeconds}s)</span>
          </div>

          <div className="flex items-center space-x-4 text-slate-300 font-mono">
            <div>
              <span className="text-slate-500 font-sans">Total Freed: </span>
              <span className="font-bold text-cyan-400">
                {(summary.totalSpaceFreedMB / 1024).toFixed(2)} GB
              </span>
            </div>
            <div>
              <span className="text-slate-500 font-sans">Tasks Completed: </span>
              <span className="font-bold text-emerald-400">{summary.tasksCompleted}</span>
            </div>
            <div>
              <span className="text-slate-500 font-sans">Safely Skipped: </span>
              <span className="font-bold text-amber-400">{summary.tasksSkipped}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
