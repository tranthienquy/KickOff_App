
import React, { useState, useEffect, useRef } from 'react';
import { AppState, EventStatus } from '../types.ts';
import { syncState, updateStatus, updateUrls, isFirebaseConnected, storage, syncDeviceStats, trackDevice } from '../services/firebase.ts';
import { ref as sRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const AdminView: React.FC = () => {
  const [state, setState] = useState<AppState | null>(null);
  const [deviceStats, setDeviceStats] = useState({ online: 0, offline: 0 });
  const [waitingUrl, setWaitingUrl] = useState('');
  const [countdownUrl, setCountdownUrl] = useState('');
  const [activatedUrl, setActivatedUrl] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<EventStatus | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  
  const connected = isFirebaseConnected();
  const waitingInputRef = useRef<HTMLInputElement>(null);
  const countdownInputRef = useRef<HTMLInputElement>(null);
  const activatedInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    trackDevice();

    const unsubscribeState = syncState((newState) => {
      setState(newState);
      setPendingStatus(null);
      if (!waitingUrl) setWaitingUrl(newState.waitingUrl);
      if (!countdownUrl) setCountdownUrl(newState.countdownUrl);
      if (!activatedUrl) setActivatedUrl(newState.activatedUrl);
    });

    const unsubscribeDevices = syncDeviceStats((stats) => {
      setDeviceStats(stats);
    });

    return () => {
      unsubscribeState();
      unsubscribeDevices();
    };
  }, []);

  const handleStatusChange = async (status: EventStatus) => {
    setPendingStatus(status);
    await updateStatus(status);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'waiting' | 'countdown' | 'activated') => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!storage) { alert("LỖI: Firebase Storage chưa kết nối."); return; }

    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const filePath = `event-videos/${type}_${Date.now()}_${safeName}`;
    const storageRef = sRef(storage, filePath);

    try {
      const uploadTask = uploadBytesResumable(storageRef, file);
      uploadTask.on('state_changed', 
        (snap) => setUploadProgress(prev => ({ ...prev, [type]: Math.round((snap.bytesTransferred/snap.totalBytes)*100) })), 
        (err) => { alert(err.message); setUploadProgress(prev => ({ ...prev, [type]: 0 })); }, 
        async () => {
          const url = await getDownloadURL(uploadTask.snapshot.ref);
          if (type === 'waiting') setWaitingUrl(url);
          else if (type === 'countdown') setCountdownUrl(url); 
          else setActivatedUrl(url);
          setUploadProgress(prev => ({ ...prev, [type]: 0 }));
          e.target.value = '';
        }
      );
    } catch (err) { alert("Upload failed."); }
  };

  const handleUpdateUrls = async () => {
    setIsUpdating(true);
    try { await updateUrls(waitingUrl, countdownUrl, activatedUrl); alert('SYNC COMPLETE.'); }
    catch (e) { alert('Error: ' + (e as Error).message); }
    finally { setIsUpdating(false); }
  };

  if (!state) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center font-orbitron text-cyan-400">
      CONNECTING CONSOLE...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-inter p-4 md:p-6 pb-24">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-5 bg-slate-900/50 border border-slate-800 rounded-2xl">
          <div className="space-y-1">
            <h1 className="text-lg font-orbitron font-bold text-white flex items-center gap-3">
              <span className={`w-2.5 h-2.5 rounded-full ${connected ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-red-500'}`}></span>
              COMMAND CENTER
            </h1>
            <div className="flex flex-wrap items-center gap-4 text-slate-400">
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                <span className="text-[10px] font-orbitron uppercase tracking-widest text-emerald-400">
                  {deviceStats.online} Online
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-600"></span>
                <span className="text-[10px] font-orbitron uppercase tracking-widest text-slate-500">
                  {deviceStats.offline} Disconnected
                </span>
              </div>
            </div>
          </div>
          <div className="px-4 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-cyan-400 font-orbitron text-[10px] font-bold uppercase tracking-tighter">
            System Status: {state.status}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { id: EventStatus.WAITING, label: 'STANDBY (LOGO)', icon: '💤', color: 'slate' },
            { id: EventStatus.COUNTDOWN, label: 'RUN CLIP CHỜ', icon: '📽️', color: 'amber' },
            { id: EventStatus.ACTIVATED, label: 'RUN CLIP CHÍNH', icon: '🚀', color: 'emerald' }
          ].map((btn) => (
            <button 
              key={btn.id}
              onClick={() => handleStatusChange(btn.id)}
              disabled={pendingStatus === btn.id}
              className={`p-6 rounded-xl border transition-all duration-150 active:scale-95 flex flex-col items-center gap-3 ${
                state.status === btn.id 
                  ? `bg-${btn.color}-500/20 border-${btn.color}-500 shadow-lg shadow-${btn.color}-500/10` 
                  : 'bg-slate-900 border-slate-800 hover:border-slate-700'
              } ${pendingStatus === btn.id ? 'opacity-70 animate-pulse' : ''}`}
            >
              <div className="text-3xl">{btn.icon}</div>
              <div className="font-orbitron font-bold text-[10px] text-white uppercase tracking-wider">{btn.label}</div>
            </button>
          ))}
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-8 shadow-2xl">
          <h2 className="text-xs font-orbitron font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <span className="w-4 h-[1px] bg-slate-700"></span>
            Media Asset Management
          </h2>
          
          <div className="space-y-8">
            {[
              { label: '0. CLIP NỀN (WAITING)', url: waitingUrl, set: setWaitingUrl, ref: waitingInputRef, prog: uploadProgress.waiting, type: 'waiting' },
              { label: '1. CLIP CHỜ SOURCE', url: countdownUrl, set: setCountdownUrl, ref: countdownInputRef, prog: uploadProgress.countdown, type: 'countdown' },
              { label: '2. CLIP CHÍNH SOURCE', url: activatedUrl, set: setActivatedUrl, ref: activatedInputRef, prog: uploadProgress.activated, type: 'activated' }
            ].map((field, i) => (
              <div key={i} className="space-y-3">
                <label className="text-[10px] font-orbitron text-slate-400 tracking-wider uppercase">{field.label}</label>
                <div className="flex gap-2">
                  <input 
                    type="text" value={field.url} onChange={(e) => field.set(e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-xs outline-none focus:border-cyan-500/50 transition-colors font-mono text-cyan-300/70"
                  />
                  <input type="file" ref={field.ref} className="hidden" accept="video/*" onChange={(e) => handleFileUpload(e, field.type as any)} />
                  <button onClick={() => field.ref.current?.click()} className="px-4 bg-slate-800 hover:bg-slate-700 rounded-lg text-[9px] font-orbitron border border-slate-700 transition-colors text-slate-300">
                    {field.prog > 0 ? `${field.prog}%` : 'FILE'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-6 border-t border-slate-800 flex justify-end">
            <button 
              onClick={handleUpdateUrls}
              disabled={isUpdating}
              className="px-10 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-orbitron font-bold rounded-lg transition-all disabled:opacity-50 text-xs tracking-widest shadow-lg shadow-cyan-900/20 active:scale-95"
            >
              {isUpdating ? 'SYNCING ASSETS...' : 'PUSH TO ALL DEVICES'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminView;
