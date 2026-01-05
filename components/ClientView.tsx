
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
  
  // 1. Đồng bộ trạng thái và Theo dõi thiết bị
  useEffect(() => {
    trackDevice();

    const unsubscribe = syncState((newState) => {
      const prev = prevStateRef.current;
      
      const statusChanged = !prev || newState.status !== prev.status;
      const urlChanged = prev && (
        (newState.waitingUrl !== prev.waitingUrl) ||
        (newState.countdownUrl !== prev.countdownUrl) ||
        (newState.activatedUrl !== prev.activatedUrl)
      );

      // Nếu có sự thay đổi quan trọng, kích hoạt loading overlay
      if ((statusChanged || urlChanged || newState.timestamp !== prev?.timestamp)) {
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

  // 2. Logic phát video (Khởi tạo lần đầu hoặc khi đổi trạng thái)
  useEffect(() => {
    if (unlocked && state) {
      const isMuted = state.status !== EventStatus.ACTIVATED;
      let url = '';
      
      if (state.status === EventStatus.WAITING) url = state.waitingUrl;
      else if (state.status === EventStatus.COUNTDOWN) url = state.countdownUrl;
      else url = state.activatedUrl;

      const media = getMediaSource(url, isMuted);

      if (media.type === 'native' && videoRef.current) {
        if (videoRef.current.src !== media.src) {
          videoRef.current.src = media.src;
          videoRef.current.load();
        }
        
        videoRef.current.muted = isMuted;
        videoRef.current.loop = true; // Luôn loop cho background và countdown

        const currentServerTime = getServerTime();
        // Đối với WAITING, chúng ta có thể không cần sync tuyệt đối thời gian clip, nhưng để thống nhất vẫn tính elapsed
        const elapsedSeconds = Math.max(0, (currentServerTime - state.timestamp) / 1000);
        
        videoRef.current.currentTime = elapsedSeconds;
        
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            setTimeout(() => videoRef.current?.play(), 200);
          });
        }
      }
    }
  }, [state?.status, state?.timestamp, state?.countdownUrl, state?.activatedUrl, state?.waitingUrl, unlocked]);

  // 3. Periodic Drift Check
  useEffect(() => {
    const driftCheck = setInterval(() => {
      if (
        unlocked && 
        state && 
        videoRef.current && 
        !videoRef.current.paused &&
        !isBuffering 
      ) {
        const currentServerTime = getServerTime();
        const expectedTime = (currentServerTime - state.timestamp) / 1000;
        const actualTime = videoRef.current.currentTime;
        
        if (Math.abs(expectedTime - actualTime) > 1.2) {
          videoRef.current.currentTime = expectedTime;
        }
      }
    }, 3000);
    return () => clearInterval(driftCheck);
  }, [state, unlocked, isBuffering]);

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
    setIsBuffering(false);
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

  const showBackgroundVideo = unlocked;
  const currentIsMuted = state.status !== EventStatus.ACTIVATED;
  let currentUrl = state.waitingUrl;
  if (state.status === EventStatus.COUNTDOWN) currentUrl = state.countdownUrl;
  if (state.status === EventStatus.ACTIVATED) currentUrl = state.activatedUrl;
  
  const currentMedia = getMediaSource(currentUrl, currentIsMuted);

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-[#000510] bg-grid selection:none">
      
      {/* Background Video Layer */}
      <div className={`absolute inset-0 z-10 bg-black transition-opacity duration-500 ${showBackgroundVideo ? 'opacity-100' : 'opacity-0'}`}>
        <video 
          ref={videoRef}
          className={`w-full h-full object-cover ${currentMedia.type === 'native' ? 'block' : 'hidden'}`}
          playsInline 
          preload="auto"
          onPlaying={handleMediaReady}
          onCanPlay={handleMediaReady}
          onWaiting={() => setIsBuffering(true)}
          onLoadedMetadata={() => {
             if(videoRef.current && state) {
               const accurateElapsed = Math.max(0, (getServerTime() - state.timestamp) / 1000);
               videoRef.current.currentTime = accurateElapsed;
             }
          }}
        />

        {currentMedia.type === 'youtube' && showBackgroundVideo && (
          <iframe 
            key={`${state.status}_${currentUrl}`}
            src={currentMedia.src}
            className="w-full h-full pointer-events-none scale-[1.35] md:scale-[1.1]"
            frameBorder="0"
            allow="autoplay; encrypted-media"
            onLoad={handleMediaReady}
          />
        )}
      </div>

      {/* Overlay UI Layer */}
      {unlocked && (isMediaLoading || isBuffering) && (
        <div className="absolute inset-0 z-[150] flex flex-col items-center justify-center bg-[#000510]/50 backdrop-blur-sm transition-opacity duration-150">
          <div className="w-40 h-[1px] bg-cyan-500/10 overflow-hidden relative">
             <div className="absolute inset-0 bg-cyan-400 animate-[loading_1.5s_infinite_ease-in-out]"></div>
          </div>
          <div className="mt-4 text-[8px] font-orbitron text-cyan-500/50 tracking-[0.3em] uppercase">
            {isBuffering ? 'Buffering' : 'Syncing'}
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

      {/* WAITING OVERLAY - Logo & Ready Text on top of background video */}
      <div className={`absolute inset-0 z-20 h-full w-full flex flex-col items-center justify-center transition-all duration-700 backdrop-blur-[2px] bg-black/20 ${state.status === EventStatus.WAITING && unlocked ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}>
        <div className="w-32 h-32 md:w-48 md:h-48 rounded-full border border-cyan-500/20 flex items-center justify-center relative bg-black/40 shadow-[0_0_50px_rgba(6,182,212,0.1)]">
          <div className="absolute inset-0 rounded-full border-t border-cyan-500/40 animate-spin"></div>
          <div className="text-xl font-orbitron font-bold text-white/60 tracking-widest drop-shadow-lg">READY</div>
        </div>
        <div className="mt-8 text-[10px] font-orbitron text-cyan-400/40 tracking-[0.5em] uppercase">System Standby</div>
      </div>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0); }
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
