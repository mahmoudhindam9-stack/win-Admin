import React from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Terminal,
  HelpCircle,
  Clock,
  AlertTriangle,
  FileText,
  Cpu,
  Check,
  Copy,
} from 'lucide-react';

export const AdminGuide: React.FC = () => {
  const [copiedCmd, setCopiedCmd] = React.useState<string | null>(null);

  const copyCommand = (cmd: string, id: string) => {
    navigator.clipboard.writeText(cmd);
    setCopiedCmd(id);
    setTimeout(() => setCopiedCmd(null), 2000);
  };

  return (
    <div className="bg-[#161B2A] border border-[#1F293D] rounded-xl p-6 shadow-xl shadow-black/25 space-y-7 font-sans">
      {/* Overview Banner */}
      <div className="flex items-start space-x-4 p-4 bg-[#0C243C]/60 border border-[#0284C7]/40 rounded-xl">
        <ShieldCheck className="w-8 h-8 text-cyan-400 flex-shrink-0 mt-1" />
        <div>
          <h3 className="text-base font-bold text-slate-100">Enterprise Administration & Safety Architecture</h3>
          <p className="text-xs text-slate-300 mt-1 leading-relaxed">
            This suite was designed adhering strictly to Microsoft Windows System Administration best practices.
            Unlike destructive third-party &quot;cleaner&quot; tools, it targets safe volatile caches, respects active application locks,
            and preserves system boot layout and registry integrity.
          </p>
        </div>
      </div>

      {/* 3 Execution Methods */}
      <div>
        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span>3 Ways to Execute the Script</span>
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Method 1 */}
          <div className="p-4 bg-[#0F1423] border border-[#1F293D] rounded-xl flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Method 1</span>
                <span className="px-2 py-0.5 bg-[#0C243C] text-cyan-300 text-[10px] rounded font-semibold border border-[#0284C7]/50">
                  Recommended
                </span>
              </div>
              <h5 className="font-semibold text-slate-200 text-sm">PowerShell with Bypass</h5>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Run directly in an elevated PowerShell terminal. Bypasses execution policy restrictions safely for this process only.
              </p>
              <div className="mt-3 bg-[#080B12] p-2.5 rounded-lg border border-[#1F293D] font-mono text-[11px] text-cyan-300 relative group overflow-x-auto">
                <code>powershell.exe -ExecutionPolicy Bypass -File .\WinOptimize.ps1</code>
                <button
                  onClick={() =>
                    copyCommand('powershell.exe -ExecutionPolicy Bypass -File .\\WinOptimize.ps1', 'm1')
                  }
                  className="absolute right-2 top-2 p-1.5 bg-[#1E293B] hover:bg-[#2D3A54] text-slate-300 rounded-md opacity-80 group-hover:opacity-100 transition-opacity cursor-pointer border border-[#2D3A54]"
                  title="Copy command"
                >
                  {copiedCmd === 'm1' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>

          {/* Method 2 */}
          <div className="p-4 bg-[#0F1423] border border-[#1F293D] rounded-xl flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Method 2</span>
                <span className="px-2 py-0.5 bg-[#1E293B] text-slate-300 text-[10px] rounded font-semibold border border-[#2D3A54]">
                  1-Click
                </span>
              </div>
              <h5 className="font-semibold text-slate-200 text-sm">Hybrid Launcher (.bat)</h5>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Download <code className="text-cyan-300 font-mono bg-[#0B0F1A] px-1 py-0.5 rounded border border-[#1F293D]">Launch-WinOptimize.bat</code> into the same directory as <code className="text-cyan-300 font-mono bg-[#0B0F1A] px-1 py-0.5 rounded border border-[#1F293D]">WinOptimize.ps1</code> and simply double-click it.
              </p>
              <div className="mt-3 bg-[#080B12] p-2.5 rounded-lg border border-[#1F293D] text-slate-400 text-[11px] leading-relaxed">
                Double-click triggers UAC prompt automatically, launches PowerShell behind the scenes, and closes on user keypress.
              </div>
            </div>
          </div>

          {/* Method 3 */}
          <div className="p-4 bg-[#0F1423] border border-[#1F293D] rounded-xl flex flex-col justify-between shadow-sm">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">Method 3</span>
                <span className="px-2 py-0.5 bg-[#2E1065]/50 text-purple-300 text-[10px] rounded font-semibold border border-purple-800/60">
                  Automated
                </span>
              </div>
              <h5 className="font-semibold text-slate-200 text-sm">Windows Task Scheduler</h5>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Schedule weekly maintenance automatically under SYSTEM account with zero user disruption.
              </p>
              <div className="mt-3 bg-[#080B12] p-2.5 rounded-lg border border-[#1F293D] font-mono text-[11px] text-cyan-300 relative group overflow-x-auto">
                <code>schtasks /create /tn &quot;WinOptimizeWeekly&quot; /tr &quot;powershell.exe -ExecutionPolicy Bypass -File C:\Scripts\WinOptimize.ps1&quot; /sc weekly /d SUN /st 03:00 /ru &quot;SYSTEM&quot; /rl HIGHEST</code>
                <button
                  onClick={() =>
                    copyCommand(
                      'schtasks /create /tn "WinOptimizeWeekly" /tr "powershell.exe -ExecutionPolicy Bypass -File C:\\Scripts\\WinOptimize.ps1" /sc weekly /d SUN /st 03:00 /ru "SYSTEM" /rl HIGHEST',
                      'm3'
                    )
                  }
                  className="absolute right-2 top-2 p-1.5 bg-[#1E293B] hover:bg-[#2D3A54] text-slate-300 rounded-md opacity-80 group-hover:opacity-100 transition-opacity cursor-pointer border border-[#2D3A54]"
                  title="Copy command"
                >
                  {copiedCmd === 'm3' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Safety Matrix Table */}
      <div>
        <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-4 flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-emerald-400" />
          <span>Safety Guardrails Built into the Script</span>
        </h4>

        <div className="border border-[#1F293D] rounded-xl overflow-hidden text-xs">
          <table className="w-full text-left">
            <thead className="bg-[#0F1423] text-slate-400 border-b border-[#1F293D]">
              <tr>
                <th className="p-3">Component Target</th>
                <th className="p-3">Common Risk in Bad Scripts</th>
                <th className="p-3">WinOptimize Safety Solution</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1F293D] text-slate-300">
              <tr className="hover:bg-[#0F1423]/50">
                <td className="p-3 font-semibold text-cyan-300">In-use Temp & Socket Files</td>
                <td className="p-3 text-slate-400">Hard crashes script, breaks running apps.</td>
                <td className="p-3 text-emerald-400 font-medium">
                  Item-by-item <code className="text-slate-200 font-mono bg-[#0B0F1A] px-1 py-0.5 rounded border border-[#1F293D]">try/catch</code> with locked-file count reporting.
                </td>
              </tr>
              <tr className="hover:bg-[#0F1423]/50">
                <td className="p-3 font-semibold text-cyan-300">Browser Cache (Chrome, Edge, Firefox)</td>
                <td className="p-3 text-slate-400">Corrupts profile SQLite databases if browser is active.</td>
                <td className="p-3 text-emerald-400 font-medium">
                  Checks <code className="text-slate-200 font-mono bg-[#0B0F1A] px-1 py-0.5 rounded border border-[#1F293D]">Get-Process</code>. If process exists, logs warning and skips cleanly.
                </td>
              </tr>
              <tr className="hover:bg-[#0F1423]/50">
                <td className="p-3 font-semibold text-cyan-300">Windows Update SoftwareDistribution</td>
                <td className="p-3 text-slate-400">Locks up Windows Update agent or breaks pending rollbacks.</td>
                <td className="p-3 text-emerald-400 font-medium">
                  Safely pauses <code className="text-slate-200 font-mono bg-[#0B0F1A] px-1 py-0.5 rounded border border-[#1F293D]">wuauserv</code> and <code className="text-slate-200 font-mono bg-[#0B0F1A] px-1 py-0.5 rounded border border-[#1F293D]">bits</code>, then restarts in a guaranteed <code className="text-slate-200 font-mono bg-[#0B0F1A] px-1 py-0.5 rounded border border-[#1F293D]">finally</code> block.
                </td>
              </tr>
              <tr className="hover:bg-[#0F1423]/50">
                <td className="p-3 font-semibold text-cyan-300">Prefetch Files (C:\Windows\Prefetch)</td>
                <td className="p-3 text-slate-400">Slows down subsequent Windows boot times.</td>
                <td className="p-3 text-emerald-400 font-medium">
                  Specifically excludes <code className="text-slate-200 font-mono bg-[#0B0F1A] px-1 py-0.5 rounded border border-[#1F293D]">layout.ini</code> and <code className="text-slate-200 font-mono bg-[#0B0F1A] px-1 py-0.5 rounded border border-[#1F293D]">ReadyBoot</code> boot-tracking files.
                </td>
              </tr>
              <tr className="hover:bg-[#0F1423]/50">
                <td className="p-3 font-semibold text-cyan-300">Visual Effects Tweaks</td>
                <td className="p-3 text-slate-400">Blurs font rendering (ruining ClearType) with no rollback.</td>
                <td className="p-3 text-emerald-400 font-medium">
                  Exports rollback <code className="text-slate-200 font-mono bg-[#0B0F1A] px-1 py-0.5 rounded border border-[#1F293D]">.reg</code> file to Temp, and keeps FontSmoothing = 2 (crisp text).
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Frequently Asked Questions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        <div className="p-4 bg-[#0F1423] border border-[#1F293D] rounded-xl space-y-2">
          <div className="font-semibold text-slate-200 flex items-center space-x-2">
            <HelpCircle className="w-4 h-4 text-cyan-400" />
            <span>Why is ExecutionPolicy Bypass required?</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            By default, Windows sets PowerShell execution policy to <code className="text-cyan-300 font-mono bg-[#0B0F1A] px-1 py-0.5 rounded border border-[#1F293D]">Restricted</code> to prevent malicious scripts from executing on double-click. Using <code className="text-cyan-300 font-mono bg-[#0B0F1A] px-1 py-0.5 rounded border border-[#1F293D]">-ExecutionPolicy Bypass</code> tells PowerShell to run this specific script without permanently lowering your machine-wide security settings.
          </p>
        </div>

        <div className="p-4 bg-[#0F1423] border border-[#1F293D] rounded-xl space-y-2">
          <div className="font-semibold text-slate-200 flex items-center space-x-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <span>How often should this script be run?</span>
          </div>
          <p className="text-slate-400 leading-relaxed">
            Once every 1 to 2 weeks is optimal for power users and workstations. Running it constantly is unnecessary since Windows manages some cache tiers, but running it periodically cleans accumulated gigabytes of update installers and transient temp bloat.
          </p>
        </div>
      </div>
    </div>
  );
};
