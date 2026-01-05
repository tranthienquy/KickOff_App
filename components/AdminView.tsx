
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, EventStatus } from '../types';
import { syncState, updateStatus, updateUrls, resetSystem, uploadVideo } from '../services/firebase';

const AdminView: React.FC = () => {
  const [state, setState] = useState<AppState | null>(null);
  const [countdownUrl, setCountdownUrl] = useState('');
  const [activatedUrl, setActivatedUrl] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [uploadingField, setUploadingField] = useState<'countdown' | 'activated' | null>(null);

  useEffect(() => {
    const unsubscribe = syncState((newState) => {
      setState(newState);
      if (!countdownUrl) setCountdownUrl(newState.countdownUrl);
      if (!activatedUrl) setActivatedUrl(newState.activatedUrl);
    });
    return () => unsubscribe();
  }, []);

  const handleUpdateUrls = async () => {
    setIsUpdating(true);
    try {
      await updateUrls(countdownUrl, activatedUrl);
      alert('Đã đồng bộ Video tới tất cả iPad/LED!');
    } catch (error) {
      console.error(error);
      alert('Lỗi cập nhật. Vui lòng kiểm tra cấu hình Firebase.');
    } finally {
      setIsUpdating(false);
    }
  };

  const onFileDrop = useCallback(async (e: React.DragEvent, type: 'countdown' | 'activated') => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      handleFileUpload(file, type);
    } else {
      alert('Vui lòng chọn file video hợp lệ.');
    }
  }, [countdownUrl, activatedUrl]);

  const handleFileUpload = async (file: File, type: 'countdown' | 'activated') => {
    setUploadingField(type);
    try {
      const url = await uploadVideo(file, type);
      if (type === 'countdown') {
        setCountdownUrl(url);
      } else {
        setActivatedUrl(url);
      }
    } catch (error) {
      console.error(error);
      alert('Upload thất bại. Hãy đảm bảo bạn đã bật Firebase Storage và phân quyền Public.');
    } finally {
      setUploadingField(null);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'countdown' | 'activated') => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file, type);
    }
  };

  if (!state) return (
    <div className="min-h-screen bg-black flex items-center justify-center">
      <div className="text-cyan-400 font-orbitron animate-pulse text-xl">CONNECTING TO AI SYSTEM...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#000510] text-white font-inter p-4 md:p-8 bg-grid">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header - Control Station */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-cyan-900 pb-8">
          <div>
            <h1 className="text-4xl font-orbitron font-bold text-[#00f2ff] glow-text">AI YOUNG GURU</h1>
            <p className="text-cyan-500/60 text-xs font-orbitron tracking-widest mt-1 uppercase">Hệ Thống Điều Khiển Đồng Bộ Tập Trung</p>
          </div>
          <div className="flex items-center gap-4 bg-cyan-950/30 p-4 rounded-lg border border-cyan-800">
            <div className="text-right">
              <div className="text-[10px] text-cyan-500 font-orbitron">TRẠNG THÁI HỆ THỐNG</div>
              <div className="text-sm font-bold text-green-400 font-orbitron uppercase">{state.status.replace('_', ' ')}</div>
            </div>
            <div className="w-4 h-4 rounded-full bg-green-500 animate-pulse shadow-[0_0_15px_#22c55e]"></div>
          </div>
        </div>

        {/* Media Management - Video Upload & Previews */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* Section 1: Countdown Clip */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-orbitron text-sm text-cyan-400 uppercase tracking-wider">1. Video Đếm Ngược (10s)</h3>
              {countdownUrl && <span className="text-[10px] bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded">SẴN SÀNG</span>}
            </div>

            <div className="relative group overflow-hidden rounded-xl border-2 border-dashed border-slate-700 aspect-video bg-black flex items-center justify-center">
              {countdownUrl ? (
                <video src={countdownUrl} controls className="w-full h-full object-contain" />
              ) : (
                <div className="text-center p-4">
                  <div className="text-3xl mb-2">📥</div>
                  <p className="text-[10px] text-slate-500 font-orbitron">KÉO THẢ VIDEO VÀO ĐÂY</p>
                </div>
              )}
              <input 
                type="file" 
                accept="video/*" 
                className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                onChange={(e) => handleFileInputChange(e, 'countdown')}
              />
              {uploadingField === 'countdown' && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
                  <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                  <span className="text-[10px] font-orbitron">UPLOADING...</span>
                </div>
              )}
            </div>
            <input 
              type="text" 
              value={countdownUrl}
              onChange={(e) => setCountdownUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-[10px] font-mono text-cyan-300 focus:ring-1 focus:ring-cyan-500 outline-none"
              placeholder="Hoặc dán link video trực tiếp..."
            />
          </div>

          {/* Section 2: Activation Clip */}
          <div className="bg-slate-900/50 border border-slate-800 rounded-2xl p-6 space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-orbitron text-sm text-pink-400 uppercase tracking-wider">2. Video Chính (Kích Hoạt)</h3>
              {activatedUrl && <span className="text-[10px] bg-pink-500/20 text-pink-400 px-2 py-1 rounded">SẴN SÀNG</span>}
            </div>

            <div className="relative group overflow-hidden rounded-xl border-2 border-dashed border-slate-700 aspect-video bg-black flex items-center justify-center">
              {activatedUrl ? (
                <video src={activatedUrl} controls className="w-full h-full object-contain" />
              ) : (
                <div className="text-center p-4">
                  <div className="text-3xl mb-2">📥</div>
                  <p className="text-[10px] text-slate-500 font-orbitron">KÉO THẢ VIDEO VÀO ĐÂY</p>
                </div>
              )}
              <input 
                type="file" 
                accept="video/*" 
                className="absolute inset-0 opacity-0 cursor-pointer z-10" 
                onChange={(e) => handleFileInputChange(e, 'activated')}
              />
              {uploadingField === 'activated' && (
                <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center z-20">
                  <div className="w-12 h-12 border-4 border-pink-500 border-t-transparent rounded-full animate-spin mb-2"></div>
                  <span className="text-[10px] font-orbitron">UPLOADING...</span>
                </div>
              )}
            </div>
            <input 
              type="text" 
              value={activatedUrl}
              onChange={(e) => setActivatedUrl(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-[10px] font-mono text-pink-300 focus:ring-1 focus:ring-pink-500 outline-none"
              placeholder="Hoặc dán link video trực tiếp..."
            />
          </div>
        </div>

        {/* Deploy & Reset Actions */}
        <div className="flex flex-col md:flex-row gap-4">
          <button 
            onClick={handleUpdateUrls}
            disabled={isUpdating || !!uploadingField}
            className="flex-1 py-4 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-orbitron font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20 uppercase tracking-widest text-sm"
          >
            {isUpdating ? 'ĐANG ĐỒNG BỘ...' : 'Cập Nhật Video Tới Tất Cả Thiết Bị'}
          </button>
          <button 
            onClick={resetSystem}
            className="px-8 py-4 border border-red-900/50 text-red-500 font-orbitron font-bold rounded-xl hover:bg-red-950 transition-all uppercase tracking-widest text-xs"
          >
            RESET TOÀN BỘ
          </button>
        </div>

        {/* COMMAND CENTER - EXECUTION BUTTONS */}
        <div className="bg-[#001020] rounded-3xl p-8 border-t-4 border-cyan-500 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
            <div className="text-9xl">☢️</div>
          </div>
          
          <h2 className="text-2xl font-orbitron font-bold mb-8 flex items-center gap-3">
             <span className="w-3 h-8 bg-cyan-500"></span>
             BẢNG ĐIỀU KHIỂN SÂN KHẤU
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            
            {/* Command 1: Countdown */}
            <div className="space-y-4">
              <button 
                onClick={() => updateStatus(EventStatus.COUNTDOWN)}
                className={`w-full aspect-square md:aspect-auto md:h-48 rounded-2xl border-4 transition-all flex flex-col items-center justify-center gap-4 group ${state.status === EventStatus.COUNTDOWN ? 'bg-cyan-500 border-white shadow-[0_0_30px_#06b6d4]' : 'bg-slate-900 border-cyan-900 hover:border-cyan-500'}`}
              >
                <div className={`text-5xl transition-transform group-hover:scale-110 ${state.status === EventStatus.COUNTDOWN ? 'animate-pulse' : ''}`}>⏱️</div>
                <div className={`font-orbitron font-black text-center px-4 leading-tight ${state.status === EventStatus.COUNTDOWN ? 'text-white' : 'text-cyan-400'}`}>
                  PHÁT VIDEO<br/>ĐẾM NGƯỢC
                </div>
              </button>
              <p className="text-[10px] text-center text-slate-500 font-orbitron uppercase tracking-widest">Trình chiếu clip 10 giây</p>
            </div>

            {/* Command 2: Ready UI */}
            <div className="space-y-4">
              <button 
                onClick={() => updateStatus(EventStatus.TRIGGER_READY)}
                className={`w-full aspect-square md:aspect-auto md:h-48 rounded-2xl border-4 transition-all flex flex-col items-center justify-center gap-4 group ${state.status === EventStatus.TRIGGER_READY ? 'bg-amber-500 border-white shadow-[0_0_30px_#f59e0b]' : 'bg-slate-900 border-slate-800 hover:border-amber-500'}`}
              >
                <div className={`text-5xl transition-transform group-hover:scale-110 ${state.status === EventStatus.TRIGGER_READY ? 'animate-bounce' : ''}`}>⚡</div>
                <div className={`font-orbitron font-black text-center px-4 leading-tight ${state.status === EventStatus.TRIGGER_READY ? 'text-white' : 'text-amber-400'}`}>
                  BẬT GIAO DIỆN<br/>CHỜ KÍCH HOẠT
                </div>
              </button>
              <p className="text-[10px] text-center text-slate-500 font-orbitron uppercase tracking-widest">Hiển thị vòng tròn Pulse trên iPad</p>
            </div>

            {/* Command 3: Activation */}
            <div className="space-y-4">
              <button 
                onClick={() => updateStatus(EventStatus.ACTIVATED)}
                className={`w-full aspect-square md:aspect-auto md:h-48 rounded-2xl border-4 transition-all flex flex-col items-center justify-center gap-4 group ${state.status === EventStatus.ACTIVATED ? 'bg-red-600 border-white shadow-[0_0_40px_#dc2626]' : 'bg-slate-900 border-red-900 hover:border-red-600'}`}
              >
                <div className={`text-5xl transition-transform group-hover:scale-110 ${state.status === EventStatus.ACTIVATED ? 'animate-ping' : ''}`}>🚀</div>
                <div className={`font-orbitron font-black text-center px-4 leading-tight ${state.status === EventStatus.ACTIVATED ? 'text-white' : 'text-red-500'}`}>
                  PHÁT VIDEO<br/>CHÍNH (LAUNCH)
                </div>
              </button>
              <p className="text-[10px] text-center text-slate-500 font-orbitron uppercase tracking-widest">Khoảnh khắc bùng nổ cuối cùng</p>
            </div>

          </div>
        </div>

        {/* Usage Instructions */}
        <div className="bg-cyan-950/20 border border-cyan-900/50 p-6 rounded-2xl">
          <h4 className="font-orbitron text-xs text-cyan-400 mb-2 uppercase tracking-widest">Hướng Dẫn Quy Trình:</h4>
          <ol className="text-xs text-slate-400 space-y-2 list-decimal ml-4 font-inter">
            <li><b>Upload:</b> Kéo thả Video Đếm ngược và Video Chính vào các ô trên.</li>
            <li><b>Đồng bộ:</b> Nhấn "Cập Nhật Video" để các iPad tải dữ liệu về bộ nhớ đệm (Cache).</li>
            <li><b>Phát:</b> Khi MC hô "Bắt đầu đếm ngược", nhấn nút màu xanh.</li>
            <li><b>Chờ:</b> Hết đếm ngược, nhấn nút màu vàng để iPad hiện vòng tròn "Chờ chạm".</li>
            <li><b>Kích hoạt:</b> Nhấn nút màu đỏ để tất cả iPad & LED cùng nổ tung với Video Chính.</li>
          </ol>
        </div>

      </div>
    </div>
  );
};

export default AdminView;
