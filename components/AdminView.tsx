import React, { useState, useEffect, useRef } from 'react';
import { AppState, EventStatus, INITIAL_STATE } from '../types.ts';
import { syncState, updateStatus, updateEventConfig, isFirebaseConnected, storage, syncDeviceStats, trackDevice } from '../services/firebase.ts';
import { ref as sRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const AdminView: React.FC = () => {
  const [state, setState] = useState<AppState | null>(null);
  const [deviceStats, setDeviceStats] = useState({ online: 0, offline: 0 });
  
  // Local form states - initialize with defaults to prevent uncontrolled inputs
  const [form, setForm] = useState<Partial<AppState>>(INITIAL_STATE);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<EventStatus | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  
  const connected = isFirebaseConnected();
  const fileInputs = {
    splash: useRef<HTMLInputElement>(null),
    waiting: useRef<HTMLInputElement>(null),
    countdown: useRef<HTMLInputElement>(null),
    activated: useRef<HTMLInputElement>(null)
  };

  useEffect(() => {
    trackDevice();

    const unsubscribeState = syncState((newState) => {
      setState(newState);
      setPendingStatus(null);
      // Sync form with remote state on initial load
      setForm(prev => {
        // If previous form was just the initial empty/default state, overwrite it with remote
        if (JSON.stringify(prev) === JSON.stringify(INITIAL_STATE)) return newState;
        return prev;
      });
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

  const handleInputChange = (key: keyof AppState, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'waiting' | 'countdown' | 'activated' | 'splash') => {
    const file = e.target.files?.[0];
    if (!file || !storage) return;

    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const filePath = `event-videos/${type}_${Date.now()}_${safeName}`;
    const storageRef = sRef(storage, filePath);

    const uploadTask = uploadBytesResumable(storageRef, file);
    uploadTask.on('state_changed', 
      (snap) => setUploadProgress(prev => ({ ...prev, [type]: Math.round((snap.bytesTransferred/snap.totalBytes)*100) })), 
      // Fix: Casting err to 'any' because 'message' property access on StorageError was failing in TS.
      (err: any) => alert(err.message), 
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        const keyMap = {
          splash: 'splashVideoUrl',
          waiting: 'waitingUrl',
          countdown: 'countdownUrl',
          activated: 'activatedUrl'
        } as const;
        handleInputChange(keyMap[type], url);
        setUploadProgress(prev => ({ ...prev, [type]: 0 }));
      }
    );
  };

  const handleSaveAll = async () => {
    setIsUpdating(true);
    try { 
      await updateEventConfig(form); 
      alert('SUCCESS: ALL TEXT DATA & CONFIG SAVED TO FIREBASE.'); 
    } catch (e) { 
      alert('Error: ' + (e as Error).message); 
    } finally { 
      setIsUpdating(false); 
    }
  };

  if (!state) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center font-orbitron text-cyan-400 gap-4">
      <div className="w-12 h-12 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
      <div className="tracking-[0.2em] animate-pulse">CONNECTING TO FIREBASE...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-inter p-4 md:p-6 pb-24 selection:bg-cyan-500/30">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-5 bg-slate-900/50 border border-slate-800 rounded-2xl backdrop-blur-md">
          <div className="space-y-1">
            <h1 className="text-lg font-orbitron font-bold text-white flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full ${connected ? 'bg-emerald-500 shadow-[0_0_15px_#10b981]' : 'bg-red-500 shadow-[0_0_15px_#ef4444]'}`}></span>
              COMMAND CENTER v2.1
            </h1>
            <div className="flex gap-4 text-[10px] font-orbitron uppercase tracking-widest">
              <span className="text-emerald-400">{deviceStats.online} Active Devices</span>
              <span className="text-slate-500">{deviceStats.offline} Offline</span>
            </div>
          </div>
          <div className="px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-cyan-400 font-orbitron text-[10px] font-bold">
            SYSTEM STATUS: {state.status.toUpperCase()}
          </div>
        </div>

        {/* Quick Actions */}
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
              className={`p-6 rounded-xl border transition-all duration-300 active:scale-95 flex flex-col items-center gap-3 ${
                state.status === btn.id 
                  ? `bg-${btn.color}-500/20 border-${btn.color}-500 shadow-[0_0_30px_rgba(0,0,0,0.3)]` 
                  : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
              } ${pendingStatus === btn.id ? 'opacity-50 animate-pulse' : ''}`}
            >
              <div className="text-3xl filter drop-shadow-md">{btn.icon}</div>
              <div className="font-orbitron font-bold text-[10px] text-white uppercase tracking-wider">{btn.label}</div>
            </button>
          ))}
        </div>

        {/* UI Text Settings */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-xl">
          <h2 className="text-xs font-orbitron font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <span className="w-4 h-[1px] bg-slate-700"></span>
            Visual Text Calibration (Saved to Database)
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-orbitron text-slate-400 uppercase tracking-widest">Prefix</label>
              <input type="text" value={form.titlePrefix || ''} onChange={e => handleInputChange('titlePrefix', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white focus:border-cyan-500/50 outline-none transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-orbitron text-cyan-400 uppercase tracking-widest">Highlight</label>
              <input type="text" value={form.titleHighlight || ''} onChange={e => handleInputChange('titleHighlight', e.target.value)} className="w-full bg-slate-950 border border-cyan-500/30 rounded-lg px-4 py-3 text-sm text-cyan-300 focus:border-cyan-500/50 outline-none transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-orbitron text-slate-400 uppercase tracking-widest">Suffix</label>
              <input type="text" value={form.titleSuffix || ''} onChange={e => handleInputChange('titleSuffix', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white focus:border-cyan-500/50 outline-none transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-orbitron text-slate-400 uppercase tracking-widest">Main Button Label</label>
              <input type="text" value={form.buttonText || ''} onChange={e => handleInputChange('buttonText', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/50 transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-orbitron text-slate-400 uppercase tracking-widest">Standby Status Text</label>
              <input type="text" value={form.readyText || ''} onChange={e => handleInputChange('readyText', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-cyan-500/50 transition-all" />
            </div>
          </div>

          {/* New Scrolling Text Field */}
          <div className="space-y-2">
             <label className="text-[9px] font-orbitron text-amber-400 uppercase tracking-widest">Scrolling Message (Footer)</label>
             <input 
               type="text" 
               value={form.scrollingText || ''} 
               onChange={e => handleInputChange('scrollingText', e.target.value)} 
               className="w-full bg-slate-950 border border-amber-500/30 rounded-lg px-4 py-3 text-sm text-amber-100 outline-none focus:border-amber-500/50 transition-all"
               placeholder="Enter marquee text..."
             />
          </div>
        </div>

        {/* Media Asset Management */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-2xl">
          <h2 className="text-xs font-orbitron font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <span className="w-4 h-[1px] bg-slate-700"></span>
            Media Asset Pipeline
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[
              { label: 'SPLASH SCREEN VIDEO', key: 'splashVideoUrl', type: 'splash' },
              { label: 'WAITING LOOP VIDEO', key: 'waitingUrl', type: 'waiting' },
              { label: 'COUNTDOWN SOURCE', key: 'countdownUrl', type: 'countdown' },
              { label: 'MAIN ACTIVATION CLIP', key: 'activatedUrl', type: 'activated' }
            ].map((field) => (
              <div key={field.key} className="space-y-3">
                <label className="text-[10px] font-orbitron text-slate-400 tracking-wider uppercase">{field.label}</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={(form as any)[field.key] || ''} 
                    onChange={e => handleInputChange(field.key as any, e.target.value)}
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-xs outline-none focus:border-cyan-500/50 transition-all font-mono text-cyan-300/70"
                    placeholder="Enter URL..."
                  />
                  <input type="file" ref={(fileInputs as any)[field.type]} className="hidden" accept="video/*" onChange={e => handleFileUpload(e, field.type as any)} />
                  <button 
                    onClick={() => (fileInputs as any)[field.type].current?.click()} 
                    className="px-4 bg-slate-800 hover:bg-slate-700 rounded-lg text-[9px] font-orbitron border border-slate-700 transition-all text-slate-300 whitespace-nowrap"
                  >
                    {(uploadProgress as any)[field.type] > 0 ? `${(uploadProgress as any)[field.type]}%` : 'UPLOAD FILE'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-6 border-t border-slate-800 flex justify-end">
            <button 
              onClick={handleSaveAll}
              disabled={isUpdating}
              className="px-12 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-orbitron font-bold rounded-xl transition-all disabled:opacity-50 text-xs tracking-[0.2em] shadow-[0_0_20px_rgba(6,182,212,0.3)] active:scale-95"
            >
              {isUpdating ? 'SYNCHRONIZING...' : 'SAVE CONFIG & TEXT DATA'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminView;