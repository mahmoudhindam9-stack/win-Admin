import React, { useState, useMemo } from 'react';
import {
  Copy,
  Check,
  Download,
  FileCode,
  Search,
  ExternalLink,
  ShieldCheck,
  Terminal,
  Layers,
} from 'lucide-react';
import { ScriptConfig } from '../types';
import {
  generatePowerShellScript,
  generateBatchScript,
  generateHybridLauncher,
} from '../data/scriptGenerator';

interface ScriptViewerProps {
  config: ScriptConfig;
}

export const ScriptViewer: React.FC<ScriptViewerProps> = ({ config }) => {
  const [activeTab, setActiveTab] = useState<'ps1' | 'bat' | 'launcher'>('ps1');
  const [copied, setCopied] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const psScript = useMemo(() => generatePowerShellScript(config), [config]);
  const batScript = useMemo(() => generateBatchScript(config), [config]);
  const launcherScript = useMemo(() => generateHybridLauncher(), []);

  const currentCode = activeTab === 'ps1' ? psScript : activeTab === 'bat' ? batScript : launcherScript;
  const currentFilename =
    activeTab === 'ps1'
      ? 'WinOptimize.ps1'
      : activeTab === 'bat'
      ? 'WinOptimize.bat'
      : 'Launch-WinOptimize.bat';

  const handleCopy = () => {
    navigator.clipboard.writeText(currentCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    // Add UTF-8 BOM so Windows PowerShell console recognizes characters cleanly
    const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
    const blob = new Blob([bom, currentCode], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadAll = () => {
    const scripts = [
      { name: 'WinOptimize.ps1', code: psScript },
      { name: 'WinOptimize.bat', code: batScript },
      { name: 'Launch-WinOptimize.bat', code: launcherScript },
    ];

    scripts.forEach((s) => {
      const bom = new Uint8Array([0xef, 0xbb, 0xbf]);
      const blob = new Blob([bom, s.code], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = s.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  const lines = useMemo(() => {
    return currentCode.split('\n');
  }, [currentCode]);

  const filteredLines = useMemo(() => {
    if (!searchQuery.trim()) return lines;
    const query = searchQuery.toLowerCase();
    return lines.filter((line) => line.toLowerCase().includes(query));
  }, [lines, searchQuery]);

  return (
    <div className="bg-[#161B2A] border border-[#1F293D] rounded-xl overflow-hidden shadow-xl shadow-black/25 flex flex-col h-full font-sans">
      {/* Top Action & Tab Bar */}
      <div className="bg-[#0F1423] px-4 py-2.5 border-b border-[#1F293D] flex flex-wrap items-center justify-between gap-3">
        {/* Tabs */}
        <div className="flex items-center space-x-1 bg-[#0B0F1A] p-1 rounded-lg border border-[#1F293D]">
          <button
            id="tab-powershell-ps1"
            onClick={() => setActiveTab('ps1')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
              activeTab === 'ps1'
                ? 'bg-[#1E293B] text-white shadow-sm border border-[#2D3A54]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#161B2A]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>WinOptimize.ps1 (PowerShell)</span>
          </button>

          <button
            id="tab-batch-bat"
            onClick={() => setActiveTab('bat')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
              activeTab === 'bat'
                ? 'bg-[#1E293B] text-white shadow-sm border border-[#2D3A54]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#161B2A]'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>WinOptimize.bat (Batch)</span>
          </button>

          <button
            id="tab-launcher-bat"
            onClick={() => setActiveTab('launcher')}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center space-x-1.5 transition-all cursor-pointer ${
              activeTab === 'launcher'
                ? 'bg-[#1E293B] text-white shadow-sm border border-[#2D3A54]'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#161B2A]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Launch-WinOptimize.bat</span>
          </button>
        </div>

        {/* Search & Actions */}
        <div className="flex items-center space-x-2">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search code lines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-2.5 py-1.5 text-xs bg-[#0B0F1A] border border-[#1F293D] rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/30 w-36 sm:w-44"
            />
          </div>

          {/* Copy Button */}
          <button
            id="copy-script-code-btn"
            onClick={handleCopy}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-[#1E293B]/70 hover:bg-[#1E293B] text-slate-200 rounded-lg text-xs font-medium border border-[#2D3A54] transition-all active:scale-95 cursor-pointer shadow-sm"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied!' : 'Copy Code'}</span>
          </button>

          {/* Download Current File */}
          <button
            id="download-script-file-btn"
            onClick={handleDownload}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-gradient-to-r from-[#0284C7] to-[#2563EB] hover:from-[#0369A1] hover:to-[#1D4ED8] text-white rounded-lg text-xs font-semibold shadow-md shadow-sky-950/40 border border-sky-400/30 transition-all active:scale-95 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download {currentFilename}</span>
          </button>

          {/* Download All Bundle */}
          <button
            id="download-all-bundle-btn"
            onClick={handleDownloadAll}
            title="Download PS1 script + Batch Launcher together"
            className="hidden sm:flex items-center space-x-1 px-2.5 py-1.5 bg-[#1E293B]/70 hover:bg-[#1E293B] text-slate-300 rounded-lg text-xs font-medium border border-[#2D3A54] transition-colors cursor-pointer"
          >
            <span>All Scripts</span>
          </button>
        </div>
      </div>

      {/* Code Display Area */}
      <div className="flex-1 overflow-auto bg-[#080B12] text-slate-300 font-mono text-xs leading-relaxed p-4">
        {searchQuery && (
          <div className="mb-2 px-2.5 py-1.5 bg-[#0C243C] border border-[#0284C7]/40 rounded-lg text-cyan-300 text-[11px] flex items-center justify-between">
            <span>Filtering lines matching: &quot;{searchQuery}&quot; ({filteredLines.length} lines found)</span>
            <button onClick={() => setSearchQuery('')} className="underline hover:text-white cursor-pointer">Clear</button>
          </div>
        )}

        <div className="space-y-0.5 select-text">
          {filteredLines.map((line, idx) => {
            // Simple syntax highlighting classes
            let lineClass = 'text-slate-300';
            const trimmed = line.trim();

            if (trimmed.startsWith('#') || trimmed.startsWith('::') || trimmed.startsWith('<#') || trimmed.endsWith('#>')) {
              lineClass = 'text-slate-500 italic';
            } else if (trimmed.startsWith('function') || trimmed.startsWith('param') || trimmed.startsWith('Set-ItemProperty') || trimmed.startsWith('Clear-RecycleBin') || trimmed.startsWith('Safe-RemoveDirectoryContents')) {
              lineClass = 'text-cyan-400 font-semibold';
            } else if (trimmed.startsWith('Write-Host') || trimmed.startsWith('Write-Success') || trimmed.startsWith('Write-WarningMsg') || trimmed.startsWith('Write-Info') || trimmed.startsWith('echo')) {
              lineClass = 'text-emerald-300';
            } else if (trimmed.includes('if ') || trimmed.includes('else') || trimmed.includes('try {') || trimmed.includes('catch {') || trimmed.includes('finally {')) {
              lineClass = 'text-purple-400 font-semibold';
            } else if (trimmed.startsWith('netsh ') || trimmed.startsWith('ipconfig ') || trimmed.startsWith('net start') || trimmed.startsWith('net stop')) {
              lineClass = 'text-amber-300';
            }

            return (
              <div key={idx} className="flex hover:bg-[#161B2A]/60 px-1 rounded transition-colors group">
                <span className="w-10 text-right pr-4 text-slate-600 select-none group-hover:text-slate-400 flex-shrink-0">
                  {idx + 1}
                </span>
                <span className={`${lineClass} whitespace-pre overflow-x-auto flex-1`}>{line}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Script Footer Metadata */}
      <div className="bg-[#0F1423] px-4 py-2 border-t border-[#1F293D] flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
        <div className="flex items-center space-x-3">
          <span className="flex items-center space-x-1.5 text-emerald-400 font-medium">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Automatic UAC Elevation Built-in</span>
          </span>
          <span className="hidden sm:inline text-slate-600">•</span>
          <span className="hidden sm:inline">UTF-8 Encoded</span>
          <span className="hidden sm:inline text-slate-600">•</span>
          <span>{lines.length} lines</span>
        </div>

        <div className="text-[11px] text-slate-500">
          Target: Windows 10/11 / Windows Server 2016-2025
        </div>
      </div>
    </div>
  );
};
