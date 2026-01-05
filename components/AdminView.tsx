
import React, { useState, useEffect, useRef } from 'react';
import { AppState, EventStatus } from '../types.ts';
import { syncState, updateStatus, updateUrls, resetSystem, isFirebaseConnected, storage } from '../services/firebase.ts';
import { ref as sRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage';

const AdminView: React.FC = () => {
  const [state, setState] = useState<AppState | null>(null);
  const [countdownUrl, setCountdownUrl] = useState('');
  const [activatedUrl, setActivatedUrl] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  
  const connected = isFirebaseConnected();
  const countdownInputRef = useRef<HTMLInputElement>(null);
  const activatedInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unsubscribe = syncState((newState) => {
      setState(newState);
      if (!countdownUrl) setCountdownUrl(newState.countdownUrl);
      if (!activatedUrl) setActivatedUrl(newState.activatedUrl);
    });
    return () => unsubscribe();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'countdown' | 'activated') => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!storage) {
      alert("LỖI: Firebase Storage chưa được kết nối.");
      return;
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const filePath = `event-videos/${type}_${Date.now()}_${safeName}`;
    const storageRef = sRef(storage, filePath);

    try {
      const uploadTask = uploadBytesResumable(storageRef, file);

      uploadTask.on('state_changed', 
        (snapshot) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
          setUploadProgress(prev => ({ ...prev, [type]: Math.round(progress) }));
        }, 
        (error) => {
          alert("Lỗi upload: " + error.message);
          setUploadProgress(prev => ({ ...prev, [type]: 0 }));
          e.target.value = '';
        }, 
        async () => {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          if (type === 'countdown') setCountdownUrl(downloadURL);
          else setActivatedUrl(downloadURL);
          setUploadProgress(prev => ({ ...prev, [type]: 0 }));
          alert(`Tải lên thành công! Hãy bấm SYNC để áp dụng.`);
          e.target.value = '';
        }
      );
    } catch (err) {
      alert("Không thể khởi tạo quá trình tải lên.");
    }
  };

  const handleUpdateUrls = async () => {
    setIsUpdating(true);
    try {
      await updateUrls(countdownUrl, activatedUrl);
      alert('ĐÃ ĐỒNG BỘ THÀNH CÔNG.');
    } catch (e) {
      alert('Lỗi đồng bộ: ' + (e as Error).message);
    } finally {
      setIsUpdating(false);
    }
  };

  if (!state) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center font-orbitron text-cyan-400">
      LOADING CONSOLE...
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-inter p-6 pb-24">
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="flex justify-between items-center p-6 bg-slate-900/50 border border-slate-800 rounded-2xl">
          <div>
            <h1 className="text-xl font-orbitron font-bold text-white flex items-center gap-3 uppercase tracking-wider">
              <span className={`w-3 h-3 rounded-full ${connected ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' : 'bg-red-500 animate-pulse'}`}></span>
              Control Center
            </h1>
            <p className="text-slate-500 text-[10px] font-orbitron mt-1">
              STATUS: {connected ? 'STORAGE ONLINE' : 'STORAGE OFFLINE'}
            </p>
          </div>
          <div className="px-6 py-2 bg-slate-950 border border-slate-800 rounded-xl">
             <div className="text-[9px] text-slate-500 font-orbitron uppercase">Global State</div>
             <div className="text-cyan-400 font-orbitron font-bold text-sm uppercase">{state.status}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <button 
            onClick={() => updateStatus(EventStatus.WAITING)}
            className={`p-8 rounded-2xl border transition-all flex flex-col items-center gap-4 ${state.status === EventStatus.WAITING ? 'bg-slate-800 border-white shadow-xl' : 'bg-slate-900 border-slate-800'}`}
          >
            <div className="text-4xl">💤</div>
            <div className="font-orbitron font-bold text-xs text-white">CHẾ ĐỘ CHỜ (LOGO)</div>
          </button>

          <button 
            onClick={() => updateStatus(EventStatus.COUNTDOWN)}
            className={`p-8 rounded-2xl border transition-all flex flex-col items-center gap-4 ${state.status === EventStatus.COUNTDOWN ? 'bg-amber-500/20 border-amber-500 shadow-lg shadow-amber-500/10' : 'bg-slate-900 border-slate-800'}`}
          >
            <div className="text-4xl">📽️</div>
            <div className="font-orbitron font-bold text-xs text-white">PHÁT CLIP CHỜ</div>
          </button>

          <button 
            onClick={() => updateStatus(EventStatus.ACTIVATED)}
            className={`p-8 rounded-2xl border transition-all flex flex-col items-center gap-4 ${state.status === EventStatus.ACTIVATED ? 'bg-emerald-500/20 border-emerald-500 shadow-lg shadow-emerald-500/10' : 'bg-slate-900 border-slate-800'}`}
          >
            <div className="text-4xl">🚀</div>
            <div className="font-orbitron font-bold text-xs text-white">PHÁT CLIP CHÍNH</div>
          </button>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-8 md:p-10 space-y-10">
          <h2 className="text-sm font-orbitron font-bold text-slate-400 uppercase tracking-[0.2em] border-b border-slate-800 pb-4">Media Sources</h2>
          
          <div className="space-y-12">
            <div className="space-y-4">
              <label className="text-[11px] font-orbitron text-slate-500 uppercase tracking-widest">1. Clip Chờ Video URL / File</label>
              <div className="flex gap-2">
                <input 
                  type="text" value={countdownUrl} onChange={(e) => setCountdownUrl(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-4 text-sm outline-none"
                  placeholder="Paste URL or Upload"
                />
                <input type="file" ref={countdownInputRef} className="hidden" accept="video/*" onChange={(e) => handleFileUpload(e, 'countdown')} />
                <button onClick={() => countdownInputRef.current?.click()} className="px-6 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-orbitron border border-slate-700">
                  {uploadProgress.countdown > 0 ? `${uploadProgress.countdown}%` : 'UPLOAD'}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <label className="text-[11px] font-orbitron text-slate-500 uppercase tracking-widest">2. Clip Phát Chính Video URL / File</label>
              <div className="flex gap-2">
                <input 
                  type="text" value={activatedUrl} onChange={(e) => setActivatedUrl(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-4 text-sm outline-none"
                  placeholder="Paste URL or Upload"
                />
                <input type="file" ref={activatedInputRef} className="hidden" accept="video/*" onChange={(e) => handleFileUpload(e, 'activated')} />
                <button onClick={() => activatedInputRef.current?.click()} className="px-6 bg-slate-800 hover:bg-slate-700 rounded-xl text-[10px] font-orbitron border border-slate-700">
                  {uploadProgress.activated > 0 ? `${uploadProgress.activated}%` : 'UPLOAD'}
                </button>
              </div>
            </div>
          </div>

          <div className="pt-8 border-t border-slate-800 flex justify-end">
            <button 
              onClick={handleUpdateUrls}
              disabled={isUpdating}
              className="px-12 py-4 bg-cyan-600 hover:bg-cyan-500 text-white font-orbitron font-bold rounded-xl transition-all shadow-lg shadow-cyan-900/20 disabled:opacity-50 uppercase tracking-widest"
            >
              {isUpdating ? 'SAVING...' : 'SYNC ALL DEVICES'}
            </button>
          </div>
        </div>

        <div className="text-center pt-8">
           <button 
             onClick={() => { if(confirm('Wipe system settings?')) resetSystem(); }}
             className="text-slate-800 hover:text-red-900 text-[9px] font-orbitron uppercase transition-colors"
           >
             System Emergency Reset
           </button>
        </div>
      </div>
    </div>
  );
};

export default AdminView;
