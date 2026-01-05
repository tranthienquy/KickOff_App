
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
      if (statusChanged || urlChanged || newState.timestamp !== prev?.timestamp) {
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

  // 2. Logic phát video - Tách biệt "unlocked" để cho phép background chạy trước (Muted)
  useEffect(() => {
    if (state) {
      // Force muted if not unlocked OR if in Waiting/Countdown
      const isMuted = !unlocked || state.status !== EventStatus.ACTIVATED;
      
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
        videoRef.current.loop = true; 

        const currentServerTime = getServerTime();
        const elapsedSeconds = Math.max(0, (currentServerTime - state.timestamp) / 1000);
        
        // Chỉ sync thời gian nếu clip đang phát không phải là standby ngẫu nhiên (hoặc vẫn sync để đồng nhất)
        videoRef.current.currentTime = elapsedSeconds;
        
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Browsers usually allow muted autoplay
            if (videoRef.current) {
              videoRef.current.muted = true;
              videoRef.current.play().catch(() => {
                console.log("Autoplay blocked even when muted");
              });
            }
          });
        }
      }
    }
  }, [state?.status, state?.timestamp, state?.countdownUrl, state?.activatedUrl, state?.waitingUrl, unlocked]);

  // 3. Periodic Drift Check
  useEffect(() => {
    const driftCheck = setInterval(() => {
      if (
        state && 
        videoRef.current && 
        !videoRef.current.paused &&
        !isBuffering 
      ) {
        const currentServerTime = getServerTime();
        const expectedTime = (currentServerTime - state.timestamp) / 1000;
        const actualTime = videoRef.current.currentTime;
        
        // Với background video, độ lệch có thể nới lỏng hơn để mượt
        const threshold = state.status === EventStatus.ACTIVATED ? 1.0 : 2.0;
        
        if (Math.abs(expectedTime - actualTime) > threshold) {
          videoRef.current.currentTime = expectedTime;
        }
      }
    }, 3000);
    return () => clearInterval(driftCheck);
  }, [state, isBuffering]);

  const handleUnlock = () => {
    setUnlocked(true);
    // Khi click, ta thử play lại để kích hoạt âm thanh cho các state sau
    if (videoRef.current) {
      videoRef.current.muted = state?.status !== EventStatus.ACTIVATED;
      videoRef.current.play().catch(() => {});
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

  const showBackgroundVideo = !!state; 
  const currentIsMuted = !unlocked || state.status !== EventStatus.ACTIVATED;
  
  let currentUrl = state.waitingUrl;
  if (state.status === EventStatus.COUNTDOWN) currentUrl = state.countdownUrl;
  if (state.status === EventStatus.ACTIVATED) currentUrl = state.activatedUrl;
  
  const currentMedia = getMediaSource(currentUrl, currentIsMuted);

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-[#000510] selection:none">
      
      {/* 1. LAYER: VIDEO BACKGROUND (Always present if state exists) */}
      <div className={`absolute inset-0 z-10 transition-opacity duration-1000 ${showBackgroundVideo ? 'opacity-100' : 'opacity-0'}`}>
        <video 
          ref={videoRef}
          className={`w-full h-full object-cover ${currentMedia.type === 'native' ? 'block' : 'hidden'}`}
          playsInline 
          muted={currentIsMuted}
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
        
        {/* Lớp phủ tối nhẹ để nổi bật UI */}
        <div className="absolute inset-0 bg-black/30 pointer-events-none z-11"></div>
      </div>

      {/* 2. LAYER: LOADING & BUFFERING */}
      {(isMediaLoading || isBuffering) && (
        <div className="absolute inset-0 z-[150] flex flex-col items-center justify-center bg-[#000510]/60 backdrop-blur-md transition-opacity duration-300">
          <div className="w-48 h-[1px] bg-cyan-500/10 overflow-hidden relative">
             <div className="absolute inset-0 bg-cyan-400 animate-[loading_1.5s_infinite_ease-in-out]"></div>
          </div>
          <div className="mt-4 text-[9px] font-orbitron text-cyan-400/60 tracking-[0.4em] uppercase font-bold">
            {isBuffering ? 'Buffering Assets' : 'Temporal Sync'}
          </div>
        </div>
      )}

      {/* 3. LAYER: INITIALIZE BUTTON (If not unlocked) */}
      {!unlocked && (
        <div className="absolute inset-0 z-[200] flex flex-col items-center justify-center bg-black/40 backdrop-blur-[4px]">
          <div className="text-center space-y-16 z-10 px-6">
            <div className="space-y-2">
                <h1 className="text-5xl md:text-8xl font-orbitron font-bold text-white glow-text tracking-tighter opacity-90">
                AI <span className="text-cyan-400">YOUNG</span> GURU
                </h1>
                <p className="text-[10px] font-orbitron text-cyan-400/60 tracking-[0.6em] uppercase">Multi-Device Launch System</p>
            </div>
            
            <button 
              onClick={handleUnlock}
              className="group relative px-12 py-6 overflow-hidden rounded-full transition-all active:scale-95 shadow-[0_0_30px_rgba(6,182,212,0.2)]"
            >
              <div className="absolute inset-0 bg-cyan-500/10 group-hover:bg-cyan-500/20 transition-colors"></div>
              <div className="absolute inset-0 border border-cyan-500/30 rounded-full"></div>
              <span className="relative z-10 text-cyan-400 font-orbitron font-bold text-sm tracking-[0.2em]">INITIALIZE CLIENT</span>
            </button>
          </div>
        </div>
      )}

      {/* 4. LAYER: WAITING/STANDBY OVERLAY (Active when unlocked and status is WAITING) */}
      <div className={`absolute inset-0 z-20 h-full w-full flex flex-col items-center justify-center transition-all duration-1000 ${state.status === EventStatus.WAITING && unlocked ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="flex flex-col items-center gap-10">
            <div className="w-40 h-40 md:w-60 md:h-60 rounded-full border border-white/5 flex items-center justify-center relative bg-black/20 backdrop-blur-sm shadow-[0_0_60px_rgba(0,0,0,0.5)]">
                <div className="absolute inset-0 rounded-full border-t-2 border-cyan-500/30 animate-[spin_4s_linear_infinite]"></div>
                <div className="absolute inset-4 rounded-full border-b border-cyan-400/10 animate-[spin_6s_linear_infinite_reverse]"></div>
                <div className="text-2xl font-orbitron font-bold text-white tracking-[0.2em] drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">READY</div>
            </div>
            <div className="text-center space-y-2">
                <div className="text-[10px] font-orbitron text-cyan-400/80 tracking-[0.8em] uppercase animate-pulse">Waiting for Signal</div>
                <div className="h-[1px] w-24 bg-gradient-to-r from-transparent via-cyan-500/40 to-transparent mx-auto"></div>
            </div>
        </div>
      </div>

      <style>{`
        @keyframes loading {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0); }
          100% { transform: translateX(100%); }
        }
        .bg-grid {
          background-image: linear-gradient(to right, rgba(0, 242, 255, 0.02) 1px, transparent 1px),
                            linear-gradient(to bottom, rgba(0, 242, 255, 0.02) 1px, transparent 1px);
          background-size: 60px 60px;
        }
        .glow-text {
          text-shadow: 0 0 20px rgba(6, 182, 212, 0.4), 0 0 40px rgba(6, 182, 212, 0.2);
        }
      `}</style>
    </div>
  );
};

export default ClientView;
