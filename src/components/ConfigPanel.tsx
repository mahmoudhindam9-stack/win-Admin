import React from 'react';
import {
  HardDrive,
  Wifi,
  Globe,
  Sliders,
  ShieldCheck,
  RotateCcw,
  Sparkles,
  Info,
  Check,
  AlertTriangle,
} from 'lucide-react';
import { ScriptConfig } from '../types';
import { PRESETS } from '../data/defaultConfig';

interface ConfigPanelProps {
  config: ScriptConfig;
  onChange: (newConfig: ScriptConfig) => void;
  onReset: () => void;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({ config, onChange, onReset }) => {
  const handleToggle = (key: keyof ScriptConfig) => {
    onChange({
      ...config,
      [key]: !config[key],
    });
  };

  const handleVisualPreset = (preset: 'performance' | 'balanced' | 'appearance') => {
    onChange({
      ...config,
      adjustVisualEffects: true,
      visualEffectsPreset: preset,
    });
  };

  return (
    <div className="bg-[#161B2A] border border-[#1F293D] rounded-xl p-5 shadow-xl shadow-black/25 flex flex-col space-y-5 font-sans">
      {/* Preset Selector Header */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Optimization Profile Presets
            </span>
          </div>
          <button
            onClick={onReset}
            className="text-xs text-slate-400 hover:text-slate-200 flex items-center space-x-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset Defaults</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PRESETS.map((p) => {
            const isSelected =
              config.dryRunMode === p.config.dryRunMode &&
              config.resetWinsockAndTcpIp === p.config.resetWinsockAndTcpIp &&
              config.visualEffectsPreset === p.config.visualEffectsPreset &&
              config.cleanDeliveryOptimization === p.config.cleanDeliveryOptimization;

            return (
              <button
                key={p.id}
                onClick={() => onChange({ ...p.config })}
                className={`p-2.5 rounded-lg text-left border transition-all text-xs flex flex-col justify-between cursor-pointer ${
                  isSelected
                    ? 'bg-[#0C243C] border-[#0284C7] text-white ring-1 ring-[#0284C7]/60 shadow-sm'
                    : 'bg-[#0F1423] border-[#1F293D] text-slate-300 hover:bg-[#1A2234] hover:border-[#2D3A54]'
                }`}
              >
                <div>
                  <div className="font-semibold text-slate-100">{p.name}</div>
                  <div className="text-[10px] text-cyan-400 font-medium mt-0.5">{p.tag}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 1: System Cleanup & Temp Removal */}
      <div className="border-t border-[#1F293D] pt-4">
        <div className="flex items-center space-x-2 mb-3 text-slate-200">
          <HardDrive className="w-4 h-4 text-emerald-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            1. System Cleanup & Temp Removal
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
          <label className="flex items-start space-x-2.5 p-2.5 bg-[#0F1423]/80 hover:bg-[#0F1423] border border-[#1F293D] hover:border-[#2D3A54] rounded-lg cursor-pointer transition-all">
            <input
              type="checkbox"
              checked={config.cleanTempFiles}
              onChange={() => handleToggle('cleanTempFiles')}
              className="mt-0.5 rounded border-[#2D3A54] text-cyan-500 focus:ring-cyan-500 bg-[#0B0F1A]"
            />
            <div>
              <div className="font-medium text-slate-200">User & Windows Temp Folders</div>
              <div className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                Cleans <code className="text-cyan-300 font-mono bg-[#0B0F1A] px-1 py-0.5 rounded border border-[#1F293D]">%TEMP%</code> and{' '}
                <code className="text-cyan-300 font-mono bg-[#0B0F1A] px-1 py-0.5 rounded border border-[#1F293D]">C:\Windows\Temp</code>. In-use locks safely skipped.
              </div>
            </div>
          </label>

          <label className="flex items-start space-x-2.5 p-2.5 bg-[#0F1423]/80 hover:bg-[#0F1423] border border-[#1F293D] hover:border-[#2D3A54] rounded-lg cursor-pointer transition-all">
            <input
              type="checkbox"
              checked={config.emptyRecycleBin}
              onChange={() => handleToggle('emptyRecycleBin')}
              className="mt-0.5 rounded border-[#2D3A54] text-cyan-500 focus:ring-cyan-500 bg-[#0B0F1A]"
            />
            <div>
              <div className="font-medium text-slate-200">Empty Recycle Bin Silently</div>
              <div className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                Clears recycled items across all mounted drives without popup prompts.
              </div>
            </div>
          </label>

          <label className="flex items-start space-x-2.5 p-2.5 bg-[#0F1423]/80 hover:bg-[#0F1423] border border-[#1F293D] hover:border-[#2D3A54] rounded-lg cursor-pointer transition-all">
            <input
              type="checkbox"
              checked={config.cleanPrefetch}
              onChange={() => handleToggle('cleanPrefetch')}
              className="mt-0.5 rounded border-[#2D3A54] text-cyan-500 focus:ring-cyan-500 bg-[#0B0F1A]"
            />
            <div>
              <div className="font-medium text-slate-200">Windows Prefetch Files</div>
              <div className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                Clears stale application launch traces while preserving essential boot layout files.
              </div>
            </div>
          </label>

          <label className="flex items-start space-x-2.5 p-2.5 bg-[#0F1423]/80 hover:bg-[#0F1423] border border-[#1F293D] hover:border-[#2D3A54] rounded-lg cursor-pointer transition-all">
            <input
              type="checkbox"
              checked={config.cleanWindowsUpdateCache}
              onChange={() => handleToggle('cleanWindowsUpdateCache')}
              className="mt-0.5 rounded border-[#2D3A54] text-cyan-500 focus:ring-cyan-500 bg-[#0B0F1A]"
            />
            <div>
              <div className="font-medium text-slate-200">Windows Update Download Cache</div>
              <div className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                Pauses <code className="text-cyan-300 font-mono bg-[#0B0F1A] px-1 py-0.5 rounded border border-[#1F293D]">wuauserv</code>, clears downloaded update installers, and restarts services safely.
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* SECTION 2: Network & DNS Optimization */}
      <div className="border-t border-[#1F293D] pt-4">
        <div className="flex items-center space-x-2 mb-3 text-slate-200">
          <Wifi className="w-4 h-4 text-sky-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            2. Network & DNS Optimization
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 text-xs">
          <label className="flex items-start space-x-2.5 p-2.5 bg-[#0F1423]/80 hover:bg-[#0F1423] border border-[#1F293D] hover:border-[#2D3A54] rounded-lg cursor-pointer transition-all">
            <input
              type="checkbox"
              checked={config.flushDnsCache}
              onChange={() => handleToggle('flushDnsCache')}
              className="mt-0.5 rounded border-[#2D3A54] text-cyan-500 focus:ring-cyan-500 bg-[#0B0F1A]"
            />
            <div>
              <div className="font-medium text-slate-200">Flush Local DNS Resolver Cache</div>
              <div className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                Executes <code className="text-cyan-300 font-mono bg-[#0B0F1A] px-1 py-0.5 rounded border border-[#1F293D]">Clear-DnsClientCache</code> &{' '}
                <code className="text-cyan-300 font-mono bg-[#0B0F1A] px-1 py-0.5 rounded border border-[#1F293D]">ipconfig /flushdns</code> to refresh domain records.
              </div>
            </div>
          </label>

          <label className={`flex items-start space-x-2.5 p-2.5 border rounded-lg cursor-pointer transition-all ${
            config.resetWinsockAndTcpIp ? 'bg-[#381A0B]/40 border-amber-600/70' : 'bg-[#0F1423]/80 border-[#1F293D] hover:bg-[#0F1423] hover:border-[#2D3A54]'
          }`}>
            <input
              type="checkbox"
              checked={config.resetWinsockAndTcpIp}
              onChange={() => handleToggle('resetWinsockAndTcpIp')}
              className="mt-0.5 rounded border-amber-600 text-amber-500 focus:ring-amber-500 bg-[#0B0F1A]"
            />
            <div>
              <div className="flex items-center space-x-1.5">
                <span className="font-medium text-slate-200">Reset Winsock & TCP/IP Stack</span>
                <span className="px-1.5 py-0.2 bg-amber-500/20 text-amber-300 text-[10px] rounded font-semibold border border-amber-500/30">
                  Requires Reboot
                </span>
              </div>
              <div className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                Resets socket catalog & IP stack (<code className="text-cyan-300 font-mono bg-[#0B0F1A] px-1 py-0.5 rounded border border-[#1F293D]">netsh winsock reset</code>). Ideal for resolving network corruption.
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* SECTION 3: Browser & Cache Maintenance */}
      <div className="border-t border-[#1F293D] pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2 text-slate-200">
            <Globe className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              3. Browser Cache Maintenance
            </h3>
          </div>
          <div className="flex items-center space-x-1 text-[11px] text-emerald-400 bg-[#064E3B]/40 px-2 py-0.5 rounded border border-emerald-700/60">
            <ShieldCheck className="w-3 h-3" />
            <span>Process Safety Lock Guard Enabled</span>
          </div>
        </div>

        <p className="text-[11px] text-slate-400 mb-3 leading-relaxed">
          The script checks whether browsers are actively running (<code className="text-cyan-300 font-mono bg-[#0B0F1A] px-1 py-0.5 rounded border border-[#1F293D]">Get-Process</code>). If a browser is open, cache cleanup is skipped cleanly to prevent corrupting active sessions and databases.
        </p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
          {[
            { key: 'cleanChromeCache' as const, label: 'Google Chrome', icon: 'Chrome' },
            { key: 'cleanEdgeCache' as const, label: 'Microsoft Edge', icon: 'Edge' },
            { key: 'cleanFirefoxCache' as const, label: 'Mozilla Firefox', icon: 'Firefox' },
            { key: 'cleanBraveCache' as const, label: 'Brave Browser', icon: 'Brave' },
          ].map((b) => (
            <label
              key={b.key}
              className={`flex items-center space-x-2 p-2 rounded-lg border cursor-pointer transition-all ${
                config[b.key]
                  ? 'bg-[#132035] border-cyan-500/50 text-slate-100 shadow-sm'
                  : 'bg-[#0B0F1A]/60 border-[#1F293D] text-slate-400 hover:text-slate-300 hover:border-[#2D3A54]'
              }`}
            >
              <input
                type="checkbox"
                checked={config[b.key]}
                onChange={() => handleToggle(b.key)}
                className="rounded border-[#2D3A54] text-cyan-500 focus:ring-cyan-500 bg-[#0B0F1A]"
              />
              <span className="font-medium text-xs">{b.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* SECTION 4: Windows Performance Tweaks */}
      <div className="border-t border-[#1F293D] pt-4">
        <div className="flex items-center space-x-2 mb-3 text-slate-200">
          <Sliders className="w-4 h-4 text-purple-400" />
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
            4. Windows Performance Tweaks
          </h3>
        </div>

        <div className="space-y-3 text-xs">
          <label className="flex items-start space-x-2.5 p-2.5 bg-[#0F1423]/80 hover:bg-[#0F1423] border border-[#1F293D] hover:border-[#2D3A54] rounded-lg cursor-pointer transition-all">
            <input
              type="checkbox"
              checked={config.restartPerformanceServices}
              onChange={() => handleToggle('restartPerformanceServices')}
              className="mt-0.5 rounded border-[#2D3A54] text-cyan-500 focus:ring-cyan-500 bg-[#0B0F1A]"
            />
            <div>
              <div className="font-medium text-slate-200">Recycle Memory & Indexing Services</div>
              <div className="text-slate-400 text-[11px] mt-0.5 leading-relaxed">
                Restarts <code className="text-cyan-300 font-mono bg-[#0B0F1A] px-1 py-0.5 rounded border border-[#1F293D]">SysMain</code> (SuperFetch) to flush standby RAM cache and refreshes Windows Search indexer queue.
              </div>
            </div>
          </label>

          {/* Visual Effects Presets */}
          <div className="p-3 bg-[#0F1423] border border-[#1F293D] rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={config.adjustVisualEffects}
                  onChange={() => handleToggle('adjustVisualEffects')}
                  className="rounded border-[#2D3A54] text-cyan-500 focus:ring-cyan-500 bg-[#0B0F1A]"
                />
                <span className="font-medium text-slate-200">Tweak Windows Visual Effects & Response</span>
              </label>
              <span className="text-[10px] text-cyan-400">Backs up registry prior to changes</span>
            </div>

            {config.adjustVisualEffects && (
              <div className="grid grid-cols-3 gap-2 mt-2 pt-2 border-t border-[#1F293D]">
                <button
                  onClick={() => handleVisualPreset('performance')}
                  className={`p-2 rounded text-left border transition-all cursor-pointer ${
                    config.visualEffectsPreset === 'performance'
                      ? 'bg-[#2E1065]/40 border-purple-500 text-purple-100 ring-1 ring-purple-500/50 shadow-sm'
                      : 'bg-[#0B0F1A] border-[#1F293D] text-slate-400 hover:text-slate-200 hover:border-[#2D3A54]'
                  }`}
                >
                  <div className="font-bold text-xs">High Performance</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Disables window animations, retains ClearType smooth fonts.</div>
                </button>
                <button
                  onClick={() => handleVisualPreset('balanced')}
                  className={`p-2 rounded text-left border transition-all cursor-pointer ${
                    config.visualEffectsPreset === 'balanced'
                      ? 'bg-[#2E1065]/40 border-purple-500 text-purple-100 ring-1 ring-purple-500/50 shadow-sm'
                      : 'bg-[#0B0F1A] border-[#1F293D] text-slate-400 hover:text-slate-200 hover:border-[#2D3A54]'
                  }`}
                >
                  <div className="font-bold text-xs">Balanced (Recommended)</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Reduced menu lag (100ms) with clean modern aesthetics.</div>
                </button>
                <button
                  onClick={() => handleVisualPreset('appearance')}
                  className={`p-2 rounded text-left border transition-all cursor-pointer ${
                    config.visualEffectsPreset === 'appearance'
                      ? 'bg-[#2E1065]/40 border-purple-500 text-purple-100 ring-1 ring-purple-500/50 shadow-sm'
                      : 'bg-[#0B0F1A] border-[#1F293D] text-slate-400 hover:text-slate-200 hover:border-[#2D3A54]'
                  }`}
                >
                  <div className="font-bold text-xs">Best Appearance</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Full Windows animations, blur, and window shadows.</div>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Advanced Safety Guard Options */}
      <div className="border-t border-[#1F293D] pt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <label className="flex items-center space-x-2 cursor-pointer text-slate-300">
          <input
            type="checkbox"
            checked={config.createRestorePoint}
            onChange={() => handleToggle('createRestorePoint')}
            className="rounded border-[#2D3A54] text-emerald-500 focus:ring-emerald-500 bg-[#0B0F1A]"
          />
          <span>Auto-create System Restore Point before executing</span>
        </label>

        <label className="flex items-center space-x-2 cursor-pointer text-slate-300">
          <input
            type="checkbox"
            checked={config.dryRunMode}
            onChange={() => handleToggle('dryRunMode')}
            className="rounded border-[#2D3A54] text-amber-500 focus:ring-amber-500 bg-[#0B0F1A]"
          />
          <span className="font-medium text-amber-300">Dry-Run Mode (-DryRun / Simulation Only)</span>
        </label>
      </div>
    </div>
  );
};
