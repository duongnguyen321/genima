import React, { useState, useRef, useEffect } from 'react';
import { editImageWithGemini, enhancePrompt } from '../services/geminiService';
import { Message, ImageState, Session, AppSettings } from '../types';
import { Spinner } from './Spinner';

interface ImageEditorProps {
  session: Session;
  onUpdateSession: (updatedSession: Session) => void;
  onImageClick: (url: string) => void;
}

const STYLE_OPTIONS = ['None', 'Anime', 'Photorealistic', 'Cyberpunk', 'Watercolor', 'Oil Painting', 'Pixel Art', 'Sketch', 'Vintage', '3D Render'];
const ASPECT_RATIOS = ['1:1', '3:4', '4:3', '9:16', '16:9'];

const LoadingBubble = () => (
  <div className="flex gap-4 animate-fade-in w-full max-w-[85%] sm:max-w-[75%]">
     <div className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center shrink-0 backdrop-blur-md">
         <div className="h-1.5 w-1.5 bg-indigo-400 rounded-full animate-pulse"></div>
     </div>
     <div className="relative rounded-2xl rounded-tl-none border border-white/5 bg-black/20 backdrop-blur-lg overflow-hidden shadow-xl group">
         {/* Skeleton Area */}
         <div className="w-64 h-64 sm:w-72 sm:h-72 relative bg-black/30">
             {/* Animated Gradient Overlay */}
             <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full animate-[shimmer_1.5s_infinite]"></div>
             
             {/* Central Icon/Text */}
             <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 z-10">
                 <div className="mb-4 relative">
                    <div className="w-10 h-10 rounded-full border-2 border-white/10"></div>
                    <div className="absolute top-0 left-0 w-10 h-10 rounded-full border-2 border-indigo-500/50 border-t-transparent animate-spin"></div>
                 </div>
                 <span className="text-[10px] font-light tracking-[0.3em] uppercase text-white/30 animate-pulse">Generating</span>
             </div>
         </div>
     </div>
     <style>{`
        @keyframes shimmer {
            100% { transform: translateX(100%); }
        }
     `}</style>
  </div>
);

export const ImageEditor: React.FC<ImageEditorProps> = ({ session, onUpdateSession, onImageClick }) => {
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingImages, setPendingImages] = useState<ImageState[]>([]);
  
  // Retry Modal State
  const [retryTargetIndex, setRetryTargetIndex] = useState<number | null>(null);
  const [retryPrompt, setRetryPrompt] = useState('');
  const [retrySettings, setRetrySettings] = useState<AppSettings | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  
  // Ref to track the current session ID for async operations
  const activeSessionIdRef = useRef(session.id);

  const messages = session.messages;
  const activeImage = session.activeImage;
  const settings = session.settings || { temperature: 1.0, style: 'None', aspectRatio: '1:1', isFullBody: false };

  useEffect(() => {
    if (!retryTargetIndex) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, pendingImages, retryTargetIndex]);

  useEffect(() => {
    // Auto-expand textarea height
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [inputValue]);

  useEffect(() => {
    // Update the ref to the new session ID
    activeSessionIdRef.current = session.id;

    // Reset all local state when switching sessions
    setPendingImages([]);
    setInputValue('');
    setShowSettings(false);
    setIsLoading(false);
    setIsEnhancing(false);
    setRetryTargetIndex(null);
    setRetrySettings(null);
    setRetryPrompt('');
  }, [session.id]);

  // Close settings when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const processFiles = (files: FileList | File[]) => {
    const newImages: ImageState[] = [];
    let processedCount = 0;
    const fileArray = Array.from(files);

    if (fileArray.length === 0) return;

    fileArray.forEach(file => {
        if (!file.type.startsWith('image/')) {
            processedCount++;
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const result = e.target?.result as string;
            const base64Data = result.split(',')[1];
            
            newImages.push({
                dataUrl: result,
                mimeType: file.type,
                base64Data: base64Data
            });
            
            processedCount++;
            if (processedCount === fileArray.length) {
                setPendingImages(prev => [...prev, ...newImages]);
                setTimeout(() => textareaRef.current?.focus(), 100);
            }
        };
        reader.readAsDataURL(file);
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
        processFiles(e.target.files);
    }
  };

  // Handle Global Paste Events
  useEffect(() => {
    const handleWindowPaste = (e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        const files: File[] = [];
        let hasImages = false;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                hasImages = true;
                const file = items[i].getAsFile();
                if (file) files.push(file);
            }
        }

        if (hasImages && files.length > 0) {
            // Prevent default paste behavior (like creating img tags in contentEditable)
            e.preventDefault();
            processFiles(files);
        }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, []);

  const handleRemovePendingImage = (index: number) => {
      setPendingImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleEnhancePrompt = async () => {
    if (!inputValue.trim() || isEnhancing) return;
    const currentSessionId = session.id;
    
    setIsEnhancing(true);
    try {
      const enhanced = await enhancePrompt(inputValue);
      // Only update input if we are still on the same session
      if (activeSessionIdRef.current === currentSessionId) {
          setInputValue(enhanced);
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (activeSessionIdRef.current === currentSessionId) {
          setIsEnhancing(false);
      }
    }
  };

  const updateSettings = (newSettings: Partial<AppSettings>) => {
      onUpdateSession({
          ...session,
          settings: { ...settings, ...newSettings }
      });
  };

  const handleSendMessage = async () => {
    const currentSessionId = session.id; // Capture session ID at start
    
    // Validation: Must have either text or images to send
    if ((!inputValue.trim() && pendingImages.length === 0) || isLoading) return;

    const userText = inputValue.trim();
    setInputValue('');
    setShowSettings(false);
    
    const userMsgId = Date.now().toString();
    
    // Capture pending images before clearing
    const currentPendingImages = [...pendingImages];
    
    const newUserMessage: Message = {
      id: userMsgId,
      role: 'user',
      text: userText,
      images: currentPendingImages.length > 0 ? currentPendingImages.map(img => img.dataUrl!) : undefined,
      timestamp: Date.now()
    };

    const updatedMessages = [...messages, newUserMessage];
    
    // Update Title if it's the first message
    let newTitle = session.title;
    if (messages.length <= 1 && userText) {
      newTitle = userText.slice(0, 30) + (userText.length > 30 ? '...' : '');
    } else if (messages.length <= 1 && currentPendingImages.length > 0) {
      newTitle = "Image Edit Session";
    }

    // Determine Context Images:
    // 1. Priority: Pending Images (New Uploads)
    // 2. Priority: Active Image (Current State)
    // 3. Priority: Chat History (Last available image)
    let imagesToSend: ImageState[] = [];
    let nextActiveImage = activeImage;

    if (currentPendingImages.length > 0) {
        imagesToSend = currentPendingImages;
        nextActiveImage = currentPendingImages[currentPendingImages.length - 1];
    } else if (activeImage) {
        imagesToSend = [activeImage];
    } else {
        // Fallback: Search history for the most recent image
        for (let i = messages.length - 1; i >= 0; i--) {
             const msg = messages[i];
             if (msg.images && msg.images.length > 0) {
                 const lastUrl = msg.images[msg.images.length - 1];
                 imagesToSend = [{
                     dataUrl: lastUrl,
                     mimeType: lastUrl.split(';')[0].split(':')[1],
                     base64Data: lastUrl.split(',')[1]
                 }];
                 nextActiveImage = imagesToSend[0];
                 break;
             }
             if (msg.image) { // Backward compatibility
                 const url = msg.image;
                 imagesToSend = [{
                     dataUrl: url,
                     mimeType: url.split(';')[0].split(':')[1],
                     base64Data: url.split(',')[1]
                 }];
                 nextActiveImage = imagesToSend[0];
                 break;
             }
        }
    }

    onUpdateSession({
      ...session,
      title: newTitle,
      messages: updatedMessages,
      activeImage: nextActiveImage, 
      lastModified: Date.now()
    });

    setPendingImages([]);
    setIsLoading(true);

    try {
      // Pass raw prompt; Service handles style injection now
      const effectivePrompt = userText || "Edit this image";

      const result = await editImageWithGemini(
        imagesToSend, // Can be empty -> Text-to-Image mode
        effectivePrompt,
        settings
      );

      const modelMsgId = (Date.now() + 1).toString();
      let modelMessage: Message;

      if (result.imageUrl) {
        modelMessage = {
          id: modelMsgId,
          role: 'model',
          // Text removed per requirement: only show image if successful
          images: [result.imageUrl],
          timestamp: Date.now()
        };
        onUpdateSession({
          ...session,
          title: newTitle,
          messages: [...updatedMessages, modelMessage],
          activeImage: {
              dataUrl: result.imageUrl,
              mimeType: 'image/png',
              base64Data: result.imageUrl.split(',')[1]
          },
          lastModified: Date.now()
        });
      } else {
         modelMessage = {
          id: modelMsgId,
          role: 'model',
          text: result.text || "I processed the request but didn't generate a new image.",
          timestamp: Date.now()
        };
        onUpdateSession({
            ...session,
            title: newTitle,
            messages: [...updatedMessages, modelMessage],
            lastModified: Date.now()
        });
      }

    } catch (error) {
      console.error("Generation error:", error);
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: 'model',
        text: error instanceof Error ? `Error: ${error.message}` : "Sorry, something went wrong with the image generation.",
        isError: true,
        timestamp: Date.now()
      };
      onUpdateSession({
          ...session,
          title: newTitle,
          messages: [...updatedMessages, errorMsg],
          lastModified: Date.now()
      });
    } finally {
      // Only turn off loading if we are still viewing the session that initiated the request
      if (activeSessionIdRef.current === currentSessionId) {
          setIsLoading(false);
      }
    }
  };

  const initiateRetry = (msgIndex: number) => {
    setRetryTargetIndex(msgIndex);
    // Inherit current global settings for the retry by default
    setRetrySettings({ ...settings });
    setRetryPrompt(''); 
  };

  const confirmRetry = async () => {
    if (retryTargetIndex === null || !retrySettings) return;
    
    setRetryTargetIndex(null); // Close modal
    if (isLoading) return;
    
    const currentSessionId = session.id; // Capture session ID

    const msgIndex = retryTargetIndex;
    const userMsg = messages[msgIndex - 1];
    if (!userMsg) return; 

    // 1. Resolve Inputs (Look back for context)
    let inputs: ImageState[] = [];
    if (userMsg.images && userMsg.images.length > 0) {
         inputs = userMsg.images.map(url => ({
             dataUrl: url,
             mimeType: url.split(';')[0].split(':')[1],
             base64Data: url.split(',')[1]
         }));
    } else {
        for (let i = msgIndex - 2; i >= 0; i--) {
            const m = messages[i];
            if (m.images && m.images.length > 0) {
                const lastUrl = m.images[m.images.length - 1];
                inputs = [{
                     dataUrl: lastUrl,
                     mimeType: lastUrl.split(';')[0].split(':')[1],
                     base64Data: lastUrl.split(',')[1]
                }];
                break;
            }
            if (m.image) { 
                inputs = [{
                     dataUrl: m.image,
                     mimeType: m.image.split(';')[0].split(':')[1],
                     base64Data: m.image.split(',')[1]
                }];
                break;
            }
        }
    }

    const basePrompt = userMsg.text || "";
    const additionalPrompt = retryPrompt.trim() ? ` ${retryPrompt.trim()}` : '';
    const fullPrompt = (basePrompt + additionalPrompt) || "Edit this image";

    // 2. Update State: Remove the failed/old message
    const newMessages = messages.slice(0, msgIndex);
    const revertedActiveImage = inputs.length > 0 ? inputs[inputs.length - 1] : null;
    
    onUpdateSession({
        ...session,
        messages: newMessages,
        activeImage: revertedActiveImage
    });
    
    setIsLoading(true);
    
    try {
        // Pass raw prompt; Service handles style injection
        const result = await editImageWithGemini(
            inputs,
            fullPrompt,
            retrySettings
        );
        
        const modelMsgId = (Date.now() + 1).toString();
        let newModelMessage: Message;

        if (result.imageUrl) {
             newModelMessage = {
                id: modelMsgId,
                role: 'model',
                // Text removed per requirement
                images: [result.imageUrl],
                timestamp: Date.now()
             };
             onUpdateSession({
                 ...session,
                 messages: [...newMessages, newModelMessage],
                 activeImage: {
                      dataUrl: result.imageUrl,
                      mimeType: 'image/png',
                      base64Data: result.imageUrl.split(',')[1]
                 },
                 lastModified: Date.now()
             });
        } else {
             newModelMessage = {
                id: modelMsgId,
                role: 'model',
                text: result.text || "I processed the request but didn't generate a new image.",
                timestamp: Date.now()
             };
             onUpdateSession({
                 ...session,
                 messages: [...newMessages, newModelMessage],
                 activeImage: revertedActiveImage,
                 lastModified: Date.now()
             });
        }

    } catch (error) {
        console.error("Retry error:", error);
        const errorMsg: Message = {
            id: Date.now().toString(),
            role: 'model',
            text: error instanceof Error ? `Error: ${error.message}` : "Sorry, something went wrong.",
            isError: true,
            timestamp: Date.now()
        };
        onUpdateSession({
             ...session,
             messages: [...newMessages, errorMsg],
             lastModified: Date.now()
        });
    } finally {
        if (activeSessionIdRef.current === currentSessionId) {
            setIsLoading(false);
        }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const downloadImage = (dataUrl: string, filename: string) => {
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper to render Settings Controls (used in Popover and Modal)
  const renderSettingsControls = (
      currentSettings: AppSettings, 
      onChange: (s: Partial<AppSettings>) => void
  ) => (
    <div className="space-y-5 text-slate-200">
        {/* Temperature */}
        <div>
            <div className="flex justify-between text-[10px] mb-2 font-medium uppercase tracking-widest">
                <span className="text-slate-500">Creativity</span>
                <span className="text-indigo-300 font-mono">{currentSettings.temperature.toFixed(1)}</span>
            </div>
            <input 
                type="range" 
                min="0" 
                max="2" 
                step="0.1" 
                value={currentSettings.temperature}
                onChange={(e) => onChange({ temperature: parseFloat(e.target.value) })}
                className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
        </div>

        {/* Aspect Ratio */}
        <div>
             <label className="block text-[10px] text-slate-500 mb-2 font-medium uppercase tracking-widest">Aspect Ratio</label>
             <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
                 {ASPECT_RATIOS.map(ratio => (
                     <button
                        key={ratio}
                        onClick={() => onChange({ aspectRatio: ratio })}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all backdrop-blur-md ${
                            currentSettings.aspectRatio === ratio
                            ? 'bg-indigo-500/10 border-indigo-500/50 text-indigo-300 shadow-[0_0_10px_rgba(99,102,241,0.2)]'
                            : 'bg-white/5 border-white/5 text-slate-500 hover:bg-white/10 hover:border-white/10'
                        }`}
                     >
                        {ratio}
                     </button>
                 ))}
             </div>
        </div>

        {/* Full Body Toggle */}
        <div className="flex items-center justify-between bg-white/5 p-3 rounded-lg border border-white/5 backdrop-blur-sm hover:bg-white/10 transition-colors cursor-pointer" onClick={() => onChange({ isFullBody: !currentSettings.isFullBody })}>
            <div className="flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">Full Body Mode</span>
            </div>
            <div className={`relative inline-flex h-4 w-8 items-center rounded-full transition-colors border border-transparent ${
                    currentSettings.isFullBody ? 'bg-indigo-500/30 border-indigo-500/50' : 'bg-black/40 border-white/10'
                }`}>
                <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${
                    currentSettings.isFullBody ? 'translate-x-4' : 'translate-x-0.5'
                }`} />
            </div>
        </div>

        {/* Style */}
        <div>
            <label className="block text-[10px] text-slate-500 mb-2 font-medium uppercase tracking-widest">Art Style</label>
            <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
                {STYLE_OPTIONS.map((style) => (
                    <button
                        key={style}
                        onClick={() => onChange({ style })}
                        className={`px-3 py-2 text-xs rounded-lg transition-all text-left truncate backdrop-blur-sm border ${
                            currentSettings.style === style 
                            ? 'bg-indigo-500/10 text-indigo-200 border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.1)]' 
                            : 'bg-white/5 text-slate-400 border-white/5 hover:bg-white/10 hover:text-slate-200'
                        }`}
                    >
                        {style}
                    </button>
                ))}
            </div>
        </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full w-full max-w-5xl mx-auto relative">
      {/* Retry Modal */}
      {retryTargetIndex !== null && retrySettings && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in">
              <div className="bg-black/60 border border-white/10 rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-up backdrop-blur-2xl">
                  <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5">
                      <h3 className="font-medium text-slate-200 text-sm tracking-wider uppercase">Refine & Retry</h3>
                      <button onClick={() => setRetryTargetIndex(null)} className="text-slate-500 hover:text-white transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                      </button>
                  </div>
                  
                  <div className="p-6 space-y-6 max-h-[60vh] overflow-y-auto">
                      <div>
                          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2">Feedback Prompt</label>
                          <textarea
                              value={retryPrompt}
                              onChange={(e) => setRetryPrompt(e.target.value)}
                              placeholder="e.g. Fix the hands, make it brighter..."
                              className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-sm text-white placeholder-slate-600 focus:border-indigo-500/30 focus:ring-1 focus:ring-indigo-500/30 outline-none resize-none h-24 transition-all"
                          />
                      </div>
                      
                      <div className="pt-2">
                          <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Adjust Settings</h4>
                          {renderSettingsControls(retrySettings, (newS) => setRetrySettings(prev => ({ ...prev!, ...newS })))}
                      </div>
                  </div>

                  <div className="p-4 border-t border-white/5 bg-black/40 flex justify-end gap-3">
                      <button 
                          onClick={() => setRetryTargetIndex(null)}
                          className="px-4 py-2 text-xs font-medium text-slate-500 hover:text-white transition-colors uppercase tracking-wider"
                      >
                          Cancel
                      </button>
                      <button 
                          onClick={confirmRetry}
                          className="px-6 py-2 text-xs font-bold bg-white text-black hover:bg-slate-200 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.2)] transition-all active:scale-95 tracking-wider uppercase"
                      >
                          Regenerate
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto px-4 pt-4 md:px-6 md:pt-6 pb-96 space-y-8">
        
        {/* Empty State */}
        {messages.length === 0 && !isLoading && (
            <div className="h-full flex flex-col items-center justify-center opacity-30 pointer-events-none select-none pb-20">
                <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center shadow-2xl mb-6 border border-white/5">
                     <div className="h-12 w-12 bg-indigo-500 rounded-full blur-lg opacity-50 animate-pulse"></div>
                </div>
                <p className="text-sm text-slate-500 font-light tracking-[0.4em] uppercase">System Online</p>
            </div>
        )}

        {messages.map((msg, index) => {
            const isUser = msg.role === 'user';
            const displayImages = msg.images || (msg.image ? [msg.image] : []);
            
            if (!msg.text && displayImages.length === 0 && !msg.isError) return null;

            return (
                <div key={msg.id} className={`flex gap-5 ${isUser ? 'flex-row-reverse' : 'flex-row'} animate-fade-in-up`}>
                    {/* Avatar */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 backdrop-blur-sm border ${
                        isUser 
                        ? 'bg-white/5 border-white/10 text-slate-400' 
                        : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300 shadow-[0_0_15px_-5px_rgba(99,102,241,0.4)]'
                    }`}>
                         {isUser ? (
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                               <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                             </svg>
                         ) : (
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                               <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                             </svg>
                         )}
                    </div>

                    {/* Message Content */}
                    <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
                        <div className={`rounded-2xl px-5 py-4 backdrop-blur-md border ${
                            isUser 
                            ? 'bg-white/5 border-white/5 text-slate-200 rounded-tr-sm' 
                            : 'bg-black/40 border-white/5 text-slate-300 rounded-tl-sm shadow-lg'
                        } ${msg.isError ? 'border-red-500/20 bg-red-900/5 text-red-300' : ''}`}>
                            
                            {/* Images */}
                            {displayImages.length > 0 && (
                                <div className={`grid gap-3 ${displayImages.length > 1 ? 'grid-cols-2' : 'grid-cols-1'} ${msg.text ? 'mb-4' : ''}`}>
                                    {displayImages.map((img, idx) => (
                                        <div key={idx} className="overflow-hidden rounded-lg border border-white/10 bg-black/50 group relative cursor-pointer shadow-2xl transition-transform hover:scale-[1.01]" onClick={() => onImageClick(img)}>
                                            <img src={img} alt={`Content ${idx}`} className="max-w-full object-cover max-h-96 w-full" />
                                            <div className="absolute inset-0 bg-black/50 transition-opacity opacity-0 group-hover:opacity-100 flex items-center justify-center backdrop-blur-[2px]">
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white drop-shadow-md" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                                                </svg>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            {/* Text */}
                            {msg.text && <p className="whitespace-pre-wrap text-[15px] leading-relaxed font-light tracking-wide">{msg.text}</p>}
                        </div>
                        
                        {/* Actions */}
                        <div className={`flex items-center gap-3 mt-2 text-[10px] text-slate-600 font-medium uppercase tracking-widest ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                             {!msg.isError && msg.text && (
                               <button 
                                 onClick={() => copyToClipboard(msg.text!)}
                                 className="hover:text-white transition-colors flex items-center gap-1.5"
                               >
                                 COPY
                               </button>
                             )}
                             {!msg.isError && displayImages.length === 1 && (
                               <button 
                                 onClick={() => downloadImage(displayImages[0], `generated-${msg.id}.png`)}
                                 className="hover:text-white transition-colors flex items-center gap-1.5"
                               >
                                 DOWNLOAD
                               </button>
                             )}
                             
                             {/* Retry Button */}
                             {!isUser && index === messages.length - 1 && (
                                <button
                                    onClick={() => initiateRetry(index)}
                                    disabled={isLoading}
                                    className="hover:text-white transition-colors flex items-center gap-1.5 ml-2 group"
                                >
                                    RETRY
                                </button>
                             )}
                        </div>
                    </div>
                </div>
            );
        })}
        {isLoading && <LoadingBubble />}
        <div ref={messagesEndRef} />
      </div>

      {/* Floating Input Area */}
      <div className="absolute bottom-6 left-0 right-0 px-4 z-30 flex justify-center">
        <div className="w-full max-w-3xl relative group">
            
            {/* Settings Popover */}
            {showSettings && (
                <div 
                    ref={settingsRef}
                    className="absolute bottom-full left-0 mb-3 w-full sm:w-80 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl p-5 z-30 animate-fade-in-up"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-slate-200 text-xs uppercase tracking-widest">Parameters</h3>
                        <button onClick={() => setShowSettings(false)} className="text-slate-500 hover:text-white transition-colors">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>
                    </div>
                    
                    {renderSettingsControls(settings, updateSettings)}
                </div>
            )}

            {/* Pending Image Preview */}
            {pendingImages.length > 0 && (
                <div className="absolute bottom-full left-0 mb-3 w-full flex gap-2 overflow-x-auto pb-2 scrollbar-none px-2">
                    {pendingImages.map((img, idx) => (
                         <div key={idx} className="shrink-0 p-1 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl relative group animate-scale-up shadow-2xl">
                            <div className="relative rounded-lg overflow-hidden cursor-pointer" onClick={() => onImageClick(img.dataUrl!)}>
                                <img src={img.dataUrl!} alt="Pending" className="h-16 w-auto object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <button 
                                onClick={() => handleRemovePendingImage(idx)}
                                className="absolute -top-1.5 -right-1.5 bg-red-500/80 text-white rounded-full p-0.5 shadow-md hover:bg-red-600 transition-colors z-10"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-2.5 w-2.5" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                </svg>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Glass Input Container */}
            <div className="relative bg-black/40 backdrop-blur-xl rounded-[2rem] border border-white/5 shadow-2xl transition-all duration-500 group-focus-within:bg-black/60 group-focus-within:shadow-[0_0_30px_-5px_rgba(99,102,241,0.3)]">
                
                {/* Toolbar */}
                <div className="flex items-center justify-between px-3 pt-2">
                    <div className="flex items-center gap-1">
                         {/* Upload */}
                        <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-full text-slate-500 hover:text-white hover:bg-white/5 transition-all" title="Upload Image">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                        </button>

                        {/* Settings Toggle */}
                        <button onClick={() => setShowSettings(!showSettings)} className={`p-2 rounded-full transition-all ${showSettings ? 'text-white bg-white/10' : 'text-slate-500 hover:text-white hover:bg-white/5'}`} title="Settings">
                             <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                            </svg>
                        </button>

                        {/* Enhance */}
                        <button 
                            onClick={handleEnhancePrompt}
                            disabled={!inputValue.trim() || isEnhancing}
                            className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-medium uppercase tracking-widest transition-all border border-transparent ${inputValue.trim() && !isEnhancing ? 'text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20' : 'text-slate-700 cursor-not-allowed'}`}
                        >
                             {isEnhancing ? <div className="h-3 w-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div> : (
                                 <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 5a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1V8a1 1 0 011-1zm5-5a1 1 0 011 1v1h1a1 1 0 110 2h-1v1a1 1 0 11-2 0V6h-1a1 1 0 110-2h1V3a1 1 0 011-1z" clipRule="evenodd" />
                                </svg>
                             )}
                             Enhance
                        </button>
                    </div>
                </div>

                <div className="flex items-end pl-2 pr-2 pb-2">
                    <textarea
                        ref={textareaRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSendMessage();
                            }
                        }}
                        placeholder={pendingImages.length > 0 ? "Describe changes..." : "Describe image changes..."}
                        className="w-full bg-transparent border-none focus:ring-0 focus:outline-none outline-none shadow-none text-slate-200 placeholder-slate-600 py-3 pl-2 pr-4 resize-none overflow-hidden max-h-[200px] leading-relaxed"
                        rows={1}
                    />
                    
                     {/* Send Button */}
                    <div className="pb-1">
                        <button
                            onClick={handleSendMessage}
                            // Allow send if there's input text OR pending images. 
                            // (If only text, it tries text-to-image or history edit)
                            disabled={isLoading || (!inputValue.trim() && pendingImages.length === 0)}
                            className={`p-2.5 rounded-full transition-all flex items-center justify-center ${
                               isLoading || (!inputValue.trim() && pendingImages.length === 0)
                                 ? 'bg-white/5 text-slate-700 cursor-not-allowed'
                                 : 'bg-white text-black hover:scale-110 active:scale-95 shadow-[0_0_20px_rgba(255,255,255,0.3)]'
                            }`}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                            </svg>
                        </button>
                    </div>
                </div>
            </div>
            
            <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileUpload}
                className="hidden" 
                accept="image/*" 
                multiple
            />
        </div>
      </div>
    </div>
  );
};