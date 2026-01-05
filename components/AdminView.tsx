
import React, { useState, useEffect } from 'react';
import { AppState, EventStatus } from '../types';
import { syncState, updateStatus, updateUrls, resetSystem } from '../services/firebase';

const AdminView: React.FC = () => {
  const [state, setState] = useState<AppState | null>(null);
  const [countdownUrl, setCountdownUrl] = useState('');
  const [activatedUrl, setActivatedUrl] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

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
    alert('Video sources updated for all clients.');
  };

  if (!state) return <div className="p-10 text-cyan-400">CONNECTING TO FIREBASE...</div>;

  return (
    <div className="min-h-screen bg-slate-950 text-white font-inter p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-cyan-900 pb-6">
          <div>
            <h1 className="text-3xl font-orbitron font-bold text-cyan-400">ADMIN CONTROL PANEL</h1>
            <p className="text-slate-400 text-sm">AI YOUNG GURU - EVENT SYNC v1.0</p>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${state ? 'bg-green-500' : 'bg-red-500'} shadow-[0_0_10px_rgba(34,197,94,0.5)]`}></div>
            <span className="text-xs font-orbitron tracking-widest uppercase">System Online</span>
          </div>
        </div>

        {/* Status Monitoring */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {Object.values(EventStatus).map((status) => (
            <div 
              key={status}
              className={`p-4 rounded-xl border-2 transition-all ${state.status === status ? 'border-cyan-500 bg-cyan-950/40 shadow-lg shadow-cyan-500/20' : 'border-slate-800 bg-slate-900/50 opacity-40'}`}
            >
              <div className="text-[10px] font-orbitron text-cyan-400 mb-1">CURRENT STATUS</div>
              <div className="font-orbitron font-bold uppercase truncate">{status.replace('_', ' ')}</div>
            </div>
          ))}
        </div>

        {/* Main Controls */}
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
          <h2 className="text-xl font-orbitron mb-6 flex items-center gap-2">
             <span className="w-2 h-6 bg-cyan-500 inline-block"></span>
             EXECUTION COMMANDS
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <button 
              onClick={() => updateStatus(EventStatus.COUNTDOWN)}
              disabled={state.status === EventStatus.COUNTDOWN}
              className="group relative overflow-hidden px-8 py-10 bg-slate-800 border border-cyan-800 rounded-xl hover:bg-cyan-900/40 transition-all flex flex-col items-center justify-center gap-2"
            >
              <div className="text-4xl">⏱️</div>
              <div className="font-orbitron font-bold text-cyan-400 group-hover:scale-110 transition-transform">START COUNTDOWN</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest">Triggers Client Videos</div>
            </button>

            <button 
              onClick={() => updateStatus(EventStatus.TRIGGER_READY)}
              disabled={state.status !== EventStatus.COUNTDOWN}
              className="group relative overflow-hidden px-8 py-10 bg-slate-800 border border-cyan-800 rounded-xl hover:bg-cyan-900/40 transition-all flex flex-col items-center justify-center gap-2"
            >
              <div className="text-4xl">⚡</div>
              <div className="font-orbitron font-bold text-cyan-400 group-hover:scale-110 transition-transform">PREPARE TOUCH</div>
              <div className="text-[10px] text-slate-500 uppercase tracking-widest">Enables Pulsing UI</div>
            </button>

            <button 
              onClick={() => updateStatus(EventStatus.ACTIVATED)}
              disabled={state.status === EventStatus.ACTIVATED}
              className="group relative overflow-hidden px-8 py-10 bg-cyan-600 border border-white rounded-xl hover:bg-cyan-500 transition-all flex flex-col items-center justify-center gap-2 shadow-2xl shadow-cyan-500/40"
            >
              <div className="text-4xl">🚀</div>
              <div className="font-orbitron font-bold text-white group-hover:scale-110 transition-transform">FINAL ACTIVATION</div>
              <div className="text-[10px] text-white/70 uppercase tracking-widest">The Big Moment</div>
            </button>
          </div>

          <div className="mt-8 pt-8 border-t border-slate-800 flex justify-center">
            <button 
              onClick={resetSystem}
              className="px-6 py-2 border border-red-900 text-red-400 font-orbitron text-xs rounded-full hover:bg-red-950 transition-colors"
            >
              RESET ENTIRE SYSTEM
            </button>
          </div>
        </div>

        {/* Media Configuration */}
        <div className="bg-slate-900 rounded-2xl p-6 border border-slate-800">
          <h2 className="text-xl font-orbitron mb-6 flex items-center gap-2">
             <span className="w-2 h-6 bg-pink-500 inline-block"></span>
             MEDIA SYNC
          </h2>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-orbitron text-slate-400 uppercase">Countdown Video URL</label>
              <input 
                type="text" 
                value={countdownUrl}
                onChange={(e) => setCountdownUrl(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                placeholder="https://..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-orbitron text-slate-400 uppercase">Activated Video URL</label>
              <input 
                type="text" 
                value={activatedUrl}
                onChange={(e) => setActivatedUrl(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-cyan-500 outline-none"
                placeholder="https://..."
              />
            </div>
            <button 
              onClick={handleUpdateUrls}
              disabled={isUpdating}
              className="w-full py-3 bg-slate-800 border border-slate-700 rounded-lg font-orbitron text-cyan-400 hover:bg-slate-700 transition-colors disabled:opacity-50"
            >
              {isUpdating ? 'UPLOADING SETTINGS...' : 'SYNC MEDIA TO ALL DEVICES'}
            </button>
          </div>
          <p className="mt-4 text-[10px] text-slate-500 italic">
            * Ensure video links are direct MP4/WebM paths with CORS enabled. Client iPads will automatically preload these when set.
          </p>
        </div>

      </div>
    </div>
  );
};

export default AdminView;
