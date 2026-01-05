
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
      
      const hasChanged = !prev || 
        newState.status !== prev.status || 
        newState.timestamp !== prev.timestamp ||
        newState.countdownUrl !== prev.countdownUrl || 
        newState.activatedUrl !== prev.activatedUrl;

      if (hasChanged && newState.status !== EventStatus.WAITING) {
        // Bật loading ngay lập tức khi có sự thay đổi
        setIsMediaLoading(true);
        
        // Timeout dự phòng (fallback) rút ngắn xuống còn 2s thay vì 4s
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = setTimeout(() => {
          setIsMediaLoading(false);
        }, 2000);
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

      const elapsedSeconds = Math.max(0, (Date.now() - state.timestamp) / 1000);

      if (media.type === 'native' && videoRef.current) {
        // Tối ưu: Chỉ reload nếu SRC thay đổi để tránh giật hình khi sync timestamp
        if (videoRef.current.src !== media.src) {
          videoRef.current.src = media.src;
          videoRef.current.load();
        }
        
        videoRef.current.muted = isMuted;
        videoRef.current.loop = isMuted;
        videoRef.current.currentTime = elapsedSeconds;
        
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.warn("Autoplay deferred:", error);
            setTimeout(() => {
              if (videoRef.current) {
                const retryElapsed = Math.max(0, (Date.now() - state.timestamp) / 1000);
                videoRef.current.currentTime = retryElapsed;
                videoRef.current.play();
              }
            }, 500);
          });
        }
      }
    }
  }, [state?.status, state?.timestamp, state?.countdownUrl, state?.activatedUrl, unlocked]);

  const handleUnlock = () => {
    setUnlocked(true);
    // Priming audio context ngay lập tức
    if (videoRef.current) {
      videoRef.current.play().then(() => {
        videoRef.current?.pause();
      }).catch(() => {});
    }
  };

  const handleMediaReady = () => {
    // Xóa ngay màn hình loading khi video thực sự phát (playing) hoặc đã sẵn sàng
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    setIsMediaLoading(false);
  };

  const getMediaSource = (url: string, isMuted: boolean = true) => {
    const youtubeRegex = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(youtubeRegex);
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
      <div className="text-cyan-400 animate-pulse font-orbitron tracking-widest text-[10px]">SYNCING WITH CLOUD...</div>
    </div>
  );

  const currentIsMuted = state.status === EventStatus.COUNTDOWN;
  const currentUrl = currentIsMuted ? state.countdownUrl : state.activatedUrl;
  const currentMedia = getMediaSource(currentUrl, currentIsMuted);
  const showMedia = unlocked && state.status !== EventStatus.WAITING;

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-[#000510] bg-grid selection:bg-none">
      
      <div className={`absolute inset-0 z-10 bg-black transition-opacity duration-500 ${showMedia ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        {/* NATIVE VIDEO PLAYER - Thêm preload="auto" để buffer nhanh nhất */}
        <video 
          ref={videoRef}
          className={`w-full h-full object-cover ${currentMedia.type === 'native' ? 'block' : 'hidden'}`}
          playsInline 
          preload="auto"
          onPlaying={handleMediaReady}
          onCanPlay={handleMediaReady}
          onLoadedMetadata={() => {
             // Đồng bộ lại time ngay khi metadata sẵn sàng để tránh "nhảy" hình
             if(videoRef.current && state) {
               const accurateElapsed = Math.max(0, (Date.now() - state.timestamp) / 1000);
               videoRef.current.currentTime = accurateElapsed;
             }
          }}
        />

        {/* YOUTUBE PLAYER */}
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
          <div className="absolute bottom-8 left-8 z-50 px-3 py-1 border border-cyan-500/10 bg-black/40 backdrop-blur-sm rounded">
             <div className="text-[8px] font-orbitron text-cyan-400/60 tracking-[0.2em] uppercase">
               Sync Stream Active
             </div>
          </div>
        )}
      </div>

      {/* Tối ưu Overlay Loading - mỏng nhẹ và biến mất nhanh hơn */}
      {unlocked && isMediaLoading && (
        <div className="absolute inset-0 z-[150] flex flex-col items-center justify-center bg-[#000510]/80 backdrop-blur-sm transition-opacity duration-300">
          <div className="w-32 h-[2px] bg-slate-900 rounded-full overflow-hidden border border-cyan-500/10">
             <div className="h-full bg-cyan-400 animate-[loading_0.8s_infinite_linear]"></div>
          </div>
        </div>
      )}

      {!unlocked && (
        <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center bg-[#000510]">
          <div className="absolute inset-0 opacity-10 pointer-events-none bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-cyan-500/30 via-transparent to-transparent"></div>
          <div className="text-center space-y-12 z-10 px-6">
            <h1 className="text-5xl md:text-8xl font-orbitron font-bold text-white glow-text tracking-tighter">
              AI <span className="text-cyan-400">YOUNG</span> GURU
            </h1>
            <p className="text-cyan-500/40 font-orbitron tracking-[0.4em] text-[9px] md:text-xs uppercase">High Speed Node v2.8</p>
            <button 
              onClick={handleUnlock}
              className="group relative px-10 py-5 bg-transparent overflow-hidden border border-cyan-500/30 rounded-lg hover:border-cyan-400 transition-all"
            >
              <div className="absolute inset-0 bg-cyan-500/5 transform translate-y-full group-hover:translate-y-0 transition-transform duration-200"></div>
              <span className="relative z-10 font-orbitron font-bold text-sm text-cyan-400 tracking-[0.2em]">INIT SYSTEM</span>
            </button>
          </div>
        </div>
      )}

      <div className={`h-full w-full flex flex-col items-center justify-center transition-all duration-700 ${state.status === EventStatus.WAITING ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="relative">
          <div className="w-48 h-48 md:w-64 md:h-64 rounded-full border border-cyan-500/5 flex items-center justify-center">
            <div className="absolute inset-0 rounded-full border-t border-cyan-500/20 animate-spin duration-[4s]"></div>
            <div className="flex flex-col items-center justify-center text-center">
               <div className="text-3xl font-orbitron font-bold text-white/80 glow-text uppercase tracking-widest">Standby</div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        .bg-grid {
          background-image: linear-gradient(to right, rgba(0, 242, 255, 0.01) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(0, 242, 255, 0.01) 1px, transparent 1px);
          background-size: 60px 60px;
        }
      `}</style>
    </div>
  );
};

export default ClientView;
