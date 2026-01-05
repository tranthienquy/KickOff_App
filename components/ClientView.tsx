
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
  
  // 1. Đồng bộ trạng thái từ Firebase
  useEffect(() => {
    const unsubscribe = syncState((newState) => {
      const prev = prevStateRef.current;
      
      // Chỉ kích hoạt màn hình loading khi Status thực sự thay đổi sang trạng thái phát clip
      const statusChanged = !prev || newState.status !== prev.status;
      const urlChanged = prev && (
        (newState.status === EventStatus.COUNTDOWN && newState.countdownUrl !== prev.countdownUrl) ||
        (newState.status === EventStatus.ACTIVATED && newState.activatedUrl !== prev.activatedUrl)
      );

      if ((statusChanged || urlChanged) && newState.status !== EventStatus.WAITING) {
        setIsMediaLoading(true);
        // Timeout fallback cực ngắn để đảm bảo không bị kẹt màn hình loading
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

  // 2. Tối ưu hóa việc phát và đồng bộ Video
  useEffect(() => {
    if (unlocked && state && state.status !== EventStatus.WAITING) {
      const isMuted = state.status === EventStatus.COUNTDOWN;
      const url = isMuted ? state.countdownUrl : state.activatedUrl;
      const media = getMediaSource(url, isMuted);

      // Tính toán vị trí phát dựa trên thời điểm Admin bấm nút
      const elapsedSeconds = Math.max(0, (Date.now() - state.timestamp) / 1000);

      if (media.type === 'native' && videoRef.current) {
        // Chỉ gọi load() nếu URL thay đổi để giữ buffer cũ nếu cùng 1 file
        if (videoRef.current.src !== media.src) {
          videoRef.current.src = media.src;
          videoRef.current.load();
        }
        
        videoRef.current.muted = isMuted;
        videoRef.current.loop = isMuted;
        
        // Nhảy đến vị trí chính xác ngay lập tức
        if (Math.abs(videoRef.current.currentTime - elapsedSeconds) > 0.5) {
          videoRef.current.currentTime = elapsedSeconds;
        }
        
        // Ép phát video nhanh nhất có thể
        const playPromise = videoRef.current.play();
        if (playPromise !== undefined) {
          playPromise.catch(() => {
            // Tự động thử lại nếu trình duyệt chặn ban đầu
            setTimeout(() => videoRef.current?.play(), 100);
          });
        }
      }
    }
  }, [state?.status, state?.timestamp, state?.countdownUrl, state?.activatedUrl, unlocked]);

  const handleUnlock = () => {
    setUnlocked(true);
    // Kích hoạt Audio Context cho iOS/iPadOS
    if (videoRef.current) {
      videoRef.current.play().then(() => videoRef.current?.pause()).catch(() => {});
    }
  };

  const handleMediaReady = () => {
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
    // Tắt loading ngay khi video bắt đầu chuyển động
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
      <div className="text-cyan-400 animate-pulse font-orbitron tracking-widest text-[10px]">FAST-SYNC ACTIVE...</div>
    </div>
  );

  const currentIsMuted = state.status === EventStatus.COUNTDOWN;
  const currentUrl = currentIsMuted ? state.countdownUrl : state.activatedUrl;
  const currentMedia = getMediaSource(currentUrl, currentIsMuted);
  const showMedia = unlocked && state.status !== EventStatus.WAITING;

  return (
    <div className="h-screen w-screen relative overflow-hidden bg-[#000510] bg-grid selection:none">
      
      {/* Container Video với transition cực nhanh (200ms) */}
      <div className={`absolute inset-0 z-10 bg-black transition-opacity duration-200 ${showMedia ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <video 
          ref={videoRef}
          className={`w-full h-full object-cover ${currentMedia.type === 'native' ? 'block' : 'hidden'}`}
          playsInline 
          autoPlay
          preload="auto"
          onPlaying={handleMediaReady}
          onCanPlay={handleMediaReady}
          onLoadedMetadata={() => {
             if(videoRef.current && state) {
               const accurateElapsed = Math.max(0, (Date.now() - state.timestamp) / 1000);
               videoRef.current.currentTime = accurateElapsed;
             }
          }}
        />

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
      </div>

      {/* Loading Overlay siêu mỏng, biến mất ngay khi có frame đầu tiên */}
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
              className="px-10 py-5 bg-cyan-500/5 border border-cyan-500/30 rounded-lg text-cyan-400 font-orbitron font-bold text-sm tracking-widest hover:bg-cyan-500/20 transition-all active:scale-95"
            >
              INITIALIZE STREAM
            </button>
          </div>
        </div>
      )}

      {/* Màn hình Standby (Waiting) */}
      <div className={`h-full w-full flex flex-col items-center justify-center transition-all duration-300 ${state.status === EventStatus.WAITING ? 'opacity-100 scale-100' : 'opacity-0 scale-110 pointer-events-none'}`}>
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
