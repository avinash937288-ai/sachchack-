
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { Message, Language, Verdict } from './types';
import { geminiService } from './services/geminiService';
import MessageBubble from './components/MessageBubble';
import LanguageSelector from './components/LanguageSelector';

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

const UI_STRINGS = {
  [Language.HINDI]: {
    welcome: 'सत्यापन हब में आपका स्वागत है। 👋\n\nमैं राजनीतिक दावों और संदेशों की वास्तविक समय में पुष्टि कर सकता हूँ। शुरू करने के लिए कोई लिंक साझा करें, फोटो अपलोड करें या बोलकर पूछें।',
    hubTitle: 'सत्यापन केंद्र',
    protocol: 'ग्राउंडिंग प्रोटोकॉल v4',
    inputPlaceholder: 'लिंक टाइप करें या दावे का वर्णन करें...',
    inputPlaceholderRecording: 'ध्यान से सुन रहा हूँ...',
    verifyBtn: 'जांचें',
    searching: 'खोज रहा हूँ...',
    analyzing: 'विश्लेषण...',
    checking: 'जांच...',
    systemStatus: 'सक्रिय',
    navMain: 'नेविगेशन',
    navLive: 'लाइव चेकर',
    navNetwork: 'नेटवर्क',
    navAnalytics: 'एनालिटिक्स',
    localNews: 'उरुवा न्यूज़',
    fetchingNews: 'आज की ताज़ा खबरें ला रहा हूँ...',
    sourcesHeader: 'सत्यापन के स्रोत',
    readFull: 'पूरी खबर पढ़ें',
    errorRateLimit: 'सर्वर अभी व्यस्त है, कृपया थोड़ा रुकें।',
    errorNetwork: 'इंटरनेट कनेक्शन नहीं है।',
    errorGeneric: 'माफ़ करें, अभी जांच नहीं हो पाई।',
    copied: 'कॉपी हो गया!'
  },
  [Language.ENGLISH]: {
    welcome: 'Welcome to the SachCheck Intelligence Hub. 👋\n\nI can verify political claims, media forwards, and news reports in real-time. Share a link, upload a screenshot, or use voice input to begin.',
    hubTitle: 'Verification Hub',
    protocol: 'Grounding Protocol v4',
    inputPlaceholder: 'Type link or claim...',
    inputPlaceholderRecording: 'Listening...',
    verifyBtn: 'Verify',
    searching: 'Searching...',
    analyzing: 'Analyzing...',
    checking: 'Checking...',
    systemStatus: 'Active',
    navMain: 'Navigation',
    navLive: 'Live Checker',
    navNetwork: 'Network',
    navAnalytics: 'Analytics',
    localNews: 'Uruwa News',
    fetchingNews: 'Fetching today\'s updates...',
    sourcesHeader: 'Verification Sources',
    readFull: 'Read Full News',
    errorRateLimit: 'Server is busy, please try again in a moment.',
    errorNetwork: 'No internet connection.',
    errorGeneric: 'Something went wrong. Please try again.',
    copied: 'Copied to clipboard!'
  },
  [Language.BHOJPURI]: {
    welcome: 'सत्यापन हब में रउवा सब के स्वागत बा। 👋\n\nहम राजनीतिक दावा आउर संदेश के सही जानकारी तुरंत दे सकेनी। शुरू करे खातिर कौनों लिंक भेजीं, फोटो अपलोड करीं भा बोल के पूछीं।',
    hubTitle: 'जांच केंद्र',
    protocol: 'ग्राउंडिंग प्रोटोकॉल v4',
    inputPlaceholder: 'लिंक लिखीं भा बात बताईं...',
    inputPlaceholderRecording: 'सुनत बानी...',
    verifyBtn: 'जांचीं',
    searching: 'खोजत बानी...',
    analyzing: 'परखत बानी...',
    checking: 'जांच हो रहल बा...',
    systemStatus: 'चालू बा',
    navMain: 'नेविगेशन',
    navLive: 'लाइव जांच',
    navNetwork: 'नेटवर्क',
    navAnalytics: 'एनालिटिक्स',
    localNews: 'उरुवा न्यूज़',
    fetchingNews: 'आज के ताज़ा खबर आवत बा...',
    sourcesHeader: 'जांच के स्रोत',
    readFull: 'पूरा खबर पढ़ीं',
    errorRateLimit: 'सर्वर अभी व्यस्त बा, थोड़ा देरी बाद कोशिश करीं।',
    errorNetwork: 'इंटरनेट कनेक्शन नइखे।',
    errorGeneric: 'माफ़ करीं, अभी जांच ना हो पावल।',
    copied: 'कॉपी हो गईल!'
  }
};

const App: React.FC = () => {
  const [currentLanguage, setCurrentLanguage] = useState<Language>(Language.HINDI);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  
  // Audio Playback State
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [isAudioPaused, setIsAudioPaused] = useState(false);
  const [playbackProgress, setPlaybackProgress] = useState(0);

  const [processingStatus, setProcessingStatus] = useState<'Searching' | 'Analyzing' | 'Checking'>('Checking');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  
  // Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const currentAudioBufferRef = useRef<AudioBuffer | null>(null);
  const playbackStartTimeRef = useRef<number>(0);
  const playbackOffsetRef = useRef<number>(0);
  const progressIntervalRef = useRef<number | null>(null);

  const t = UI_STRINGS[currentLanguage];

  useEffect(() => {
    setMessages(prev => {
      if (prev.length === 0 || (prev.length === 1 && prev[0].id === 'welcome')) {
        return [{ id: 'welcome', sender: 'bot', text: t.welcome, timestamp: new Date() }];
      }
      return prev;
    });
  }, [currentLanguage, t.welcome]);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      const scrollHeight = scrollRef.current.scrollHeight;
      const height = scrollRef.current.clientHeight;
      const maxScrollTop = scrollHeight - height;
      scrollRef.current.scrollTo({
        top: maxScrollTop > 0 ? maxScrollTop : 0,
        behavior: 'smooth'
      });
    }
  }, []);

  useEffect(() => {
    const timeoutId = setTimeout(scrollToBottom, 50);
    return () => clearTimeout(timeoutId);
  }, [messages, processingStatus, scrollToBottom]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.onresult = (e: any) => {
        const transcript = e.results[0][0].transcript;
        setInputText(prev => prev ? `${prev} ${transcript}` : transcript);
        setIsRecording(false);
      };
      recognition.onerror = () => setIsRecording(false);
      recognition.onend = () => setIsRecording(false);
      recognitionRef.current = recognition;
    }
  }, []);

  useEffect(() => {
    if (recognitionRef.current) {
      recognitionRef.current.lang = currentLanguage === Language.ENGLISH ? 'en-IN' : 'hi-IN';
    }
  }, [currentLanguage]);

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      try {
        recognitionRef.current?.start();
        setIsRecording(true);
      } catch (e) { console.error(e); }
    }
  }, [isRecording]);

  const stopAudio = useCallback(() => {
    if (currentAudioSourceRef.current) {
      try { currentAudioSourceRef.current.stop(); } catch (e) {}
      currentAudioSourceRef.current = null;
    }
    if (progressIntervalRef.current) {
      window.clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setPlayingMessageId(null);
    setIsAudioPaused(false);
    setPlaybackProgress(0);
    playbackOffsetRef.current = 0;
  }, []);

  const playFromOffset = useCallback((buffer: AudioBuffer, offset: number) => {
    if (!audioContextRef.current) return;
    const ctx = audioContextRef.current;

    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    
    playbackStartTimeRef.current = ctx.currentTime - offset;
    source.start(0, offset);
    currentAudioSourceRef.current = source;

    source.onended = () => {
      // If we didn't pause it, then it finished naturally
      if (ctx.currentTime - playbackStartTimeRef.current >= buffer.duration - 0.1) {
        stopAudio();
      }
    };

    if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = window.setInterval(() => {
      const elapsed = ctx.currentTime - playbackStartTimeRef.current;
      const progress = (elapsed / buffer.duration) * 100;
      setPlaybackProgress(Math.min(progress, 100));
    }, 100);
  }, [stopAudio]);

  const handleFetchNews = async () => {
    if (isProcessing) return;
    const todayStr = new Date().toLocaleDateString();
    const botId = `news-${Date.now()}`;
    const botMsg: Message = { 
      id: botId, 
      sender: 'bot', 
      text: `📰 **Uruwa Bazar Daily Digest (${todayStr})**`, 
      timestamp: new Date(), 
      isPending: true,
      explanation: t.fetchingNews
    };
    setMessages(prev => [...prev, botMsg]);
    setIsProcessing(true);
    setProcessingStatus('Searching');

    try {
      const result = await geminiService.fetchDailyNews("Uruwa Bazar, Gorakhpur", currentLanguage);
      setMessages(prev => prev.map(m => m.id === botId ? { ...m, ...result, isPending: false } : m));
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === botId ? { 
        ...m, 
        isPending: false, 
        explanation: t.errorGeneric 
      } : m));
    } finally {
      setIsProcessing(false);
      setIsSidebarOpen(false);
    }
  };

  const handleFactCheck = async (text: string, image?: string) => {
    if (isProcessing || (!text && !image)) return;
    const userMsg: Message = { id: `u-${Date.now()}`, sender: 'user', text, image, timestamp: new Date() };
    const botId = `b-${Date.now()}`;
    const botMsg: Message = { id: botId, sender: 'bot', timestamp: new Date(), isPending: true };
    setMessages(prev => [...prev, userMsg, botMsg]);
    setIsProcessing(true);
    setProcessingStatus('Searching');
    
    try {
      const result = await geminiService.factCheck(text || "Media Check", image, currentLanguage);
      
      if (result.error) {
        let localizedMsg = t.errorGeneric;
        if (result.error.code === 'RATE_LIMIT') localizedMsg = t.errorRateLimit;
        if (result.error.code === 'NETWORK_ERROR') localizedMsg = t.errorNetwork;
        result.explanation = localizedMsg;
      }

      setMessages(prev => prev.map(m => m.id === botId ? { ...m, ...result, isPending: false } : m));
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === botId ? { 
        ...m, 
        isPending: false, 
        error: { code: 'UNKNOWN', message: t.errorGeneric },
        explanation: t.errorGeneric 
      } : m));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      handleFactCheck('', base64);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSend = () => {
    if (!inputText.trim() || isProcessing) return;
    const text = inputText;
    setInputText('');
    handleFactCheck(text);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const handleCopy = (text: string) => {
    const cleanText = text.replace(/[*_#]/g, '');
    navigator.clipboard.writeText(cleanText).then(() => {
      showToast(t.copied);
    });
  };

  const handleAudioPlayback = async (messageId: string, text: string) => {
    // If clicking on already playing message
    if (playingMessageId === messageId) {
      if (isAudioPaused) {
        // Resume
        setIsAudioPaused(false);
        if (currentAudioBufferRef.current) {
          playFromOffset(currentAudioBufferRef.current, playbackOffsetRef.current);
        }
      } else {
        // Pause
        if (currentAudioSourceRef.current) {
          try { currentAudioSourceRef.current.stop(); } catch (e) {}
        }
        if (progressIntervalRef.current) window.clearInterval(progressIntervalRef.current);
        
        if (audioContextRef.current) {
          playbackOffsetRef.current = audioContextRef.current.currentTime - playbackStartTimeRef.current;
        }
        setIsAudioPaused(true);
      }
      return;
    }

    // New message playback
    stopAudio();
    setPlayingMessageId(messageId);
    
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === 'suspended') await ctx.resume();

    try {
      const data = await geminiService.generateSpeech(text, currentLanguage);
      if (!data) throw new Error('No audio data');
      
      const buffer = await geminiService.decodeAudioData(data, ctx);
      currentAudioBufferRef.current = buffer;
      playFromOffset(buffer, 0);
    } catch (e) {
      console.warn('Audio playback failed', e);
      stopAudio();
    }
  };

  const currentStatusText = useMemo(() => {
    if (processingStatus === 'Searching') return t.searching;
    if (processingStatus === 'Analyzing') return t.analyzing;
    return t.checking;
  }, [processingStatus, t]);

  return (
    <div className="flex h-screen w-full bg-[#f8fafc] text-slate-900 overflow-hidden selection:bg-indigo-100">
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-950 text-white transition-all duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
        <div className="flex flex-col h-full p-6">
          <div className="flex items-center gap-4 mb-10">
            <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center font-black text-2xl shadow-xl shadow-indigo-500/20 rotate-3">S</div>
            <h2 className="text-xl font-black">SachCheck</h2>
          </div>
          <nav className="space-y-2 flex-1">
            <p className="px-4 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3">{t.navMain}</p>
            <button className="w-full flex items-center gap-3 px-4 py-3 bg-white/10 rounded-2xl text-sm font-bold border border-white/10 active:scale-95 transition-all mb-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
              {t.navLive}
            </button>
            <button 
              onClick={handleFetchNews}
              disabled={isProcessing}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold border active:scale-95 transition-all ${isProcessing ? 'opacity-50' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20'}`}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10l4 4v10a2 2 0 01-2 2z"/><path d="M14 2v4h4"/><path d="M7 8h5"/><path d="M7 12h10"/><path d="M7 16h10"/></svg>
              {t.localNews}
              <span className="ml-auto text-[10px] bg-emerald-500 text-white px-1.5 py-0.5 rounded-md animate-pulse">LIVE</span>
            </button>
          </nav>
          <div className="mt-auto pt-6 border-t border-white/5 space-y-4">
             <div className="bg-indigo-600 p-4 rounded-2xl shadow-lg border border-white/10">
                <span className="text-lg font-black block">99.8%</span>
                <span className="text-[10px] uppercase font-bold text-indigo-200">System Accuracy</span>
             </div>
             <div className="flex items-center justify-between px-2 opacity-50">
               <span className="text-[10px] font-black uppercase">{t.systemStatus}</span>
               <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
             </div>
          </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 bg-white shadow-inner">
        <header className="h-20 glass flex items-center justify-between px-4 sm:px-8 border-b border-slate-100 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(!isSidebarOpen)} className="lg:hidden p-3 bg-slate-50 rounded-xl border active:scale-90 transition-all">
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
            </button>
            <div>
              <h2 className="font-black text-xl sm:text-2xl tracking-tight">{t.hubTitle}</h2>
              <span className="text-[9px] font-black text-indigo-500 uppercase tracking-widest">{t.protocol}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
             <button onClick={handleFetchNews} className="hidden sm:flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 text-xs font-black uppercase tracking-wider hover:bg-emerald-100 transition-all">
               <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></span>
               {t.localNews}
             </button>
             <div className="w-10 h-10 sm:w-11 sm:h-11 bg-slate-100 rounded-2xl border-2 border-slate-100 overflow-hidden">
               <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=Admin" alt="User" />
             </div>
          </div>
        </header>

        <div className="flex-1 flex flex-col bg-slate-50/20 relative overflow-hidden">
          <div className="sticky top-0 z-30 glass border-b border-slate-100">
            <LanguageSelector currentLanguage={currentLanguage} onLanguageChange={setCurrentLanguage} />
          </div>
          
          <div className="flex-1 overflow-y-auto px-4 sm:px-12 py-6 space-y-4 no-scrollbar scroll-smooth-container" ref={scrollRef}>
            {messages.map((m) => (
              <MessageBubble 
                key={m.id} 
                message={{...m, explanation: m.isPending ? (m.explanation || currentStatusText) : m.explanation}} 
                onPlayAudio={(text) => handleAudioPlayback(m.id, text)} 
                onCopy={handleCopy}
                isAudioPlaying={playingMessageId === m.id}
                isAudioPaused={playingMessageId === m.id && isAudioPaused}
                audioProgress={playingMessageId === m.id ? playbackProgress : 0}
                labels={{
                  sourcesHeader: t.sourcesHeader,
                  readFull: t.readFull
                }}
              />
            ))}
          </div>

          {toast && (
            <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50 animate-slide-up">
              <div className="toast-pill bg-slate-900 text-white px-6 py-3 rounded-full text-sm font-black shadow-2xl flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"/></svg>
                {toast}
              </div>
            </div>
          )}

          <div className="p-4 sm:p-10 bg-gradient-to-t from-white via-white/80 to-transparent z-20">
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-[1.5rem] sm:rounded-[2.5rem] shadow-2xl border border-slate-200 p-1.5 sm:p-2.5 transition-all focus-within:ring-[4px] focus-within:ring-indigo-100">
                <div className="flex items-end gap-1 sm:gap-2">
                  <div className="flex shrink-0 p-1 gap-1">
                    <button onClick={() => fileInputRef.current?.click()} className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl active:scale-90 transition-all">
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleImageUpload} />
                    </button>
                    <button onClick={() => cameraInputRef.current?.click()} className="p-3 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-2xl active:scale-90 transition-all">
                      <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                      <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleImageUpload} />
                    </button>
                  </div>
                  <div className="flex-1 pb-1">
                    <textarea
                      value={inputText}
                      onChange={(e) => setInputText(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSend())}
                      placeholder={isRecording ? t.inputPlaceholderRecording : t.inputPlaceholder}
                      rows={1}
                      disabled={isProcessing}
                      className="w-full bg-transparent outline-none text-[16px] font-semibold py-3.5 px-3 resize-none max-h-40 border-none focus:ring-0 placeholder:text-slate-400"
                    />
                  </div>
                  <div className="flex items-center gap-1 sm:gap-2 p-1">
                    {window.webkitSpeechRecognition && (
                      <button onClick={toggleRecording} className={`p-3.5 rounded-2xl active:scale-90 transition-all shadow-md ${isRecording ? 'text-white bg-indigo-600 animate-pulse' : 'text-slate-400 bg-slate-50'}`}>
                        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="3"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/></svg>
                      </button>
                    )}
                    <button onClick={handleSend} disabled={!inputText.trim() || isProcessing} className={`h-12 px-6 sm:px-8 rounded-2xl font-black text-xs sm:text-sm tracking-wider uppercase active:scale-95 transition-all ${inputText.trim() && !isProcessing ? 'bg-slate-900 text-white shadow-xl' : 'bg-slate-100 text-slate-300'}`}>
                      <span className="hidden sm:inline">{t.verifyBtn}</span>
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" className="sm:ml-2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
      {isSidebarOpen && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 lg:hidden" onClick={() => setIsSidebarOpen(false)} />}
    </div>
  );
};

export default App;
