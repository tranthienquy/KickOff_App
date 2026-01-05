
import React, { useState, useEffect } from 'react';
import { AppState, EventStatus } from '../types';
import { syncState, updateStatus, updateUrls, resetSystem, isFirebaseConnected } from '../services/firebase';

const AdminView: React.FC = () => {
  const [state, setState] = useState<AppState | null>(null);
  const [countdownUrl, setCountdownUrl] = useState('');
  const [activatedUrl, setActivatedUrl] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const connected = isFirebaseConnected();

  useEffect(() => {
    const unsubscribe = syncState((newState) => {
      setState(newState);
      if (!countdownUrl) setCountdownUrl(newState.countdownUrl);
      if (!activatedUrl) setActivatedUrl(newState.activatedUrl);
    });
    return () => unsubscribe();
  }, []);

  const handleUpdateUrls = async () => {
    setIsUpdating(true);
    await updateUrls(countdownUrl, activatedUrl);
    setIsUpdating(false);
    alert('SUCCESS: Media URLs synchronized to all devices.');
  };

  if (!state) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-cyan-400 font-orbitron animate-pulse">ESTABLISHING ENCRYPTED LINK...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-inter p-6">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Connection Warning */}
        {!connected && (
          <div className="bg-amber-500/10 border border-amber-500/50 p-4 rounded-xl flex items-center gap-4 text-amber-500">
            <span className="text-2xl">⚠️</span>
            <div className="text-sm font-orbitron">
              <b>OFFLINE DEMO MODE:</b> Firebase configuration missing in <code className="bg-black/50 px-2 py-1">services/firebase.ts</code>. 
              Syncing between devices will not work until keys are added.
            </div>
          </div>
        )}

        {/* Header Dashboard */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center p-6 bg-slate-900/50 border border-slate-800 rounded-2xl gap-4">
          <div>
            <h1 className="text-2xl font-orbitron font-bold text-white flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full ${connected ? 'bg-emerald-500 shadow-[0_0_12px_#10b981]' : 'bg-red-500'}`}></span>
              COMMAND CENTER
            </h1>
            <p className="text-slate-500 text-xs font-orbitron tracking-widest mt-1 uppercase">
              {connected ? 'Cloud Connected' : 'Offline Mode'}
            </p>
          </div>
          <div className="flex gap-2">
             <div className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg">
                <div className="text-[10px] text-slate-500 font-orbitron uppercase">Global State</div>
                <div className="text-cyan-400 font-orbitron font-bold uppercase">{state.status}</div>
             </div>
          </div>
        </div>

        {/* Control Buttons Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button 
            onClick={() => updateStatus(EventStatus.COUNTDOWN)}
            className={`group relative h-48 rounded-2xl border transition-all overflow-hidden flex flex-col items-center justify-center gap-4 ${state.status === EventStatus.COUNTDOWN ? 'bg-amber-500/20 border-amber-500 shadow-lg shadow-amber-500/20' : 'bg-slate-900 border-slate-800 hover:border-amber-500/50'}`}
          >
            <div className={`text-5xl transition-transform group-hover:scale-110 ${state.status === EventStatus.COUNTDOWN ? 'animate-pulse' : ''}`}>⏱️</div>
            <div className="text-center">
              <div className="font-orbitron font-bold text-white">START COUNTDOWN</div>
              <div className="text-[10px] text-slate-500 font-orbitron mt-1 uppercase tracking-widest">Stage 1: Prep</div>
            </div>
          </button>

          <button 
            onClick={() => updateStatus(EventStatus.TRIGGER_READY)}
            className={`group relative h-48 rounded-2xl border transition-all overflow-hidden flex flex-col items-center justify-center gap-4 ${state.status === EventStatus.TRIGGER_READY ? 'bg-cyan-500/20 border-cyan-500 shadow-lg shadow-cyan-500/20' : 'bg-slate-900 border-slate-800 hover:border-cyan-500/50'}`}
          >
            <div className={`text-5xl transition-transform group-hover:scale-110 ${state.status === EventStatus.TRIGGER_READY ? 'animate-ping' : ''}`}>⚡</div>
            <div className="text-center">
              <div className="font-orbitron font-bold text-white">READY TRIGGER</div>
              <div className="text-[10px] text-slate-500 font-orbitron mt-1 uppercase tracking-widest">Stage 2: Pulse</div>
            </div>
          </button>

          <button 
            onClick={() => updateStatus(EventStatus.ACTIVATED)}
            className={`group relative h-48 rounded-2xl border transition-all overflow-hidden flex flex-col items-center justify-center gap-4 ${state.status === EventStatus.ACTIVATED ? 'bg-emerald-500/20 border-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-slate-900 border-slate-800 hover:border-emerald-500/50'}`}
          >
            <div className={`text-5xl transition-transform group-hover:scale-110 ${state.status === EventStatus.ACTIVATED ? 'rotate-12' : ''}`}>🚀</div>
            <div className="text-center">
              <div className="font-orbitron font-bold text-white">FINAL LAUNCH</div>
              <div className="text-[10px] text-slate-500 font-orbitron mt-1 uppercase tracking-widest">Stage 3: Play</div>
            </div>
          </button>
        </div>

        {/* Media Setup Section */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 space-y-6">
          <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
            <div className="w-8 h-8 bg-pink-500/20 flex items-center justify-center rounded text-pink-500">📁</div>
            <h2 className="text-xl font-orbitron font-bold text-white uppercase tracking-tighter">Media Configuration</h2>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <label className="block text-xs font-orbitron text-slate-400 uppercase tracking-widest">Countdown Clip (URL)</label>
              <input 
                type="text" 
                value={countdownUrl}
                onChange={(e) => setCountdownUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-sm focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                placeholder="Paste MP4 URL here"
              />
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-orbitron text-slate-400 uppercase tracking-widest">Activation Clip (URL)</label>
              <input 
                type="text" 
                value={activatedUrl}
                onChange={(e) => setActivatedUrl(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-5 py-4 text-sm focus:ring-2 focus:ring-cyan-500 outline-none transition-all"
                placeholder="Paste MP4 URL here"
              />
            </div>
          </div>

          <div className="pt-4 flex flex-col md:flex-row gap-4 items-center justify-between">
            <div className="text-[10px] text-slate-500 font-orbitron italic">
              * URLs are sent to all connected iPads for pre-caching.
            </div>
            <button 
              onClick={handleUpdateUrls}
              disabled={isUpdating}
              className="px-10 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-orbitron font-bold rounded-xl transition-all shadow-xl shadow-cyan-500/20 flex items-center gap-3 disabled:opacity-50"
            >
              {isUpdating ? 'UPLOADING...' : 'SYNC MEDIA'}
            </button>
          </div>
        </div>

        {/* Global Reset */}
        <div className="flex justify-center">
           <button 
             onClick={() => { if(confirm('Factory reset system?')) resetSystem(); }}
             className="text-slate-700 hover:text-red-500 text-[10px] font-orbitron uppercase tracking-[0.2em] transition-colors"
           >
             System Emergency Reset
           </button>
        </div>

      </div>
    </div>
  );
};

export default AdminView;
