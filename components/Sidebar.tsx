import React from 'react';
import { Session } from '../types';

interface SidebarProps {
  sessions: Session[];
  currentSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onDeleteSession: (id: string) => void;
  isOpen: boolean;
  toggleSidebar: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  sessions, 
  currentSessionId, 
  onSelectSession, 
  onNewSession,
  onDeleteSession,
  isOpen,
  toggleSidebar
}) => {
  return (
    <>
      {/* Mobile Overlay */}
      <div 
        className={`fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={toggleSidebar}
      />

      {/* Sidebar Container */}
      <aside className={`
        fixed md:relative inset-y-0 left-0 z-50
        w-72 bg-black/40 backdrop-blur-xl border-r border-white/5 flex flex-col
        transform transition-all duration-500 cubic-bezier(0.4, 0, 0.2, 1) shadow-2xl
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:ml-[-18rem]'}
      `}>
        {/* Header */}
        <div className="p-6 flex items-center justify-between">
           <div className="font-medium text-sm text-slate-200 tracking-widest uppercase flex items-center gap-3">
              <div className="w-6 h-6 rounded bg-white/5 flex items-center justify-center border border-white/5">
                 <div className="w-2 h-2 bg-indigo-500 rounded-full shadow-[0_0_10px_rgba(99,102,241,0.8)] animate-pulse"></div>
              </div>
              <span>Flash</span>
           </div>
           
           <button onClick={toggleSidebar} className="text-slate-600 hover:text-white transition-colors">
             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
               <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
             </svg>
           </button>
        </div>

        {/* New Chat Button */}
        <div className="px-4 mb-4">
          <button
            onClick={onNewSession}
            className="w-full bg-white/5 hover:bg-white/10 text-slate-200 border border-white/5 rounded-lg py-2.5 px-4 flex items-center justify-center gap-2 transition-all hover:shadow-[0_0_15px_-5px_rgba(255,255,255,0.1)] group"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 group-hover:rotate-90 transition-transform text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <span className="font-light text-xs tracking-wide">NEW SESSION</span>
          </button>
        </div>

        {/* Session List */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-0.5 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
          {sessions.length === 0 && (
             <div className="text-center text-slate-700 text-[10px] uppercase tracking-widest mt-10">No history</div>
          )}
          
          {[...sessions].sort((a,b) => b.lastModified - a.lastModified).map((session) => (
            <div 
                key={session.id} 
                className={`group flex items-center rounded-lg transition-all duration-300 ${
                    currentSessionId === session.id
                      ? 'bg-white/5 text-white'
                      : 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.02]'
                }`}
            >
                <button
                  onClick={() => onSelectSession(session.id)}
                  className="flex-1 text-left p-2.5 text-sm overflow-hidden outline-none focus:outline-none"
                >
                  <span className="font-light text-xs truncate block w-full tracking-wide">
                    {session.title}
                  </span>
                </button>
                
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDeleteSession(session.id);
                    }}
                    className={`p-1.5 mr-1 rounded text-slate-600 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100 focus:opacity-100 ${currentSessionId === session.id ? 'md:opacity-100' : ''}`}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>
          ))}
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-white/5">
            <div className="flex items-center justify-center gap-2 opacity-20">
                <div className="h-px w-4 bg-white"></div>
                <div className="text-[8px] tracking-[0.2em]">SYSTEM READY</div>
                <div className="h-px w-4 bg-white"></div>
            </div>
        </div>
      </aside>
    </>
  );
};