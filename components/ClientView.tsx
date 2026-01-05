
import React, { useState, useEffect, useRef } from 'react';
import { AppState, EventStatus } from '../types';
import { syncState } from '../services/firebase';

const ClientView: React.FC = () => {
  const [state, setState] = useState<AppState | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [isMediaLoading, setIsMediaLoading] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  // Fix: Use ReturnType<typeof setTimeout> instead of NodeJS.Timeout to avoid namespace errors in browser environment
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  useEffect(() => {
    const unsubscribe = syncState((newState) => {
      setState(prev => {
        // Chỉ hiện loading nếu Status thay đổi sang một trạng thái media hoặc URL thay đổi
        if (prev && (newState.status !== prev.status || newState.countdownUrl !== prev.countdownUrl || newState.activatedUrl !== prev.activatedUrl)) {
          if (newState.status !== EventStatus.WAITING) {
            setIsMediaLoading(true);
            // Tự động tắt loading sau 3 giây nếu sự kiện media không kích hoạt (tránh kẹt)
            if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
            loadingTimeoutRef.current = setTimeout(() => {
              setIsMediaLoading(false);
            }, 3000);
          }
        }
        return newState;
      });
    });
    return () => {
      unsubscribe();
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (unlocked && videoRef.current && state && state.status !== EventStatus.WAITING) {
      videoRef.current.load();
      const playPromise = videoRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.log("Autoplay blocked, retrying...", error);
          setTimeout(() => videoRef.current?.play(), 500);
        });
      }
    }
  }, [state?.status, state?.countdownUrl, state?.activatedUrl, unlocked]);

  const handleUnlock = () => {
    setUnlocked(true);
    // Kích hoạt engine media trên mobile
    if (videoRef.current) {
      videoRef.current.play().then(() => {
        videoRef.current?.pause();
      }).catch(() => {});
    }
  };

  const handleMediaReady = () => {
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    setIsMediaLoading(false);
  };

  const getMediaSource = (url: string, isMuted: boolean = true) => {
    const youtubeRegex = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(youtubeRegex);
    
    if (match && match[2].length === 11) {
      const videoId = match[2];
      return {
        type: 'youtube',
        src: `https://www.youtube.com/embed/${videoId}?autoplay=1&controls=0&mute=${isMuted ? 1 : 0}&loop=1&playlist=${videoId}&rel=0&showinfo=0&iv_load_policy=3&modestbranding=1&playsinline=1&enablejsapi=1`
      };
    }
    return { type: 'native', src: url };
  };

  if (!state) return (
    <div className="h-screen w-screen flex items-center justify-center bg-[#000510]">
      <div className="text-cyan-400 animate-pulse font-orbitron tracking-widest">CONNECTING NODE...</div>
    </div>
  );

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-[#000510] bg-grid selection:bg-none">
      
      {/* Prime Media Hook */}
      <video ref={videoRef} className="hidden" playsInline muted />

      {/* Loading Overlay */}
      {unlocked && isMediaLoading && (
        <div className="absolute inset-0 z-[150] flex flex-col items-center justify-center bg-[#000510]/80 backdrop-blur-sm">
          <div className="w-48 h-1 bg-slate-900 rounded-full overflow-hidden border border-cyan-500/20">
             <div className="h-full bg-cyan-500 animate-[loading_1.5s_infinite_ease-in-out]"></div>
          </div>
          <div className="mt-4 text-[9px] font-orbitron text-cyan-500 tracking-[0.3em] animate-pulse">BUFFERING MEDIA...</div>
        </div>
      )}

      {/* Entry Screen */}
      {!unlocked && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-[#000510]">
          <div className="absolute inset-0 opacity-20 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-500/20 via-transparent to-transparent"></div>
          <div className="text-center space-y-12 z-10 px-6">
            <h1 className="text-5xl md:text-8xl font-orbitron font-bold text-white glow-text tracking-tighter">
              AI <span className="text-cyan-400">YOUNG</span> GURU
            </h1>
            <p className="text-cyan-500/60 font-orbitron tracking-[0.5em] text-sm md:text-xl uppercase">Contest Launch Console</p>
            <button 
              onClick={handleUnlock}
              className="group relative px-16 py-8 bg-transparent overflow-hidden border-2 border-cyan-500 rounded-lg"
            >
              <div className="absolute inset-0 bg-cyan-500 transform translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
              <span className="relative z-10 font-orbitron font-bold text-2xl text-cyan-400 group-hover:text-black transition-colors uppercase tracking-widest">START CONSOLE</span>
            </button>
          </div>
        </div>
      )}

      {/* Standby State (Waiting) */}
      <div className={`h-full w-full flex flex-col items-center justify-center transition-opacity duration-1000 ${state.status === EventStatus.WAITING ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="relative">
          <div className="w-80 h-80 rounded-full border border-cyan-500/20 flex items-center justify-center">
            <div className="w-72 h-72 rounded-full border-2 border-cyan-500/10 border-t-cyan-500 animate-spin duration-[4s]"></div>
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4">
               <div className="text-cyan-500 font-orbitron text-[10px] mb-2 tracking-[0.3em] opacity-50 uppercase">Ready For Sync</div>
               <div className="text-4xl font-orbitron font-bold text-white glow-text uppercase">Standby</div>
            </div>
          </div>
        </div>
      </div>

      {/* Video States (Clip Chờ & Clip Chính) */}
      {unlocked && (state.status === EventStatus.COUNTDOWN || state.status === EventStatus.ACTIVATED) && (
        <div className="absolute inset-0 z-10 bg-black animate-in fade-in duration-700">
          {(() => {
            const isMuted = state.status === EventStatus.COUNTDOWN;
            const url = isMuted ? state.countdownUrl : state.activatedUrl;
            const media = getMediaSource(url, isMuted);
            
            return media.type === 'youtube' ? (
              <iframe 
                key={state.status + state.timestamp}
                src={media.src}
                className="w-full h-full pointer-events-none scale-[1.3] md:scale-[1.1]"
                frameBorder="0"
                allow="autoplay; encrypted-media"
                onLoad={handleMediaReady}
              />
            ) : (
              <video 
                ref={videoRef}
                key={state.status + state.timestamp}
                src={media.src}
                className="w-full h-full object-cover"
                autoPlay playsInline 
                muted={isMuted}
                loop={isMuted}
                onLoadedData={handleMediaReady}
                onPlaying={handleMediaReady}
              />
            );
          })()}
          
          {state.status === EventStatus.COUNTDOWN && (
            <div className="absolute bottom-10 left-10 z-50 px-4 py-2 border border-cyan-500/20 bg-black/40 backdrop-blur-md rounded-lg">
               <div className="text-[10px] font-orbitron text-cyan-400 tracking-[0.2em] animate-pulse">SYSTEM STANDBY MODE</div>
            </div>
          )}

          {state.status === EventStatus.ACTIVATED && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-40 bg-black/10">
               <div className="border-y border-cyan-500/30 py-6 px-20 bg-black/60 backdrop-blur-xl animate-in zoom-in duration-1000">
                  <h2 className="text-6xl md:text-9xl font-orbitron font-bold text-white glow-text tracking-tighter">LAUNCHED</h2>
               </div>
            </div>
          )}
        </div>
      )}

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .bg-grid {
          background-image: linear-gradient(to right, rgba(0, 242, 255, 0.03) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(0, 242, 255, 0.03) 1px, transparent 1px);
          background-size: 40px 40px;
        }
      `}</style>
    </div>
  );
};

export default ClientView;
