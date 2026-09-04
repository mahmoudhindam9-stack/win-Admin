import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, RefreshCw, RotateCcw, X, AlertTriangle } from 'lucide-react';

interface UpdateCenterProps {
  compact?: boolean;
}

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'latest' | 'error';

export const UpdateCenter: React.FC<UpdateCenterProps> = ({ compact = false }) => {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<UpdateState>('idle');
  const [version, setVersion] = useState('');
  const [percent, setPercent] = useState(0);
  const [message, setMessage] = useState('Check for the latest version from the update server.');
  const [currentVersion, setCurrentVersion] = useState('');

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    const api = window.electronAPI;
    if (!api) return;

    api.getAppVersion?.().then(setCurrentVersion).catch(() => undefined);
    cleanup = api.onUpdateStatus?.((data: any) => {
      switch (data?.type) {
        case 'checking':
          setState('checking');
          setMessage('Checking for updates...');
          break;
        case 'available':
          setState('available');
          setVersion(data.version || '');
          setMessage(`Version ${data.version || 'new'} is available.`);
          setOpen(true);
          break;
        case 'progress':
          setState('downloading');
          setPercent(Math.max(0, Math.min(100, Number(data.percent) || 0)));
          setMessage(`Downloading update... ${Math.round(Number(data.percent) || 0)}%`);
          setOpen(true);
          break;
        case 'downloaded':
          setState('downloaded');
          setVersion(data.version || version);
          setPercent(100);
          setMessage('Update downloaded. Restart to install it.');
          setOpen(true);
          break;
        case 'not-available':
          setState('latest');
          setMessage('You are already running the latest available version.');
          break;
        case 'error':
          setState('error');
          setMessage(data.message || 'Update check failed.');
          setOpen(true);
          break;
        default:
          break;
      }
    });

    return () => cleanup?.();
  }, [version]);

  const check = async () => {
    const api = window.electronAPI;
    if (!api?.checkForUpdate) {
      setState('error');
      setMessage('The updater is available only in the installed Windows application.');
      setOpen(true);
      return;
    }
    setState('checking');
    setMessage('Checking for updates...');
    setOpen(true);
    const result = await api.checkForUpdate();
    if (result && result.success === false && result.reason !== 'not-packaged') {
      setState('error');
      setMessage(result.error || 'Unable to contact the update service.');
    } else if (result?.reason === 'not-packaged') {
      setState('error');
      setMessage('Run the installed Windows application to use automatic updates.');
    }
  };

  const download = async () => {
    const api = window.electronAPI;
    if (!api?.downloadUpdate) return;
    setState('downloading');
    setPercent(0);
    setMessage('Starting update download...');
    const result = await api.downloadUpdate();
    if (result && result.success === false) {
      setState('error');
      setMessage(result.error || 'Update download failed.');
    }
  };

  const install = async () => {
    const api = window.electronAPI;
    if (!api?.installUpdate) return;
    setState('downloaded');
    setMessage('Restarting to install the update...');
    await api.installUpdate();
  };

  return (
    <>
      <button
        id="check-for-updates-btn"
        onClick={check}
        className={compact
          ? 'flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#161B2A] hover:bg-[#1E293B] border border-[#1F293D] text-slate-200 text-xs font-semibold transition-all cursor-pointer'
          : 'fixed bottom-5 right-5 z-40 flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold shadow-lg shadow-cyan-950/40 transition-all cursor-pointer'}
      >
        <RefreshCw className="w-4 h-4" />
        <span>Check for Updates</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0F1423] border border-[#26334D] rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#1F293D] flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-100">Application Update</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Current version: {currentVersion || 'installed build'}</p>
              </div>
              <button onClick={() => setOpen(false)} className="text-slate-500 hover:text-slate-200 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center shrink-0">
                  {state === 'error' ? <AlertTriangle className="w-5 h-5 text-amber-400" /> : state === 'latest' ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Download className="w-5 h-5 text-cyan-400" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-200 leading-6">{message}</p>
                  {version && state !== 'error' && state !== 'latest' && (
                    <p className="text-xs text-cyan-300 font-mono mt-1">Available: v{version}</p>
                  )}
                </div>
              </div>

              {state === 'downloading' && (
                <div className="mt-5">
                  <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
                    <span>Download progress</span>
                    <span className="font-mono text-cyan-300">{Math.round(percent)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#161B2A] border border-[#26334D] overflow-hidden">
                    <div className="h-full bg-cyan-500 transition-all" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setOpen(false)} className="px-3 py-2 rounded-lg border border-[#2A3750] text-slate-300 hover:bg-[#161B2A] text-xs font-semibold cursor-pointer">
                  Close
                </button>
                {state === 'available' && (
                  <button onClick={download} className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold cursor-pointer">
                    Download Update
                  </button>
                )}
                {state === 'downloaded' && (
                  <button onClick={install} className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer">
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restart & Install
                  </button>
                )}
                {state === 'latest' && (
                  <button onClick={check} className="px-4 py-2 rounded-lg bg-[#1E293B] hover:bg-[#26344A] text-white text-xs font-semibold cursor-pointer">
                    Check Again
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
