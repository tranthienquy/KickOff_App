
import React, { useState, useEffect, useRef } from 'react';
import { AppState, EventStatus } from '../types.ts';
import { syncState } from '../services/firebase.ts';

const ClientView: React.FC = () => {
  const [state, setState] = useState<AppState | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [isMediaLoading, setIsMediaLoading] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const prevStateRef = useRef<AppState | null>(null);
  const loadingTimeoutRef = useRef<any>(null);
  
  // 1. Theo dõi trạng thái từ Firebase
  useEffect(() => {
    const unsubscribe = syncState((newState) => {
      const prev = prevStateRef.current;
      
      // Kiểm tra sự thay đổi status hoặc timestamp (để đồng bộ lại khi Admin nhấn lại nút cũ)
      const hasChanged = !prev || 
        newState.status !== prev.status || 
        newState.timestamp !== prev.timestamp ||
        newState.countdownUrl !== prev.countdownUrl || 
        newState.activatedUrl !== prev.activatedUrl;

      if (hasChanged && newState.status !== EventStatus.WAITING) {
        setIsMediaLoading(true);
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = setTimeout(() => {
          setIsMediaLoading(false);
        }, 4000);
      }

      prevStateRef.current = newState;
      setState(newState);
    });

    return () => {
      unsubscribe();
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    };
  }, []);

  // 2. Logic đồng bộ hóa video (Syncing)
  useEffect(() => {
    if (unlocked && state && state.status !== EventStatus.WAITING) {
      const isMuted = state.status === EventStatus.COUNTDOWN;
      const url = isMuted ? state.countdownUrl : state.activatedUrl;
      const media = getMediaSource(url, isMuted);

      // Tính toán độ trễ (elapsed time) tính bằng giây
      const elapsedSeconds = Math.max(0, (Date.now() - state.timestamp) / 1000);

      if (media.type === 'native' && videoRef.current) {
        videoRef.current.src = media.src;
        videoRef.current.muted = isMuted;
        videoRef.current.loop = isMuted;
        videoRef.current.load();
        
        // Nhảy đến đúng vị trí thời gian đã trôi qua
        videoRef.current.currentTime = elapsedSeconds;
        
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error("Autoplay failed:", error);
            setTimeout(() => {
              if (videoRef.current) {
                // Thử đồng bộ lại lần nữa khi phát lại
                const retryElapsed = Math.max(0, (Date.now() - state.timestamp) / 1000);
                videoRef.current.currentTime = retryElapsed;
                videoRef.current.play();
              }
            }, 1000);
          });
        }
      }
    }
  }, [state?.status, state?.timestamp, state?.countdownUrl, state?.activatedUrl, unlocked]);

  const handleUnlock = () => {
    setUnlocked(true);
    if (videoRef.current) {
      videoRef.current.play().then(() => {
        videoRef.current?.pause();
      }).catch(e => console.log("Priming failed", e));
    }
  };

  const handleMediaReady = () => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    setIsMediaLoading(false);
  };

  const getMediaSource = (url: string, isMuted: boolean = true) => {
    const youtubeRegex = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(youtubeRegex);
    
    // Tính toán thời gian bắt đầu cho YouTube (&start=...)
    const startParam = state ? Math.floor(Math.max(0, (Date.now() - state.timestamp) / 1000)) : 0;

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
    <div className="h-screen w-screen flex items-center justify-center bg-[#000510]">
      <div className="text-cyan-400 animate-pulse font-orbitron tracking-widest text-xs">ESTABLISHING UPLINK...</div>
    </div>
  );

  const currentIsMuted = state.status === EventStatus.COUNTDOWN;
  const currentUrl = currentIsMuted ? state.countdownUrl : state.activatedUrl;
  const currentMedia = getMediaSource(currentUrl, currentIsMuted);
  const showMedia = unlocked && state.status !== EventStatus.WAITING;

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-[#000510] bg-grid selection:bg-none">
      
      <div className={`absolute inset-0 z-10 bg-black transition-opacity duration-1000 ${showMedia ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* NATIVE VIDEO PLAYER */}
        <video 
          ref={videoRef}
          className={`w-full h-full object-cover ${currentMedia.type === 'native' ? 'block' : 'hidden'}`}
          playsInline 
          onLoadedData={handleMediaReady}
          onPlaying={handleMediaReady}
        />

        {/* YOUTUBE PLAYER - Sử dụng key bao gồm timestamp để force reload iframe khi Admin nhấn lại */}
        {currentMedia.type === 'youtube' && showMedia && (
          <iframe 
            ref={iframeRef}
            key={`${currentMedia.src}_${state.timestamp}`}
            src={currentMedia.src}
            className="w-full h-full pointer-events-none scale-[1.35] md:scale-[1.1]"
            frameBorder="0"
            allow="autoplay; encrypted-media"
            onLoad={handleMediaReady}
          />
        )}
        
        {state.status === EventStatus.COUNTDOWN && (
          <div className="absolute bottom-8 left-8 z-50 px-4 py-2 border border-cyan-500/20 bg-black/60 backdrop-blur-md rounded-md">
             <div className="text-[9px] font-orbitron text-cyan-400 tracking-[0.3em] animate-pulse uppercase">
               Synchronized Uplink Active
             </div>
          </div>
        )}

        {state.status === EventStatus.ACTIVATED && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40">
             <div className="w-full border-y border-white/5 py-8 bg-white/[0.02] backdrop-blur-sm animate-in zoom-in fade-in duration-1000">
                <div className="text-center">
                  <h2 className="text-7xl md:text-[12rem] font-orbitron font-bold text-white glow-text tracking-tighter opacity-20 uppercase">Launch</h2>
                </div>
             </div>
          </div>
        )}
      </div>

      {/* Buffering/Syncing State Overlay */}
      {unlocked && isMediaLoading && (
        <div className="absolute inset-0 z-[150] flex flex-col items-center justify-center bg-[#000510]/95 backdrop-blur-md">
          <div className="w-48 h-1 bg-slate-900 rounded-full overflow-hidden border border-cyan-500/20">
             <div className="h-full bg-cyan-500 animate-[loading_1.5s_infinite_ease-in-out]"></div>
          </div>
          <div className="mt-4 text-[9px] font-orbitron text-cyan-500 tracking-[0.3em] animate-pulse">RECALIBRATING TIME SYNC...</div>
        </div>
      )}

      {!unlocked && (
        <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center bg-[#000510]">
          <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-500/30 via-transparent to-transparent"></div>
          <div className="text-center space-y-12 z-10 px-6">
            <h1 className="text-5xl md:text-8xl font-orbitron font-bold text-white glow-text tracking-tighter">
              AI <span className="text-cyan-400">YOUNG</span> GURU
            </h1>
            <p className="text-cyan-500/60 font-orbitron tracking-[0.5em] text-[10px] md:text-sm uppercase">Secure Event Node v2.7 [SYNC-READY]</p>
            <button 
              onClick={handleUnlock}
              className="group relative px-12 py-6 bg-transparent overflow-hidden border border-cyan-500/50 rounded-lg hover:border-cyan-400 transition-colors"
            >
              <div className="absolute inset-0 bg-cyan-500/10 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <span className="relative z-10 font-orbitron font-bold text-lg text-cyan-400 transition-colors uppercase tracking-[0.2em]">INITIALIZE SYSTEM</span>
            </button>
          </div>
        </div>
      )}

      <div className={`h-full w-full flex flex-col items-center justify-center transition-all duration-1000 ${state.status === EventStatus.WAITING ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
        <div className="relative">
          <div className="w-64 h-64 md:w-80 md:h-80 rounded-full border border-cyan-500/10 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-t-2 border-cyan-500/40 animate-spin duration-[3s]"></div>
            <div className="absolute inset-4 rounded-full border-b-2 border-cyan-500/20 animate-spin-reverse duration-[5s]"></div>
            <div className="flex flex-col items-center justify-center text-center">
               <div className="text-cyan-500/40 font-orbitron text-[9px] mb-2 tracking-[0.4em] uppercase">Node Status</div>
               <div className="text-3xl md:text-4xl font-orbitron font-bold text-white glow-text uppercase tracking-widest">Standby</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        @keyframes spin-reverse {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        .animate-spin-reverse {
          animation: spin-reverse linear infinite;
        }
        .bg-grid {
          background-image: linear-gradient(to right, rgba(0, 242, 255, 0.02) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(0, 242, 255, 0.02) 1px, transparent 1px);
          background-size: 50px 50px;
        }
      `}</style>
    </div>
  );
};

export default ClientView;
