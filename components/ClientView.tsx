
import React, { useState, useEffect, useRef } from 'react';
import { AppState, EventStatus } from '../types';
import { syncState } from '../services/firebase';

const ClientView: React.FC = () => {
  const [state, setState] = useState<AppState | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [isInternalTransition, setIsInternalTransition] = useState(false);
  
  const countdownVideoRef = useRef<HTMLVideoElement>(null);
  const activatedVideoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const unsubscribe = syncState((newState) => {
      setState(newState);
    });
    return () => unsubscribe();
  }, []);

  // Sync Video playback with status changes
  useEffect(() => {
    if (!state || !unlocked) return;

    if (state.status === EventStatus.COUNTDOWN) {
      if (countdownVideoRef.current) {
        countdownVideoRef.current.currentTime = 0;
        countdownVideoRef.current.play().catch(console.error);
      }
    } else if (state.status === EventStatus.ACTIVATED) {
      if (activatedVideoRef.current) {
        activatedVideoRef.current.currentTime = 0;
        activatedVideoRef.current.play().catch(console.error);
      }
    }
  }, [state?.status, unlocked]);

  const handleUnlock = () => {
    // Crucial for iOS/Safari: video.load() inside a user click event unlocks media policies
    if (countdownVideoRef.current) {
      countdownVideoRef.current.load();
    }
    if (activatedVideoRef.current) {
      activatedVideoRef.current.load();
    }
    setUnlocked(true);
  };

  const handleCountdownEnded = () => {
    // Once countdown ends, we show the Pulse UI locally 
    // Usually admin might trigger it, but local fallback is safer for sync
    setIsInternalTransition(true);
  };

  if (!state) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#000510]">
        <div className="text-cyan-400 animate-pulse font-orbitron">INITIALIZING SYSTEM...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-[#000510] bg-grid">
      
      {/* Background UI Layer */}
      <div className="absolute inset-0 z-0 opacity-20 pointer-events-none">
        <div className="absolute top-10 left-10 w-32 h-32 border-l border-t border-cyan-500/50"></div>
        <div className="absolute bottom-10 right-10 w-32 h-32 border-r border-b border-cyan-500/50"></div>
      </div>

      {/* 1. UNLOCK LAYER (iOS Mandatory) */}
      {!unlocked && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#000510] backdrop-blur-md">
          <div className="text-center space-y-8 p-12 border border-cyan-900 bg-cyan-950/20 rounded-2xl glow-text">
            <h1 className="text-4xl md:text-6xl font-orbitron font-bold text-[#00f2ff]">AI YOUNG GURU</h1>
            <p className="text-cyan-200/60 font-orbitron tracking-widest text-sm">SECURE LINK ESTABLISHED</p>
            <button 
              onClick={handleUnlock}
              className="px-12 py-6 bg-cyan-500 text-[#000510] font-orbitron font-bold text-xl rounded-full hover:bg-cyan-400 transition-all transform active:scale-95 shadow-lg shadow-cyan-500/50"
            >
              SYNC & START
            </button>
          </div>
        </div>
      )}

      {/* 2. WAITING STATE */}
      {unlocked && state.status === EventStatus.WAITING && (
        <div className="h-full w-full flex flex-col items-center justify-center">
          <div className="relative">
             <div className="w-64 h-64 rounded-full border-4 border-cyan-900 flex items-center justify-center animate-spin-slow duration-[10s]">
                <div className="w-56 h-56 rounded-full border-2 border-cyan-500/20 border-t-cyan-500 animate-spin"></div>
             </div>
             <div className="absolute inset-0 flex flex-col items-center justify-center">
               <span className="text-cyan-500 font-orbitron text-xs tracking-tighter mb-2">NODE ACTIVE</span>
               <span className="text-3xl font-orbitron font-bold text-white glow-text">READY</span>
             </div>
          </div>
          <div className="mt-12 text-cyan-200/40 font-orbitron text-xs animate-pulse">
            WAITING FOR COMMAND SIGNAL...
          </div>
        </div>
      )}

      {/* 3. COUNTDOWN STATE */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${state.status === EventStatus.COUNTDOWN ? 'opacity-100 z-10' : 'opacity-0 -z-10'}`}>
        <video 
          ref={countdownVideoRef}
          src={state.countdownUrl}
          className="w-full h-full object-cover"
          playsInline
          webkit-playsinline="true"
          muted // Auto-play often requires muted on iOS, but since we had a click, we could un-mute
          onEnded={handleCountdownEnded}
        />
      </div>

      {/* 4. TRIGGER READY STATE (Pulse UI) */}
      {(state.status === EventStatus.TRIGGER_READY || (state.status === EventStatus.COUNTDOWN && isInternalTransition)) && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#000510]/80">
          <div className="text-center space-y-12">
            <div className="font-orbitron text-2xl text-cyan-400 tracking-widest glow-text">FINAL ACTIVATION</div>
            <div 
               className="w-64 h-64 md:w-96 md:h-96 rounded-full bg-cyan-500/20 border-4 border-cyan-500 flex items-center justify-center animate-pulse-neon cursor-pointer"
               onClick={() => {/* Final touch logic if needed, usually Admin controls this */}}
            >
              <div className="w-48 h-48 md:w-72 md:h-72 rounded-full border-2 border-dashed border-cyan-500/40 animate-spin-slow"></div>
              <div className="absolute font-orbitron text-4xl font-bold text-white tracking-widest text-center">
                TOUCH TO<br/>ACTIVATE
              </div>
            </div>
            <div className="text-cyan-500/40 font-orbitron animate-bounce">
              WAITING FOR FINAL TRIGGER
            </div>
          </div>
        </div>
      )}

      {/* 5. ACTIVATED STATE */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${state.status === EventStatus.ACTIVATED ? 'opacity-100 z-30' : 'opacity-0 -z-10'}`}>
        <video 
          ref={activatedVideoRef}
          src={state.activatedUrl}
          className="w-full h-full object-cover"
          playsInline
          webkit-playsinline="true"
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="p-8 border-4 border-white font-orbitron text-7xl font-bold text-white uppercase tracking-tighter glow-text bg-black/30 backdrop-blur-sm">
            LAUNCHED
          </div>
        </div>
      </div>

    </div>
  );
};

export default ClientView;
