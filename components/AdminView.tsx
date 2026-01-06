import React, { useState, useEffect } from 'react';
import { AppState, EventStatus, INITIAL_STATE } from '../types.ts';
import { syncState, updateStatus, updateEventConfig, isFirebaseConnected, storage, syncDeviceStats, trackDevice } from '../services/firebase.ts';
import { ref as sRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const AdminView: React.FC = () => {
  const [state, setState] = useState<AppState | null>(null);
  const [deviceStats, setDeviceStats] = useState({ online: 0, offline: 0 });
  
  // Local form states - initialize with defaults to prevent uncontrolled inputs
  const [form, setForm] = useState<Partial<AppState>>(INITIAL_STATE);
  const [isUpdating, setIsUpdating] = useState(false);
  const [pendingStatus, setPendingStatus] = useState<EventStatus | null>(null);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  
  const connected = isFirebaseConnected();

  useEffect(() => {
    trackDevice();

    const unsubscribeState = syncState((newState) => {
      setState(newState);
      setPendingStatus(null);
      // Sync form with remote state on initial load
      setForm(prev => {
        // If previous form was just the initial empty/default state, overwrite it with remote
        if (JSON.stringify(prev) === JSON.stringify(INITIAL_STATE)) return newState;
        return prev;
      });
    });

    const unsubscribeDevices = syncDeviceStats((stats) => {
      setDeviceStats(stats);
    });

    return () => {
      unsubscribeState();
      unsubscribeDevices();
    };
  }, []);

  const handleStatusChange = async (status: EventStatus) => {
    setPendingStatus(status);
    await updateStatus(status);
  };

  const handleInputChange = (key: keyof AppState, value: string) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'waiting' | 'activated' | 'splash') => {
    const file = e.target.files?.[0];
    e.target.value = ''; 
    
    if (!storage) {
      alert("Lỗi: Không kết nối được Firebase Storage. Kiểm tra lại internet hoặc cấu hình.");
      return;
    }

    if (!file) return;

    setUploadProgress(prev => ({ ...prev, [type]: 1 }));

    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
      const filePath = `event-videos/${type}_${Date.now()}_${safeName}`;
      const storageRef = sRef(storage, filePath);

      const uploadTask = uploadBytesResumable(storageRef, file);
      
      uploadTask.on('state_changed', 
        (snap) => {
           const percent = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
           setUploadProgress(prev => ({ ...prev, [type]: percent || 1 }));
        }, 
        (error: any) => {
          console.error("Upload Error Details:", error);
          let errorMessage = error.message;
          
          if (error.code === 'storage/unauthorized') {
             errorMessage = "LỖI QUYỀN (403): Bạn chưa mở quyền ghi cho Storage.";
          } else if (error.code === 'storage/canceled') {
             errorMessage = "Upload bị hủy.";
          } else if (error.code === 'storage/unknown') {
             errorMessage = "Lỗi không xác định.";
          }
          
          alert(`Upload thất bại: ${errorMessage}`);
          setUploadProgress(prev => ({ ...prev, [type]: 0 }));
        }, 
        async () => {
          try {
              const url = await getDownloadURL(uploadTask.snapshot.ref);
              const keyMap = {
                splash: 'splashVideoUrl',
                waiting: 'waitingUrl',
                activated: 'activatedUrl'
              } as const;
              handleInputChange(keyMap[type], url);
              setUploadProgress(prev => ({ ...prev, [type]: 0 }));
              console.log(`Uploaded ${type}: ${url}`);
          } catch (urlError: any) {
              alert(`Lỗi lấy URL sau khi upload: ${urlError.message}`);
          }
        }
      );
    } catch (err: any) {
        alert("Lỗi khởi tạo upload: " + err.message);
        setUploadProgress(prev => ({ ...prev, [type]: 0 }));
    }
  };

  const handleSaveAll = async () => {
    setIsUpdating(true);
    try { 
      await updateEventConfig(form); 
      alert('SUCCESS: ALL TEXT DATA & CONFIG SAVED TO FIREBASE.'); 
    } catch (e) { 
      alert('Error: ' + (e as Error).message); 
    } finally { 
      setIsUpdating(false); 
    }
  };

  if (!state) return (
    <div className="h-screen w-full flex flex-col items-center justify-center bg-slate-950 font-orbitron text-orange-500 gap-4">
      <div className="w-12 h-12 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
      <div className="tracking-[0.2em] animate-pulse">CONNECTING TO FIREBASE...</div>
    </div>
  );

  return (
    <div className="h-screen w-full overflow-y-auto bg-[#0f0400] text-orange-50 font-inter p-4 md:p-6 pb-24 selection:bg-orange-500/30">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-5 bg-slate-900/50 border border-slate-800 rounded-2xl backdrop-blur-md sticky top-0 z-50 shadow-lg">
          <div className="space-y-1">
            <h1 className="text-lg font-orbitron font-bold text-white flex items-center gap-3">
              <span className={`w-3 h-3 rounded-full ${connected ? 'bg-emerald-500 shadow-[0_0_15px_#10b981]' : 'bg-red-500 shadow-[0_0_15px_#ef4444]'}`}></span>
              COMMAND CENTER v2.3
            </h1>
            <div className="flex gap-4 text-[10px] font-orbitron uppercase tracking-widest">
              <span className="text-emerald-400">{deviceStats.online} Active Devices</span>
              <span className="text-slate-500">{deviceStats.offline} Offline</span>
            </div>
          </div>
          <div className="px-4 py-2 bg-slate-950 border border-slate-700 rounded-lg text-orange-500 font-orbitron text-[10px] font-bold">
            SYSTEM STATUS: {state.status.toUpperCase()}
          </div>
        </div>

        {/* Quick Actions - Status Switching */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { id: EventStatus.WAITING, label: 'STANDBY (LOGO)', icon: '💤', color: 'slate' },
            { id: EventStatus.ACTIVATED, label: 'RUN CLIP CHÍNH', icon: '🚀', color: 'emerald' }
          ].map((btn) => (
            <button 
              key={btn.id}
              onClick={() => handleStatusChange(btn.id)}
              className={`p-8 rounded-xl border transition-all duration-300 active:scale-95 flex flex-col items-center gap-3 relative overflow-hidden group ${
                state.status === btn.id 
                  ? `bg-${btn.color}-500/20 border-${btn.color}-500 shadow-[0_0_30px_rgba(0,0,0,0.3)]` 
                  : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
              } ${pendingStatus === btn.id ? 'opacity-50 animate-pulse' : ''}`}
            >
              <div className="text-4xl filter drop-shadow-md group-hover:scale-110 transition-transform">{btn.icon}</div>
              <div className="font-orbitron font-bold text-xs text-white uppercase tracking-wider">{btn.label}</div>
              {state.status === btn.id && (
                 <div className="absolute top-2 right-2 text-[10px] text-white/50 font-mono">ACTIVE</div>
              )}
            </button>
          ))}
        </div>

        {/* RESTART CONTROLS - Added specific buttons for resetting clips */}
        <div className="grid grid-cols-2 gap-4 -mt-2">
            <button 
                onClick={() => handleStatusChange(EventStatus.WAITING)}
                className="bg-slate-800/50 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 text-slate-300 py-3 rounded-lg font-orbitron text-[10px] font-bold tracking-widest uppercase flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg"
            >
                <span className="text-lg">↺</span> RESTART LOOP
            </button>
            <button 
                onClick={() => handleStatusChange(EventStatus.ACTIVATED)}
                className="bg-emerald-900/30 hover:bg-emerald-900/50 border border-emerald-800 hover:border-emerald-500 text-emerald-400 py-3 rounded-lg font-orbitron text-[10px] font-bold tracking-widest uppercase flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg"
            >
                <span className="text-lg">⏮</span> RESTART MAIN CLIP
            </button>
        </div>

        {/* UI Text Settings */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-xl">
          <h2 className="text-xs font-orbitron font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <span className="w-4 h-[1px] bg-slate-700"></span>
            Visual Text Calibration
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-orbitron text-slate-400 uppercase tracking-widest">Prefix</label>
              <input type="text" value={form.titlePrefix || ''} onChange={e => handleInputChange('titlePrefix', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white focus:border-orange-500/50 outline-none transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-orbitron text-orange-500 uppercase tracking-widest">Highlight</label>
              <input type="text" value={form.titleHighlight || ''} onChange={e => handleInputChange('titleHighlight', e.target.value)} className="w-full bg-slate-950 border border-orange-500/30 rounded-lg px-4 py-3 text-sm text-orange-300 focus:border-orange-500/50 outline-none transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-orbitron text-slate-400 uppercase tracking-widest">Suffix</label>
              <input type="text" value={form.titleSuffix || ''} onChange={e => handleInputChange('titleSuffix', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white focus:border-orange-500/50 outline-none transition-all" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-[9px] font-orbitron text-slate-400 uppercase tracking-widest">Main Button Label</label>
              <input type="text" value={form.buttonText || ''} onChange={e => handleInputChange('buttonText', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-orange-500/50 transition-all" />
            </div>
            <div className="space-y-2">
              <label className="text-[9px] font-orbitron text-slate-400 uppercase tracking-widest">Standby Status Text</label>
              <input type="text" value={form.readyText || ''} onChange={e => handleInputChange('readyText', e.target.value)} className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-sm text-white outline-none focus:border-orange-500/50 transition-all" />
            </div>
          </div>

          <div className="space-y-2">
             <label className="text-[9px] font-orbitron text-orange-400 uppercase tracking-widest">Scrolling Message (Footer)</label>
             <input 
               type="text" 
               value={form.scrollingText || ''} 
               onChange={e => handleInputChange('scrollingText', e.target.value)} 
               className="w-full bg-slate-950 border border-orange-500/30 rounded-lg px-4 py-3 text-sm text-orange-100 outline-none focus:border-orange-500/50 transition-all"
               placeholder="Enter marquee text..."
             />
          </div>
        </div>

        {/* Media Asset Management - Updated to 3 columns for better fit */}
        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 md:p-8 space-y-6 shadow-2xl">
          <h2 className="text-xs font-orbitron font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <span className="w-4 h-[1px] bg-slate-700"></span>
            Media Asset Pipeline
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: 'SPLASH SCREEN VIDEO', key: 'splashVideoUrl', type: 'splash' },
              { label: 'WAITING LOOP VIDEO', key: 'waitingUrl', type: 'waiting' },
              { label: 'MAIN ACTIVATION CLIP', key: 'activatedUrl', type: 'activated' }
            ].map((field) => (
              <div key={field.key} className="space-y-3">
                <label className="text-[10px] font-orbitron text-slate-400 tracking-wider uppercase">{field.label}</label>
                <div className="flex flex-col gap-2">
                  <input 
                    type="text" 
                    value={(form as any)[field.key] || ''} 
                    onChange={e => handleInputChange(field.key as any, e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 text-xs outline-none focus:border-orange-500/50 transition-all font-mono text-orange-300/70"
                    placeholder="Enter URL..."
                  />
                  <input 
                    type="file" 
                    id={`file-upload-${field.type}`}
                    className="hidden" 
                    accept="video/*" 
                    onChange={e => handleFileUpload(e, field.type as any)} 
                  />
                  <label 
                    htmlFor={`file-upload-${field.type}`}
                    className={`w-full py-2 rounded-lg text-[9px] font-orbitron border transition-all whitespace-nowrap cursor-pointer flex items-center justify-center
                      ${(uploadProgress as any)[field.type] > 0 
                        ? 'bg-orange-900/50 border-orange-500 text-orange-400 animate-pulse' 
                        : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-300'}`}
                  >
                    {(uploadProgress as any)[field.type] > 0 
                      ? `UPLOADING ${(uploadProgress as any)[field.type]}%` 
                      : 'UPLOAD FILE'}
                  </label>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-6 border-t border-slate-800 flex justify-end">
            <button 
              onClick={handleSaveAll}
              disabled={isUpdating}
              className="px-12 py-4 bg-orange-600 hover:bg-orange-500 text-white font-orbitron font-bold rounded-xl transition-all disabled:opacity-50 text-xs tracking-[0.2em] shadow-[0_0_20px_rgba(249,115,22,0.3)] active:scale-95"
            >
              {isUpdating ? 'SYNCHRONIZING...' : 'SAVE CONFIG & TEXT DATA'}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default AdminView;