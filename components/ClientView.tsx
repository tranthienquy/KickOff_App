
import React, { useState, useEffect, useRef } from 'react';
import { AppState, EventStatus } from '../types';
import { syncState } from '../services/firebase';

const ClientView: React.FC = () => {
  const [state, setState] = useState<AppState | null>(null);
  const [unlocked, setUnlocked] = useState(false);
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
    // Unlocking media for iOS
    if (countdownVideoRef.current) countdownVideoRef.current.load();
    if (activatedVideoRef.current) activatedVideoRef.current.load();
    setUnlocked(true);
  };

  if (!state) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#000510]">
        <div className="text-cyan-400 animate-pulse font-orbitron tracking-widest">CONNECTING TO NODE...</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-[#000510] bg-grid selection:bg-none">
      
      {/* 1. START/UNLOCK SCREEN */}
      {!unlocked && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#000510]">
          <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-500/20 via-transparent to-transparent"></div>
          <div className="text-center space-y-12 z-10 px-6">
            <h1 className="text-5xl md:text-8xl font-orbitron font-bold text-white glow-text tracking-tighter">
              AI <span className="text-cyan-400">YOUNG</span> GURU
            </h1>
            <p className="text-cyan-500/60 font-orbitron tracking-[0.5em] text-sm md:text-xl">CONTEST LAUNCH SYSTEM</p>
            <button 
              onClick={handleUnlock}
              className="group relative px-16 py-8 bg-transparent overflow-hidden border-2 border-cyan-500 rounded-lg"
            >
              <div className="absolute inset-0 bg-cyan-500 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <span className="relative z-10 font-orbitron font-bold text-2xl text-cyan-400 group-hover:text-black transition-colors">START SYSTEM</span>
            </button>
          </div>
        </div>
      )}

      {/* 2. WAITING STATE */}
      <div className={`h-full w-full flex flex-col items-center justify-center transition-opacity duration-1000 ${state.status === EventStatus.WAITING ? 'opacity-100' : 'opacity-0'}`}>
        <div className="relative">
          <div className="w-80 h-80 rounded-full border border-cyan-500/20 flex items-center justify-center">
            <div className="w-72 h-72 rounded-full border-2 border-cyan-500/10 border-t-cyan-500 animate-spin duration-[3s]"></div>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
               <div className="text-cyan-500 font-orbitron text-xs mb-2 tracking-widest opacity-50 underline decoration-cyan-500/50 underline-offset-8">SYSTEM STATUS</div>
               <div className="text-5xl font-orbitron font-bold text-white glow-text">READY</div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. COUNTDOWN VIDEO */}
      <div className={`absolute inset-0 transition-opacity duration-700 ${state.status === EventStatus.COUNTDOWN ? 'opacity-100 z-10' : 'opacity-0 -z-10'}`}>
        <video 
          ref={countdownVideoRef}
          src={state.countdownUrl}
          className="w-full h-full object-cover"
          playsInline
          webkit-playsinline="true"
          muted // Required for some browsers to auto-play, even after interaction
        />
      </div>

      {/* 4. TRIGGER READY (Pulsing Button) */}
      {state.status === EventStatus.TRIGGER_READY && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#000510]/90 backdrop-blur-sm">
          <div className="text-center">
            <div className="font-orbitron text-cyan-400 text-2xl mb-16 tracking-[0.3em] glow-text">INITIATE FINAL LAUNCH</div>
            <div className="relative w-80 h-80 md:w-96 md:h-96 mx-auto cursor-pointer flex items-center justify-center">
              <div className="absolute inset-0 bg-cyan-500/20 rounded-full animate-ping"></div>
              <div className="absolute inset-0 border-4 border-cyan-500 rounded-full animate-pulse-neon"></div>
              <div className="z-10 text-white font-orbitron font-bold text-4xl tracking-tighter text-center">
                TOUCH TO<br/><span className="text-cyan-400 uppercase text-5xl">ACTIVATE</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. ACTIVATED VIDEO */}
      <div className={`absolute inset-0 transition-opacity duration-1000 ${state.status === EventStatus.ACTIVATED ? 'opacity-100 z-30' : 'opacity-0 -z-10'}`}>
        <video 
          ref={activatedVideoRef}
          src={state.activatedUrl}
          className="w-full h-full object-cover"
          playsInline
          webkit-playsinline="true"
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="px-12 py-6 border-y-4 border-cyan-400 bg-black/40 backdrop-blur-md">
            <h2 className="text-7xl md:text-9xl font-orbitron font-bold text-white glow-text tracking-tighter">LAUNCHED</h2>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ClientView;
