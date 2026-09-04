export interface ScriptConfig {
  cleanTempFiles: boolean;
  emptyRecycleBin: boolean;
  cleanPrefetch: boolean;
  cleanWindowsUpdateCache: boolean;
  cleanDeliveryOptimization: boolean;
  flushDnsCache: boolean;
  resetWinsockAndTcpIp: boolean;
  cleanChromeCache: boolean;
  cleanEdgeCache: boolean;
  cleanFirefoxCache: boolean;
  cleanBraveCache: boolean;
  restartPerformanceServices: boolean;
  adjustVisualEffects: boolean;
  optimizeCPU: boolean;
  visualEffectsPreset: 'performance' | 'balanced' | 'appearance';
  createRestorePoint: boolean;
  dryRunMode: boolean;
  logToFile: boolean;
}

export type OptimizationTaskId =
  | 'full'
  | 'temp'
  | 'dns'
  | 'browser'
  | 'ram'
  | 'update'
  | 'cpu'
  | 'router_config';

export interface OptimizationTaskInfo {
  id: OptimizationTaskId;
  title: string;
  shortDesc: string;
  icon: string;
  riskLevel: 'Safe' | 'Low' | 'Requires Reboot';
  elevationScope: string[];
  commandPreview: string;
}

export interface HardwareMetrics {
  cpuUsagePercent: number;
  cpuClockSpeedGhz: number;
  cpuThreads: number;
  cpuProcesses: number;
  cpuHistory: number[];
  ramUsedGB: number;
  ramTotalGB: number;
  ramStandbyGB: number;
  ramPercent: number;
  ramHistory: number[];
  driveUsedGB: number;
  driveTotalGB: number;
  topProcesses: { name: string; pid: number; cpuPercent: number; memMB: number }[];
}

export interface ExecutionReport {
  taskId: OptimizationTaskId;
  taskTitle: string;
  timestamp: string;
  durationSeconds: number;
  success: boolean;
  filesDeleted: number;
  spaceFreedMB: number;
  memoryFreedMB: number;
  servicesRecycled: string[];
  networkActions: string[];
  lockedFilesSkipped: number;
  detailedLogSummary: string[];
}

export interface TerminalLog {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'header' | 'metric' | 'command';
  text: string;
  timestamp: string;
  detail?: string;
}

export interface ExecutionSummary {
  tempFilesCleanedMB: number;
  browserCacheCleanedMB: number;
  updateCacheCleanedMB: number;
  totalSpaceFreedMB: number;
  tasksCompleted: number;
  tasksSkipped: number;
  warningsCount: number;
  errorsCount: number;
  durationSeconds: number;
  rebootRecommended: boolean;
}

type UpdateStatusCallback = (data: {
  type: 'checking' | 'available' | 'progress' | 'downloaded' | 'not-available' | 'error';
  version?: string;
  releaseDate?: string | null;
  releaseName?: string | null;
  percent?: number;
  transferred?: number;
  total?: number;
  bytesPerSecond?: number;
  message?: string;
}) => void;

declare global {
  interface Window {
    electronAPI?: {
      getSystemMetrics: () => Promise<HardwareMetrics>;
      checkElevation: () => Promise<boolean>;
      runOptimizationTask: (taskId: OptimizationTaskId, config: ScriptConfig, elevate: boolean) => Promise<{ success: boolean; exitCode: number; stdout: string; stderr: string; error?: string }>;
      onExecutionProgress: (callback: (data: { type: 'stdout' | 'stderr'; data: string }) => void) => () => void;
      routerApi: (action: string, data?: any) => Promise<any>;
      checkForUpdate: () => Promise<{ success: boolean; reason?: string; error?: string; updateInfo?: { version?: string } | null }>;
      downloadUpdate: () => Promise<{ success: boolean; error?: string }>;
      installUpdate: () => Promise<{ success: boolean; reason?: string; error?: string }>;
      getAppVersion: () => Promise<string>;
      onUpdateStatus: (callback: UpdateStatusCallback) => () => void;
    };
  }
}

export {};