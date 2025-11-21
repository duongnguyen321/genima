import React, { useState, useEffect } from 'react';
import { ImageEditor } from './components/ImageEditor';
import { Sidebar } from './components/Sidebar';
import { ImageModal } from './components/ImageModal';
import { Session } from './types';
import { 
  getAllSessionsFromDB, 
  saveSessionToDB, 
  deleteSessionFromDB, 
  clearLocalStorageAndMigrate 
} from './services/storageService';

function App() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true); // Default open on desktop
  const [modalImage, setModalImage] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  // Mouse Tracking for Spotlight Effect
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Initialize and load sessions from DB (with migration fallback)
  useEffect(() => {
    const initializeApp = async () => {
      try {
        // Check screen size for initial sidebar state
        if (window.innerWidth < 768) {
          setIsSidebarOpen(false);
        }

        // 1. Try to get sessions from IndexedDB
        let loadedSessions = await getAllSessionsFromDB();

        // 2. If DB is empty, check local storage for legacy data and migrate
        if (loadedSessions.length === 0) {
           const migratedSessions = await clearLocalStorageAndMigrate();
           if (migratedSessions) {
             loadedSessions = migratedSessions;
           }
        }

        // 3. Hydrate settings if missing
        if (loadedSessions.length > 0) {
          const hydratedSessions = loadedSessions.map((s: any) => ({
            ...s,
            settings: {
                temperature: 1.0,
                style: 'None',
                aspectRatio: '1:1',
                isFullBody: false,
                ...(s.settings || {})
            }
          }));
          
          // Sort by last modified (newest first)
          hydratedSessions.sort((a: Session, b: Session) => b.lastModified - a.lastModified);
          
          setSessions(hydratedSessions);
          setCurrentSessionId(hydratedSessions[0].id);
        } else {
          // No data anywhere, start fresh
          await createNewSession();
        }
      } catch (e) {
        console.error("Failed to initialize app:", e);
        await createNewSession();
      } finally {
        setIsInitialized(true);
      }
    };

    initializeApp();
  }, []);

  const createNewSession = async () => {
    const newSession: Session = {
      id: Date.now().toString(),
      title: 'New Chat',
      messages: [], // Empty messages array - no welcome text
      activeImage: null,
      lastModified: Date.now(),
      settings: { 
          temperature: 1.0, 
          style: 'None', 
          aspectRatio: '1:1',
          isFullBody: false
      }
    };
    
    setSessions(prev => [newSession, ...prev]);
    setCurrentSessionId(newSession.id);
    if (window.innerWidth < 768) setIsSidebarOpen(false);
    
    // Persist to DB
    await saveSessionToDB(newSession);
  };

  const handleUpdateSession = (updatedSession: Session) => {
    // Optimistic UI update
    setSessions(prev => prev.map(s => s.id === updatedSession.id ? updatedSession : s));
    
    // Persist to DB asynchronously
    saveSessionToDB(updatedSession);
  };

  const handleDeleteSession = (sessionId: string) => {
    const updatedSessions = sessions.filter(s => s.id !== sessionId);
    
    // Update UI
    if (updatedSessions.length === 0) {
      // Ensure there is always one session
      const newSession: Session = {
        id: Date.now().toString(),
        title: 'New Chat',
        messages: [], // Empty messages
        activeImage: null,
        lastModified: Date.now(),
        settings: { 
            temperature: 1.0, 
            style: 'None', 
            aspectRatio: '1:1',
            isFullBody: false 
        }
      };
      setSessions([newSession]);
      setCurrentSessionId(newSession.id);
      saveSessionToDB(newSession);
    } else {
      setSessions(updatedSessions);
      // If the deleted session was active, switch to the first available one
      if (currentSessionId === sessionId) {
        setCurrentSessionId(updatedSessions[0].id);
      }
    }
    
    // Remove from DB
    deleteSessionFromDB(sessionId);
  };

  const handleSelectSession = (id: string) => {
    setCurrentSessionId(id);
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  };

  const currentSession = sessions.find(s => s.id === currentSessionId);

  return (
    <div className="h-screen flex overflow-hidden relative">
      {/* Ambient Deep Space Background */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-[#020203]">
        {/* Deep static nebulae */}
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-indigo-900/5 rounded-full blur-[150px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-purple-900/5 rounded-full blur-[150px]"></div>
        
        {/* Interactive Mouse Spotlight - Added color tint */}
        <div 
          className="fixed w-[800px] h-[800px] rounded-full bg-[radial-gradient(circle,rgba(99,102,241,0.06)_0%,transparent_70%)] blur-[50px] pointer-events-none transition-transform duration-75 ease-out will-change-transform"
          style={{ 
            left: mousePos.x, 
            top: mousePos.y, 
            transform: 'translate(-50%, -50%)' 
          }}
        />
      </div>
      
      <div className="relative z-10 flex h-full w-full">
        <Sidebar 
            sessions={sessions}
            currentSessionId={currentSessionId || ''}
            onSelectSession={handleSelectSession}
            onNewSession={createNewSession}
            onDeleteSession={handleDeleteSession}
            isOpen={isSidebarOpen}
            toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        />

        <div className="flex-1 flex flex-col min-w-0 relative transition-all duration-500 ease-in-out">
            
            {/* Floating Toggle Button (Visible when sidebar is closed on desktop) */}
            {!isSidebarOpen && (
                <div className="absolute top-4 left-4 z-50 animate-fade-in">
                    <button 
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 text-slate-500 hover:text-white bg-black/20 hover:bg-white/5 backdrop-blur-md border border-white/5 rounded-xl transition-all shadow-lg"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                        </svg>
                    </button>
                </div>
            )}

            {/* Mobile Toggle */}
            <div className="md:hidden absolute top-0 left-0 w-full h-16 flex items-center px-4 z-40 pointer-events-none">
                <button 
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="pointer-events-auto p-2 text-slate-400 hover:text-white bg-black/40 backdrop-blur-md border border-white/5 rounded-xl"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
            </div>

            {/* Main Content */}
            <main className="flex-1 overflow-hidden relative flex flex-col">
            {isInitialized && currentSession ? (
                <ImageEditor 
                session={currentSession} 
                onUpdateSession={handleUpdateSession}
                onImageClick={setModalImage}
                />
            ) : (
                <div className="flex-1 flex items-center justify-center text-slate-600">
                <div className="text-center">
                    <div className="animate-spin h-6 w-6 border-2 border-indigo-500/50 border-t-transparent rounded-full mx-auto mb-4"></div>
                    {isInitialized ? "Initializing..." : "Connecting..."}
                </div>
                </div>
            )}
            </main>
        </div>
      </div>

      {/* Full Screen Image Modal */}
      <ImageModal 
        imageUrl={modalImage} 
        onClose={() => setModalImage(null)} 
      />
    </div>
  );
}

export default App;