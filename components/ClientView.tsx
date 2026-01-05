
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
        (newState.status === EventStatus.COUNTDOWN && newState.countdownUrl !== prev.countdownUrl) ||
        (newState.status === EventStatus.ACTIVATED && newState.activatedUrl !== prev.activatedUrl)
      );

      // Nếu có sự thay đổi quan trọng, kích hoạt loading overlay
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

  // 2. Logic phát video (Khởi tạo lần đầu hoặc khi đổi trạng thái)
  useEffect(() => {
    if (unlocked && state && state.status !== EventStatus.WAITING) {
      const isMuted = state.status === EventStatus.COUNTDOWN;
      const url = isMuted ? state.countdownUrl : state.activatedUrl;
      const media = getMediaSource(url, isMuted);

      if (media.type === 'native' && videoRef.current) {
        // Chỉ reload SRC nếu thực sự thay đổi để tránh đứng hình
        if (videoRef.current.src !== media.src) {
          videoRef.current.src = media.src;
          videoRef.current.load();
        }
        
        videoRef.current.muted = isMuted;
        videoRef.current.loop = isMuted;

        const currentServerTime = getServerTime();
        const elapsedSeconds = Math.max(0, (currentServerTime - state.timestamp) / 1000);
        
        // Chỉ gán currentTime khi video đã sẵn sàng hoặc bắt đầu chuyển trạng thái
        videoRef.current.currentTime = elapsedSeconds;
        
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Tự động thử lại nếu trình duyệt chặn autoplay
            setTimeout(() => videoRef.current?.play(), 200);
          });
        }
      }
    }
  }, [state?.status, state?.timestamp, state?.countdownUrl, state?.activatedUrl, unlocked]);

  // 3. Periodic Drift Check (Đồng bộ ngầm - Giảm độ nhạy để mượt hơn)
  useEffect(() => {
    const driftCheck = setInterval(() => {
      if (
        unlocked && 
        state && 
        state.status !== EventStatus.WAITING && 
        videoRef.current && 
        !videoRef.current.paused &&
        !isBuffering // Không sync khi đang buffer để tránh giật
      ) {
        const currentServerTime = getServerTime();
        const expectedTime = (currentServerTime - state.timestamp) / 1000;
        const actualTime = videoRef.current.currentTime;
        
        // Tăng ngưỡng lên 1.2 giây để tránh giật hình do micro-stutters
        // Chỉ nhảy thời gian nếu lệch quá xa
        if (Math.abs(expectedTime - actualTime) > 1.2) {
          console.log(`[Sync] Resyncing due to drift: ${Math.abs(expectedTime - actualTime).toFixed(2)}s`);
          videoRef.current.currentTime = expectedTime;
        }
      }
    }, 3000); // Kiểm tra mỗi 3 giây thay vì 2 giây để giảm tải cho CPU
    return () => clearInterval(driftCheck);
  }, [state, unlocked, isBuffering]);

  const handleUnlock = () => {
    setUnlocked(true);
    // Kích hoạt audio context
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
          onWaiting={() => setIsBuffering(true)}
          onLoadedMetadata={() => {
             if(videoRef.current && state) {
               const accurateElapsed = Math.max(0, (getServerTime() - state.timestamp) / 1000);
               videoRef.current.currentTime = accurateElapsed;
             }
          }}
        />

        {currentMedia.type === 'youtube' && showMedia && (
          <iframe 
            // Key chỉ thay đổi khi Status hoặc URL thay đổi để tránh reload vô ích
            key={`${state.status}_${currentUrl}`}
            src={currentMedia.src}
            className="w-full h-full pointer-events-none scale-[1.35] md:scale-[1.1]"
            frameBorder="0"
            allow="autoplay; encrypted-media"
            onLoad={handleMediaReady}
          />
        )}
      </div>

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

      <div className={`h-full w-full flex flex-col items-center justify-center transition-all duration-300 ${state.status === EventStatus.WAITING ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="w-32 h-32 md:w-48 md:h-48 rounded-full border border-cyan-500/10 flex items-center justify-center relative">
          <div className="absolute inset-0 rounded-full border-t border-cyan-500/30 animate-spin"></div>
          <div className="text-xl font-orbitron font-bold text-white/40 tracking-widest">READY</div>
        </div>
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
