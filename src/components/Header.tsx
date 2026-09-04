import React from 'react';
import { Terminal, Activity, Download, FileCode, BookOpen, ShieldCheck, Router } from 'lucide-react';

interface HeaderProps {
  activeView: 'dashboard' | 'router' | 'terminal' | 'code' | 'guide';
  onViewChange: (view: 'dashboard' | 'router' | 'terminal' | 'code' | 'guide') => void;
  onQuickDownload: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeView,
  onViewChange,
  onQuickDownload,
}) => {
  return (
    <header className="bg-[#0F1423]/95 backdrop-blur-md border-b border-[#1F293D] sticky top-0 z-30 font-sans">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Branding & Badges */}
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[#0284C7] to-[#1D4ED8] flex items-center justify-center text-white shadow-md shadow-sky-950/50 border border-sky-400/30">
            <Terminal className="w-5 h-5 text-sky-100" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-base font-bold text-slate-100 tracking-tight">
                Windows Performance & Network Suite
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-[#082F49]/80 border border-[#0284C7]/40 text-[10px] font-semibold text-cyan-300">
                v2.6 Enterprise
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Hardware Telemetry &bull; Elevated PowerShell &bull; Universal Router Management
            </p>
          </div>
        </div>

        {/* View Switcher Tabs */}
        <div className="flex items-center space-x-1 bg-[#0B0F1A] p-1 rounded-lg border border-[#1F293D] text-xs">
          <button
            id="nav-view-dashboard-btn"
            onClick={() => onViewChange('dashboard')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
              activeView === 'dashboard'
                ? 'bg-[#0284C7] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#161B2A]'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Admin Console</span>
          </button>

          <button
            id="nav-view-router-btn"
            onClick={() => onViewChange('router')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
              activeView === 'router'
                ? 'bg-[#0284C7] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#161B2A]'
            }`}
          >
            <Router className="w-3.5 h-3.5" />
            <span>Router Management</span>
          </button>

          <button
            id="nav-view-terminal-btn"
            onClick={() => onViewChange('terminal')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
              activeView === 'terminal'
                ? 'bg-[#0284C7] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#161B2A]'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>PowerShell Terminal</span>
          </button>

          <button
            id="nav-view-code-btn"
            onClick={() => onViewChange('code')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
              activeView === 'code'
                ? 'bg-[#0284C7] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#161B2A]'
            }`}
          >
            <FileCode className="w-3.5 h-3.5" />
            <span>Script Generator</span>
          </button>

          <button
            id="nav-view-guide-btn"
            onClick={() => onViewChange('guide')}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
              activeView === 'guide'
                ? 'bg-[#0284C7] text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200 hover:bg-[#161B2A]'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Admin Guide</span>
          </button>
        </div>

        {/* Action Button */}
        <div className="flex items-center space-x-2">
          <button
            id="quick-download-ps1-btn"
            onClick={onQuickDownload}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#161B2A] hover:bg-[#1E293B] text-slate-200 hover:text-white rounded-lg text-xs font-semibold border border-[#1F293D] hover:border-cyan-500/40 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-cyan-400" />
            <span>Export .ps1 Script</span>
          </button>
        </div>
      </div>
    </header>
  );
};

