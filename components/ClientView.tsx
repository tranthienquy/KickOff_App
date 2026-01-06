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

  // Xử lý đồng bộ hóa thời gian (Smooth Sync Logic)
  useEffect(() => {
    if (!globalUnlocked || !url) return;
    
    // Nếu là video native (.mp4)
    if (type === 'native' && videoRef.current) {
      if (isActive) {
        const video = videoRef.current;
        
        // Hàm đồng bộ mượt (Smooth Sync)
        // Thay vì tua (seek) liên tục gây giật, ta điều chỉnh tốc độ (playbackRate)
        const performSmoothSync = () => {
          if (!video || (video.paused && video.readyState < 2)) return;

          const now = getServerTime();
          // Thời gian lý tưởng
          const expectedTime = Math.max(0, (now - timestamp) / 1000);
          
          // Tính độ lệch
          const diff = video.currentTime - expectedTime;
          const absDiff = Math.abs(diff);

          // LOGIC XỬ LÝ:
          
          // 1. HARD SYNC: Nếu lệch quá nhiều (> 1.5s) -> Bắt buộc Seek (Nhảy cóc)
          // Xảy ra khi: Mới vào trang, mạng rớt lâu, hoặc tua lại từ Admin.
          if (absDiff > 1.5) {
             console.log(`🔄 Hard Sync: Drift ${diff.toFixed(2)}s. Seeking...`);
             video.currentTime = expectedTime;
             video.playbackRate = 1.0; // Reset tốc độ
          } 
          // 2. SOFT SYNC: Nếu lệch nhẹ (0.05s - 1.5s) -> Điều chỉnh tốc độ
          // Giúp video đuổi kịp hoặc chờ đợi một cách mượt mà, không bị khựng hình.
          else if (absDiff > 0.05) {
             // Nếu video đi NHANH hơn server -> Giảm tốc độ (0.95x)
             // Nếu video đi CHẬM hơn server -> Tăng tốc độ (1.05x)
             // Lưu ý: Safari/iOS đôi khi giới hạn range playbackRate, nhưng 0.9-1.1 thường OK.
             const targetRate = diff > 0 ? 0.95 : 1.05;
             
             // Chỉ set lại nếu rate đang khác để tránh trigger event liên tục
             if (Math.abs(video.playbackRate - targetRate) > 0.01) {
                 video.playbackRate = targetRate;
                 // console.log(`⏩ Smooth Sync: Adjusting rate to ${targetRate}x (Drift: ${diff.toFixed(3)}s)`);
             }
          } 
          // 3. PERFECT SYNC: Nếu lệch rất ít (< 0.05s) -> Chạy tốc độ chuẩn
          else {
             if (video.playbackRate !== 1.0) {
                 video.playbackRate = 1.0;
             }
          }
          
          // Force play nếu bị pause bất thường (nhưng đã có dữ liệu)
          if (video.paused && video.readyState >= 2) {
             video.play().catch(e => {});
          }
        };

        // Chạy ngay khi Active
        performSmoothSync();

        // Kiểm tra mỗi 500ms (Đủ nhanh để mượt, không quá tải CPU)
        const interval = setInterval(performSmoothSync, 500);

        return () => {
            clearInterval(interval);
            // Reset rate khi unmount/inactive
            if (video) video.playbackRate = 1.0;
        };
      } else {
        // Khi Inactive: Pause
        videoRef.current.pause();
        videoRef.current.playbackRate = 1.0; // Reset rate
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
          preload="auto"
          muted={!isActive}
          loop={false} // Tắt loop mặc định của thẻ video để sync logic tự xử lý
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
    if (dummyAudioRef.current) {
      dummyAudioRef.current.play().catch(() => {});
    }
  };

  if (!state) return null;

  // Xác định Video nào đang Active
  const isWaiting = state.status === EventStatus.WAITING;
  const isActivated = state.status === EventStatus.ACTIVATED;

  // Helper check loại link
  const getType = (url: string) => (url.includes('youtube') || url.includes('youtu.be')) ? 'youtube' : 'native';

  return (
    <div className="h-[100dvh] w-screen relative overflow-hidden bg-black select-none">
      
      {/* 
         LAYER SYSTEM
      */}
      
      {/* 1. Waiting Layer */}
      <MediaLayer 
        url={state.waitingUrl} 
        isActive={isWaiting} 
        type={getType(state.waitingUrl)}
        timestamp={state.timestamp} 
        globalUnlocked={unlocked}
      />

      {/* 2. Activated Layer */}
      <MediaLayer 
        url={state.activatedUrl} 
        isActive={isActivated} 
        type={getType(state.activatedUrl)}
        timestamp={state.timestamp} 
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
          <div className="text-center space-y-8 z-10 px-6 b p-4 ">
            <h1 className="text-4xl md:text-7xl font-orbitron font-bold text-white tracking-tighter drop-shadow-[0_0_15px_rgba(249,115,22,0.8)]">
              {state.titlePrefix} <span className="text-orange-500">{state.titleHighlight}</span> {state.titleSuffix}
            </h1>
            <div className="flex flex-col gap-4 items-center ">
              <button 
                onClick={handleUnlock}
                className="group relative px-12 py-5 bg-orange-600 hover:bg-orange-500 text-white font-orbitron font-bold text-lg tracking-widest transition-all clip-path-polygon shadow-[0_0_30px_rgba(249,115,22,0.4)] hover:shadow-[0_0_50px_rgba(249,115,22,0.8)] hover:scale-105 active:scale-95"
                style={{ clipPath: 'polygon(10% 0, 100% 0, 100% 70%, 90% 100%, 0 100%, 0 30%)' }}
              >
                {state.buttonText || 'ACCESS SYSTEM'}
              </button>
             
            </div>
          </div>
        </div>
      )}

      {/* Waiting Overlay Indicator - Moved to bottom-4 (very close to edge) */}
      <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-[60] transition-opacity duration-500 ${isWaiting && unlocked ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-center gap-4 px-10 py-3 rounded-full border border-orange-500/60 shadow-[0_0_30px_rgba(249,115,22,0.3)] backdrop-blur-[2px] bg-black/40">
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