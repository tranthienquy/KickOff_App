import React, { useState, useEffect, useRef, memo } from 'react';
import { AppState, EventStatus, INITIAL_STATE } from '../types.ts';
import { syncState, getServerTime, trackDevice } from '../services/firebase.ts';

// Component con để xử lý từng lớp video riêng biệt
const MediaLayer = memo(({ 
  url, 
  isActive, 
  type, 
  timestamp, 
  globalUnlocked 
}: { 
  url: string; 
  isActive: boolean; 
  type: 'native' | 'youtube'; 
  timestamp: number;
  globalUnlocked: boolean;
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Xử lý đồng bộ hóa thời gian (Sync Logic)
  useEffect(() => {
    if (!globalUnlocked || !url) return;
    
    // Nếu là video native (.mp4)
    if (type === 'native' && videoRef.current) {
      if (isActive) {
        // Khi Active: Đảm bảo video chạy và đúng thời gian
        const syncVideo = () => {
          const now = getServerTime();
          const elapsed = Math.max(0, (now - timestamp) / 1000);
          
          // Chỉ seek nếu lệch quá 0.5s để video mượt
          if (Math.abs(videoRef.current!.currentTime - elapsed) > 0.5) {
            videoRef.current!.currentTime = elapsed;
          }
          
          if (videoRef.current!.paused) {
            videoRef.current!.play().catch(e => console.log("Auto-play blocked:", e));
          }
        };

        syncVideo();
        // Check drift mỗi giây
        const interval = setInterval(syncVideo, 2000);
        return () => clearInterval(interval);
      } else {
        // Khi Inactive: Pause để tiết kiệm tài nguyên (hoặc để chạy nền nếu muốn preload aggressive)
        // Ở đây ta pause để tránh tiếng ồn chồng chéo, nhưng không unmount
        videoRef.current.pause();
      }
    }
  }, [isActive, globalUnlocked, url, timestamp]);

  if (!url) return null;

  return (
    <div 
      className={`absolute inset-0 w-full h-full transition-opacity duration-300 ease-linear ${isActive ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
    >
      {type === 'native' ? (
        <video
          ref={videoRef}
          src={url}
          className="w-full h-full object-cover"
          playsInline
          preload="auto" // Quan trọng: Tải trước toàn bộ
          muted={!isActive} // Chỉ bật tiếng khi active
          loop={true} // Mặc định loop, logic Activated có thể tắt loop nếu cần
        />
      ) : (
        <iframe
          ref={iframeRef}
          src={`https://www.youtube.com/embed/${url.split('/').pop()}?autoplay=1&controls=0&mute=${isActive ? 0 : 1}&loop=1&playlist=${url.split('/').pop()}&rel=0&showinfo=0&iv_load_policy=3&modestbranding=1&playsinline=1&enablejsapi=1`}
          className="w-full h-full object-cover scale-[1.35]"
          frameBorder="0"
          allow="autoplay; encrypted-media"
        />
      )}
    </div>
  );
});

const ClientView: React.FC = () => {
  const [state, setState] = useState<AppState | null>(INITIAL_STATE);
  const [unlocked, setUnlocked] = useState(false);
  
  // Ref để giữ trạng thái play audio khi unlock
  const dummyAudioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    trackDevice();
    const unsubscribe = syncState((newState) => {
      setState(newState);
    });
    return () => unsubscribe();
  }, []);

  const handleUnlock = () => {
    setUnlocked(true);
    // Kích hoạt Audio Context ngay lập tức bằng một tương tác người dùng
    if (dummyAudioRef.current) {
      dummyAudioRef.current.play().catch(() => {});
    }
  };

  if (!state) return null;

  // Xác định Video nào đang Active
  const isWaiting = state.status === EventStatus.WAITING;
  const isCountdown = state.status === EventStatus.COUNTDOWN;
  const isActivated = state.status === EventStatus.ACTIVATED;

  // Helper check loại link
  const getType = (url: string) => (url.includes('youtube') || url.includes('youtu.be')) ? 'youtube' : 'native';

  return (
    <div className="h-[100dvh] w-screen relative overflow-hidden bg-black select-none">
      
      {/* 
         LAYER SYSTEM: Tất cả video đều được render nhưng ẩn hiện bằng Opacity 
         Điều này giúp chuyển cảnh NGAY LẬP TỨC mà không cần load lại.
      */}
      
      {/* 1. Waiting Layer */}
      <MediaLayer 
        url={state.waitingUrl} 
        isActive={isWaiting} 
        type={getType(state.waitingUrl)}
        timestamp={state.timestamp} // Waiting thường loop, timestamp ít quan trọng hơn nhưng vẫn truyền
        globalUnlocked={unlocked}
      />

      {/* 2. Countdown Layer */}
      <MediaLayer 
        url={state.countdownUrl} 
        isActive={isCountdown} 
        type={getType(state.countdownUrl)}
        timestamp={state.timestamp} // Countdown cần sync chính xác theo timestamp khi trigger
        globalUnlocked={unlocked}
      />

      {/* 3. Activated Layer */}
      <MediaLayer 
        url={state.activatedUrl} 
        isActive={isActivated} 
        type={getType(state.activatedUrl)}
        timestamp={state.timestamp} // Activated chạy theo thời gian thực
        globalUnlocked={unlocked}
      />

      {/* --- CÁC THÀNH PHẦN UI KHÁC --- */}

      {/* Splash Screen (Lock Screen) */}
      {!unlocked && (
        <div className="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-black">
          {state.splashVideoUrl && (
            <video 
              src={state.splashVideoUrl}
              className="absolute inset-0 w-full h-full object-cover opacity-60"
              autoPlay muted loop playsInline
            />
          )}
          <div className="text-center space-y-8 z-10 px-6 backdrop-blur-sm p-12 rounded-3xl border border-white/10 bg-black/40 shadow-2xl">
            <h1 className="text-4xl md:text-7xl font-orbitron font-bold text-white tracking-tighter drop-shadow-[0_0_15px_rgba(249,115,22,0.8)]">
              {state.titlePrefix} <span className="text-orange-500">{state.titleHighlight}</span> {state.titleSuffix}
            </h1>
            <div className="flex flex-col gap-4 items-center">
              <button 
                onClick={handleUnlock}
                className="group relative px-12 py-5 bg-orange-600 hover:bg-orange-500 text-white font-orbitron font-bold text-lg tracking-widest transition-all clip-path-polygon shadow-[0_0_30px_rgba(249,115,22,0.4)] hover:shadow-[0_0_50px_rgba(249,115,22,0.8)] hover:scale-105 active:scale-95"
                style={{ clipPath: 'polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%)' }}
              >
                {state.buttonText || 'ACCESS SYSTEM'}
              </button>
              <p className="text-[10px] text-orange-500/60 font-mono tracking-[0.2em] animate-pulse">
                WAITING FOR SIGNAL UPLINK...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Waiting Overlay Indicator */}
      <div className={`absolute bottom-24 left-1/2 -translate-x-1/2 z-50 transition-opacity duration-500 ${isWaiting && unlocked ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center gap-4 px-10 py-3 rounded-full border border-orange-500/60 shadow-[0_0_30px_rgba(249,115,22,0.3)] backdrop-blur-[2px]">
            <div className="w-3 h-3 bg-orange-500 rounded-full animate-pulse shadow-[0_0_20px_#f97316]"></div>
            <span className="text-sm font-orbitron text-orange-400 font-bold tracking-[0.3em] drop-shadow-[0_2px_8px_rgba(0,0,0,1)]">{state.readyText}</span>
        </div>
      </div>

      {/* Scrolling Text Footer */}
      {unlocked && state.scrollingText && (
        <div className="absolute bottom-0 left-0 right-0 h-14 bg-gradient-to-t from-black via-black/90 to-transparent flex items-center z-50">
          <div className="w-full overflow-hidden relative">
            <div className="whitespace-nowrap animate-[marquee_25s_linear_infinite] text-orange-500 font-orbitron text-lg tracking-[0.15em] drop-shadow-[0_0_5px_rgba(249,115,22,0.8)]">
               {state.scrollingText} &nbsp; • &nbsp; {state.scrollingText} &nbsp; • &nbsp; {state.scrollingText} &nbsp; • &nbsp; {state.scrollingText}
            </div>
          </div>
        </div>
      )}

      {/* Dummy Audio for unlocking context */}
      <audio ref={dummyAudioRef} src="https://storage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4" className="hidden" muted />

      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
};

export default ClientView;