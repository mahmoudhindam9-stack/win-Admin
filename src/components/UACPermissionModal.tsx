import React from 'react';
import { Shield, ShieldAlert, CheckCircle, X, Terminal, AlertTriangle } from 'lucide-react';
import { OptimizationTaskInfo } from '../types';

interface UACPermissionModalProps {
  task: OptimizationTaskInfo | null;
  isOpen: boolean;
  onApprove: (task: OptimizationTaskInfo) => void;
  onCancel: () => void;
}

export const UACPermissionModal: React.FC<UACPermissionModalProps> = ({
  task,
  isOpen,
  onApprove,
  onCancel,
}) => {
  if (!isOpen || !task) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-[#0F1423] border-2 border-[#0284C7] rounded-xl shadow-[0_0_50px_rgba(2,132,199,0.25)] overflow-hidden font-sans text-slate-100 flex flex-col"
        role="dialog"
        aria-modal="true"
        aria-labelledby="uac-title"
      >
        {/* Windows UAC Header */}
        <div className="bg-gradient-to-r from-[#0C243C] via-[#0F172A] to-[#1E293B] px-5 py-4 border-b border-[#1F293D] flex items-center space-x-3">
          <div className="w-10 h-10 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shadow-inner">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <div className="text-[11px] font-bold text-amber-400 uppercase tracking-widest flex items-center space-x-1.5">
              <span>Windows User Account Control (UAC)</span>
            </div>
            <h3 id="uac-title" className="text-sm sm:text-base font-bold text-slate-100 mt-0.5">
              Do you want to allow this app to make changes to your device?
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-[#1E293B] transition-colors"
            title="Cancel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Task Details & Elevation Verification */}
        <div className="p-5 space-y-4 text-xs">
          {/* Target Identity */}
          <div className="bg-[#080B12] p-3.5 rounded-lg border border-[#1F293D] space-y-2">
            <div className="flex items-center justify-between pb-2 border-b border-[#1F293D]">
              <span className="text-slate-400 font-medium">Program Name:</span>
              <span className="font-semibold text-slate-100 flex items-center space-x-1.5">
                <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                <span>PowerShell Elevated Administrative Host</span>
              </span>
            </div>

            <div className="flex items-center justify-between pb-2 border-b border-[#1F293D]">
              <span className="text-slate-400 font-medium">Verified Publisher:</span>
              <span className="text-emerald-400 font-semibold flex items-center space-x-1">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>Microsoft Windows Automation Principal</span>
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-slate-400 font-medium">Elevation Scope:</span>
              <span className="text-amber-300 font-mono text-[11px] font-semibold bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/60">
                RunAs Administrator (High Integrity Token)
              </span>
            </div>
          </div>

          {/* Requested Task Details */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-300 font-bold uppercase tracking-wider text-[11px]">
                Requested Operation:
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#0C243C] border border-[#0284C7]/40 text-cyan-300">
                {task.riskLevel}
              </span>
            </div>

            <div className="p-3 bg-[#131B2E] border border-[#1F293D] rounded-lg">
              <div className="font-bold text-slate-100 text-sm mb-1">{task.title}</div>
              <p className="text-slate-300 text-[11px] leading-relaxed mb-2.5">
                {task.shortDesc}
              </p>

              <div className="text-[11px] text-slate-400 space-y-1">
                <span className="text-slate-300 font-semibold block mb-1">Actions to be executed:</span>
                {task.elevationScope.map((scope, idx) => (
                  <div key={idx} className="flex items-start space-x-1.5 text-slate-300">
                    <span className="text-cyan-400 font-bold">›</span>
                    <span>{scope}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* PowerShell Command Preview */}
          <div>
            <span className="text-[11px] text-slate-400 font-medium block mb-1">
              Direct PowerShell Invocation:
            </span>
            <div className="bg-[#080B12] p-2.5 rounded-lg border border-[#1F293D] font-mono text-[11px] text-cyan-300 overflow-x-auto">
              <code>{task.commandPreview}</code>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-[11px] text-slate-400 bg-[#080B12]/80 p-2 rounded-lg border border-[#1F293D]">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
            <span>Files actively in use by running programs will be safely bypassed to protect integrity.</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="bg-[#0A0D17] px-5 py-3.5 border-t border-[#1F293D] flex items-center justify-end space-x-3">
          <button
            id="uac-cancel-btn"
            onClick={onCancel}
            className="px-4 py-2 bg-[#161B2A] hover:bg-[#1E293B] text-slate-300 rounded-lg text-xs font-semibold border border-[#1F293D] hover:border-[#2D3A54] transition-all cursor-pointer"
          >
            No (Cancel)
          </button>
          <button
            id="uac-approve-btn"
            onClick={() => onApprove(task)}
            className="px-5 py-2 bg-gradient-to-r from-[#0284C7] to-[#2563EB] hover:from-[#0369A1] hover:to-[#1D4ED8] text-white rounded-lg text-xs font-bold shadow-md shadow-sky-950/50 border border-sky-400/40 transition-all cursor-pointer active:scale-95 flex items-center space-x-1.5"
          >
            <Shield className="w-4 h-4 text-sky-200 fill-current" />
            <span>Yes (Approve & Elevate)</span>
          </button>
        </div>
      </div>
    </div>
  );
};
