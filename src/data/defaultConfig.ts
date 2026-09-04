import { ScriptConfig } from '../types';

export const DEFAULT_CONFIG: ScriptConfig = {
  cleanTempFiles: true,
  emptyRecycleBin: true,
  cleanPrefetch: true,
  cleanWindowsUpdateCache: true,
  cleanDeliveryOptimization: false,
  flushDnsCache: true,
  resetWinsockAndTcpIp: false, // Default false for safety (requires reboot)
  cleanChromeCache: true,
  cleanEdgeCache: true,
  cleanFirefoxCache: true,
  cleanBraveCache: true,
  restartPerformanceServices: true,
  adjustVisualEffects: true,
  visualEffectsPreset: 'balanced',
  createRestorePoint: true,
  dryRunMode: false,
  logToFile: false,
};

export interface ConfigPreset {
  id: string;
  name: string;
  tag: string;
  description: string;
  config: ScriptConfig;
}

export const PRESETS: ConfigPreset[] = [
  {
    id: 'safe-enterprise',
    name: 'Enterprise Safe (Recommended)',
    tag: 'Safe & Thorough',
    description: 'Cleans user/system temps, empties recycle bin, purges prefetch & update cache, flushes DNS, and safely cleans closed browsers.',
    config: { ...DEFAULT_CONFIG },
  },
  {
    id: 'deep-clean',
    name: 'Maximum Space Reclamation',
    tag: 'Aggressive',
    description: 'Enables delivery optimization purge, deep browser caches, performance visual effects, and maximum cleanup.',
    config: {
      ...DEFAULT_CONFIG,
      cleanDeliveryOptimization: true,
      visualEffectsPreset: 'performance',
    },
  },
  {
    id: 'network-gaming',
    name: 'Network & Low Latency',
    tag: 'Gaming & Diagnostics',
    description: 'Flushes DNS resolver, resets TCP/IP stack & Winsock catalog, and refreshes background performance services.',
    config: {
      ...DEFAULT_CONFIG,
      resetWinsockAndTcpIp: true,
      visualEffectsPreset: 'performance',
    },
  },
  {
    id: 'dry-run',
    name: 'Safe Audit / Dry-Run (WhatIf)',
    tag: 'Simulation Only',
    description: 'Simulates the entire script without deleting any files or making system modifications. Calculates estimated space savings.',
    config: {
      ...DEFAULT_CONFIG,
      dryRunMode: true,
      resetWinsockAndTcpIp: false,
    },
  },
];
