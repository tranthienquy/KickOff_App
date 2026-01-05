
import React, { useState } from 'react';
import { HashRouter, Routes, Route, Link } from 'react-router-dom';
import ClientView from './components/ClientView';
import AdminView from './components/AdminView';

const App: React.FC = () => {
  const [showNav, setShowNav] = useState(false);

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<ClientView />} />
        <Route path="/admin" element={<AdminView />} />
      </Routes>

      {/* Quick Navigation Helper - Chỉ dùng để test trong preview */}
      <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2">
        {showNav && (
          <div className="flex flex-col gap-2 bg-slate-900/90 border border-cyan-500/50 p-2 rounded-lg backdrop-blur-md shadow-xl">
            <Link 
              to="/" 
              className="px-4 py-2 text-xs font-orbitron text-cyan-400 hover:bg-cyan-500/20 rounded transition-colors"
              onClick={() => setShowNav(false)}
            >
              GIAO DIỆN IPAD (CLIENT)
            </Link>
            <Link 
              to="/admin" 
              className="px-4 py-2 text-xs font-orbitron text-pink-400 hover:bg-pink-500/20 rounded transition-colors"
              onClick={() => setShowNav(false)}
            >
              GIAO DIỆN LAPTOP (ADMIN)
            </Link>
          </div>
        )}
        <button 
          onClick={() => setShowNav(!showNav)}
          className="w-10 h-10 bg-slate-800 border border-cyan-500/50 rounded-full flex items-center justify-center text-cyan-400 hover:scale-110 transition-transform shadow-lg"
          title="Switch View"
        >
          {showNav ? '✕' : '⚙️'}
        </button>
      </div>
    </HashRouter>
  );
};

export default App;
