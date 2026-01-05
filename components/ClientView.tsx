
import React, { useState, useEffect, useRef } from 'react';
import { AppState, EventStatus } from '../types.ts';
import { syncState, getServerTime, trackDevice } from '../services/firebase.ts';

const ClientView: React.FC = () => {
  const [state, setState] = useState<AppState | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [isMediaLoading, setIsMediaLoading] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const prevStateRef = useRef<AppState | null>(null);
  const loadingTimeoutRef = useRef<any>(null);
  
  // 1. Đồng bộ trạng thái và Theo dõi thiết bị
  useEffect(() => {
    // Đánh dấu thiết bị này đang kết nối
    trackDevice();

    const unsubscribe = syncState((newState) => {
      const prev = prevStateRef.current;
      
      const statusChanged = !prev || newState.status !== prev.status;
      const urlChanged = prev && (
        (newState.status === EventStatus.COUNTDOWN && newState.countdownUrl !== prev.countdownUrl) ||
        (newState.status === EventStatus.ACTIVATED && newState.activatedUrl !== prev.activatedUrl)
      );

      if ((statusChanged || urlChanged || newState.timestamp !== prev?.timestamp) && newState.status !== EventStatus.WAITING) {
        setIsMediaLoading(true);
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = setTimeout(() => {
          setIsMediaLoading(false);
        }, 1500);
      }

      prevStateRef.current = newState;
      setState(newState);
    });

    return () => {
      unsubscribe();
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    };
  }, []);

  // 2. Logic phát video
  useEffect(() => {
    if (unlocked && state && state.status !== EventStatus.WAITING) {
      const isMuted = state.status === EventStatus.COUNTDOWN;
      const url = isMuted ? state.countdownUrl : state.activatedUrl;
      const media = getMediaSource(url, isMuted);

      const currentServerTime = getServerTime();
      const elapsedSeconds = Math.max(0, (currentServerTime - state.timestamp) / 1000);

      if (media.type === 'native' && videoRef.current) {
        if (videoRef.current.src !== media.src) {
          videoRef.current.src = media.src;
          videoRef.current.load();
        }
        
        videoRef.current.muted = isMuted;
        videoRef.current.loop = isMuted;
        videoRef.current.currentTime = elapsedSeconds;
        
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            setTimeout(() => videoRef.current?.play(), 100);
          });
        }
      }
    }
  }, [state?.status, state?.timestamp, state?.countdownUrl, state?.activatedUrl, unlocked]);

  useEffect(() => {
    const driftCheck = setInterval(() => {
      if (unlocked && state && state.status !== EventStatus.WAITING && videoRef.current && !videoRef.current.paused) {
        const currentServerTime = getServerTime();
        const expectedTime = (currentServerTime - state.timestamp) / 1000;
        const actualTime = videoRef.current.currentTime;
        if (Math.abs(expectedTime - actualTime) > 0.3) {
          videoRef.current.currentTime = expectedTime;
        }
      }
    }, 2000);
    return () => clearInterval(driftCheck);
  }, [state, unlocked]);

  const handleUnlock = () => {
    setUnlocked(true);
    if (videoRef.current) {
      videoRef.current.play().then(() => videoRef.current?.pause()).catch(() => {});
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
    <div className="h-screen w-screen flex items-center justify-center bg-[#000510]">
      <div className="text-cyan-400 animate-pulse font-orbitron tracking-widest text-[10px]">VERIFYING TEMPORAL SYNC...</div>
    </div>
  );

  const showMedia = unlocked && state.status !== EventStatus.WAITING;
  const currentIsMuted = state.status === EventStatus.COUNTDOWN;
  const currentUrl = currentIsMuted ? state.countdownUrl : state.activatedUrl;
  const currentMedia = getMediaSource(currentUrl, currentIsMuted);

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-[#000510] bg-grid selection:none">
      
      <div className={`absolute inset-0 z-10 bg-black transition-opacity duration-200 ${showMedia ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <video 
          ref={videoRef}
          className={`w-full h-full object-cover ${currentMedia.type === 'native' ? 'block' : 'hidden'}`}
          playsInline 
          preload="auto"
          onPlaying={handleMediaReady}
          onCanPlay={handleMediaReady}
          onLoadedMetadata={() => {
             if(videoRef.current && state) {
               const accurateElapsed = Math.max(0, (getServerTime() - state.timestamp) / 1000);
               videoRef.current.currentTime = accurateElapsed;
             }
          }}
        />

        {currentMedia.type === 'youtube' && showMedia && (
          <iframe 
            key={`${currentMedia.src}_${state.timestamp}`}
            src={currentMedia.src}
            className="w-full h-full pointer-events-none scale-[1.35] md:scale-[1.1]"
            frameBorder="0"
            allow="autoplay; encrypted-media"
            onLoad={handleMediaReady}
          />
        )}
      </div>

      {unlocked && isMediaLoading && (
        <div className="absolute inset-0 z-[150] flex flex-col items-center justify-center bg-[#000510] transition-opacity duration-150">
          <div className="w-40 h-[1px] bg-cyan-500/10 overflow-hidden">
             <div className="h-full bg-cyan-400 animate-[loading_0.5s_infinite_linear]"></div>
          </div>
        </div>
      )}

      {!unlocked && (
        <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center bg-[#000510]">
          <div className="text-center space-y-12 z-10 px-6">
            <h1 className="text-5xl md:text-8xl font-orbitron font-bold text-white glow-text tracking-tighter">
              AI <span className="text-cyan-400">YOUNG</span> GURU
            </h1>
            <button 
              onClick={handleUnlock}
              className="px-10 py-5 bg-cyan-500/5 border border-cyan-500/30 rounded-lg text-cyan-400 font-orbitron font-bold text-sm tracking-widest hover:bg-cyan-500/20 transition-all active:scale-95 shadow-[0_0_15px_rgba(6,182,212,0.1)]"
            >
              INITIALIZE SYNC-STREAM
            </button>
          </div>
        </div>
      )}

      <div className={`h-full w-full flex flex-col items-center justify-center transition-all duration-300 ${state.status === EventStatus.WAITING ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="w-32 h-32 md:w-48 md:h-48 rounded-full border border-cyan-500/10 flex items-center justify-center relative">
          <div className="absolute inset-0 rounded-full border-t border-cyan-500/30 animate-spin"></div>
          <div className="text-xl font-orbitron font-bold text-white/40 tracking-widest">READY</div>
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
          background-size: 80px 80px;
        }
      `}</style>
    </div>
  );
};

export default ClientView;
