import React, { useState } from 'react';
import { HashRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import ClientView from './components/ClientView.tsx';
import AdminView from './components/AdminView.tsx';

const NavigationHelper = () => {
  const [showNav, setShowNav] = useState(false);
  const location = useLocation();

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3">
      {showNav && (
        <div className="flex flex-col gap-2 bg-black/90 border border-orange-500/30 p-3 rounded-2xl backdrop-blur-xl shadow-2xl scale-110 origin-bottom-right">
          <div className="px-3 py-1 mb-1 text-[10px] font-orbitron text-slate-500 uppercase border-b border-slate-800">Switch Console</div>
          <Link 
            to="/" 
            className={`px-4 py-3 text-xs font-orbitron rounded-xl transition-all flex items-center gap-3 ${location.pathname === '/' ? 'bg-orange-500 text-black' : 'text-orange-400 hover:bg-orange-500/10'}`}
            onClick={() => setShowNav(false)}
          >
            <span>📱</span> IPAD CLIENT
          </Link>
          <Link 
            to="/admin" 
            className={`px-4 py-3 text-xs font-orbitron rounded-xl transition-all flex items-center gap-3 ${location.pathname === '/admin' ? 'bg-orange-600 text-white' : 'text-orange-400 hover:bg-orange-500/10'}`}
            onClick={() => setShowNav(false)}
          >
            <span>💻</span> LAPTOP ADMIN
          </Link>
        </div>
      )}
      <button 
        onClick={() => setShowNav(!showNav)}
        className="w-14 h-14 bg-slate-900 border-2 border-orange-500/50 rounded-full flex items-center justify-center text-2xl hover:scale-110 active:scale-95 transition-all shadow-[0_0_20px_rgba(249,115,22,0.3)]"
        title="Settings"
      >
        {showNav ? '✕' : '⚙️'}
      </button>
    </div>
  );
};

const App: React.FC = () => {
  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route path="/" element={<ClientView />} />
        <Route path="/admin" element={<AdminView />} />
      </Routes>
      <NavigationHelper />
    </HashRouter>
  );
};

export default App;