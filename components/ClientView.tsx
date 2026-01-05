
import React, { useState, useEffect, useRef } from 'react';
import { AppState, EventStatus } from '../types.ts';
import { syncState, getServerTime, trackDevice } from '../services/firebase.ts';

const ClientView: React.FC = () => {
  const [state, setState] = useState<AppState | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [isMediaLoading, setIsMediaLoading] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const prevStateRef = useRef<AppState | null>(null);
  const loadingTimeoutRef = useRef<any>(null);
  
  useEffect(() => {
    trackDevice();
    const unsubscribe = syncState((newState) => {
      const prev = prevStateRef.current;
      const statusChanged = !prev || newState.status !== prev.status;
      const urlChanged = prev && (
        newState.waitingUrl !== prev.waitingUrl ||
        newState.countdownUrl !== prev.countdownUrl ||
        newState.activatedUrl !== prev.activatedUrl
      );

      if (statusChanged || urlChanged || newState.timestamp !== prev?.timestamp) {
        setIsMediaLoading(true);
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = setTimeout(() => setIsMediaLoading(false), 2000);
      }

      prevStateRef.current = newState;
      setState(newState);
    });
    return () => {
      unsubscribe();
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (state) {
      const isMuted = !unlocked || state.status !== EventStatus.ACTIVATED;
      let url = state.waitingUrl;
      if (state.status === EventStatus.COUNTDOWN) url = state.countdownUrl;
      else if (state.status === EventStatus.ACTIVATED) url = state.activatedUrl;

      const media = getMediaSource(url, isMuted);

      if (media.type === 'native' && videoRef.current) {
        if (videoRef.current.src !== media.src) {
          videoRef.current.src = media.src;
          videoRef.current.load();
        }
        videoRef.current.muted = isMuted;
        videoRef.current.loop = true;
        
        const elapsed = Math.max(0, (getServerTime() - state.timestamp) / 1000);
        videoRef.current.currentTime = elapsed;
        
        videoRef.current.play().catch(() => {
          if (videoRef.current) {
            videoRef.current.muted = true;
            videoRef.current.play().catch(() => {});
          }
        });
      }
    }
  }, [state?.status, state?.timestamp, state?.countdownUrl, state?.activatedUrl, state?.waitingUrl, unlocked]);

  const handleUnlock = () => {
    setUnlocked(true);
    if (videoRef.current) {
      videoRef.current.muted = state?.status !== EventStatus.ACTIVATED;
      videoRef.current.play().catch(() => {});
    }
  };

  const getMediaSource = (url: string, isMuted: boolean = true) => {
    const youtubeRegex = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(youtubeRegex);
    const startParam = state ? Math.floor(Math.max(0, (getServerTime() - state.timestamp) / 1000)) : 0;
    if (match && match[2].length === 11) {
      const videoId = match[2];
      return {
        type: 'youtube',
        src: `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&mute=${isMuted ? 1 : 0}&loop=1&playlist=${videoId}&rel=0&showinfo=0&iv_load_policy=3&modestbranding=1&playsinline=1&enablejsapi=1&start=${startParam}`
      };
    }
    return { type: 'native', src: url };
  };

  if (!state) return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#040d0a]">
      <div className="text-cyan-400 animate-pulse font-orbitron tracking-widest text-xs">CONNECTING TO EVENT SERVER...</div>
    </div>
  );

  const currentIsMuted = !unlocked || state.status !== EventStatus.ACTIVATED;
  let currentUrl = state.waitingUrl;
  if (state.status === EventStatus.COUNTDOWN) currentUrl = state.countdownUrl;
  if (state.status === EventStatus.ACTIVATED) currentUrl = state.activatedUrl;
  const currentMedia = getMediaSource(currentUrl, currentIsMuted);

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-[#040d0a] selection:none">
      
      {/* LAYER 0: VIDEO BACKGROUND */}
      <div className="absolute inset-0 z-0 bg-black">
        <video 
          ref={videoRef}
          className={`w-full h-full object-cover transition-opacity duration-1000 ${currentMedia.type === 'native' ? 'opacity-100' : 'opacity-0'}`}
          playsInline 
          muted={currentIsMuted}
          preload="auto"
          onPlaying={() => setIsBuffering(false)}
          onWaiting={() => setIsBuffering(true)}
        />
        {currentMedia.type === 'youtube' && (
          <iframe 
            key={`${state.status}_${currentUrl}`}
            src={currentMedia.src}
            className="w-full h-full pointer-events-none scale-[1.35] md:scale-[1.1]"
            frameBorder="0"
            allow="autoplay; encrypted-media"
          />
        )}
        <div className="absolute inset-0 bg-black/40 z-[1]"></div>
      </div>

      {/* LAYER 1: BRANDING GRID */}
      <div className="absolute inset-0 z-[2] bg-brand-grid opacity-30 pointer-events-none"></div>

      {/* LAYER 2: STATUS UI (WAITING) */}
      <div className={`absolute inset-0 z-10 flex flex-col items-center justify-center transition-all duration-1000 ${state.status === EventStatus.WAITING && unlocked ? 'opacity-100' : 'opacity-0 pointer-events-none translate-y-10'}`}>
        <div className="relative group">
          <div className="w-48 h-48 md:w-64 md:h-64 rounded-full border-2 border-white/5 flex items-center justify-center bg-black/20 backdrop-blur-md">
            <div className="absolute inset-0 rounded-full border-t-4 border-orange-500/40 animate-[spin_3s_linear_infinite]"></div>
            <div className="absolute inset-4 rounded-full border-b-2 border-cyan-400/20 animate-[spin_5s_linear_infinite_reverse]"></div>
            <div className="text-3xl font-orbitron font-bold text-white glow-orange tracking-[0.3em]">READY</div>
          </div>
          <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-max text-center">
            <div className="text-[10px] font-orbitron text-cyan-400 tracking-[0.8em] uppercase mb-2">System Standby</div>
            <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-orange-500/50 to-transparent"></div>
          </div>
        </div>
      </div>

      {/* LAYER 3: INITIALIZE / SPLASH SCREEN */}
      {!unlocked && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black/60 backdrop-blur-xl">
          <div className="max-w-4xl w-full px-8 flex flex-col items-center gap-12 text-center">
            
            {/* Header Tagline from image */}
            <div className="space-y-4">
              <div className="inline-block px-4 py-1 bg-white rounded-md">
                <span className="text-black font-orbitron font-bold text-[10px] tracking-widest uppercase">Cuộc thi sáng tạo cùng AI</span>
              </div>
              <h1 className="text-6xl md:text-9xl font-orbitron font-bold text-white glow-orange tracking-tighter">
                AI <span className="text-orange-500">YOUNG</span> GURU
              </h1>
              <div className="flex items-center justify-center gap-2">
                <span className="text-orange-500 font-bold text-lg md:text-2xl">Gen Z</span>
                <span className="text-green-400 font-medium text-lg md:text-2xl">làm chủ công nghệ</span>
              </div>
            </div>

            {/* Mascot Placeholder Interaction */}
            <div className="relative w-48 h-48 md:w-64 md:h-64 animate-float">
               <div className="absolute inset-0 bg-orange-500/20 blur-3xl rounded-full"></div>
               {/* Thay bằng ảnh Mascot thật nếu có URL */}
               <div className="relative z-10 w-full h-full flex items-center justify-center">
                 <div className="w-full h-full bg-orange-500/10 rounded-3xl border border-orange-500/30 flex items-center justify-center overflow-hidden backdrop-blur-sm">
                    <span className="text-orange-500 font-orbitron text-[8px] tracking-widest opacity-50">MASCOT_PREVIEW</span>
                 </div>
               </div>
            </div>

            <button 
              onClick={handleUnlock}
              className="group relative px-16 py-6 bg-transparent overflow-hidden rounded-full transition-all active:scale-95 border-2 border-cyan-400/30 hover:border-cyan-400/60 shadow-[0_0_40px_rgba(34,211,238,0.1)]"
            >
              <div className="absolute inset-0 bg-cyan-400/5 group-hover:bg-cyan-400/10 transition-colors"></div>
              <span className="relative z-10 text-cyan-400 font-orbitron font-bold text-lg tracking-[0.3em]">START SESSION</span>
            </button>
          </div>
        </div>
      )}

      {/* LAYER 4: LOADING / BUFFERING OVERLAY */}
      {(isMediaLoading || isBuffering) && unlocked && (
        <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-[150] flex flex-col items-center">
          <div className="w-64 h-[2px] bg-white/5 rounded-full overflow-hidden">
            <div className="h-full bg-orange-500 animate-[loading_2s_infinite_linear]"></div>
          </div>
          <span className="mt-3 text-[8px] font-orbitron text-orange-500/70 tracking-[0.5em] uppercase font-bold">Syncing Temporal Stream</span>
        </div>
      )}

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};

export default ClientView;
