
import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Message, Verdict } from '../types';

interface MessageBubbleProps {
  message: Message;
  onPlayAudio?: (text: string) => void;
  onCopy?: (text: string) => void;
  isAudioPlaying?: boolean;
  isAudioPaused?: boolean;
  audioProgress?: number;
  labels?: {
    sourcesHeader: string;
    readFull: string;
  };
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ 
  message, 
  onPlayAudio, 
  onCopy, 
  isAudioPlaying, 
  isAudioPaused,
  audioProgress = 0,
  labels 
}) => {
  const isBot = message.sender === 'bot';
  const [isLocalLoading, setIsLocalLoading] = useState(false);

  const getVerdictStyles = (verdict?: Verdict) => {
    switch (verdict) {
      case Verdict.TRUE: return 'bg-emerald-50 text-emerald-900 border-emerald-200 ring-emerald-500/10';
      case Verdict.FALSE: return 'bg-rose-50 text-rose-900 border-rose-200 ring-rose-500/10';
      case Verdict.MISLEADING: return 'bg-amber-50 text-amber-900 border-amber-200 ring-amber-500/10';
      default: return 'bg-slate-50 text-slate-800 border-slate-100 ring-slate-500/10';
    }
  };

  const handlePlayClick = async () => {
    const textToPlay = message.explanation || message.text;
    if (onPlayAudio && textToPlay) {
      // If already playing or paused, we don't need "loading" spinner again (it's handled by app state)
      if (!isAudioPlaying) setIsLocalLoading(true);
      try {
        await onPlayAudio(textToPlay);
      } finally {
        setIsLocalLoading(false);
      }
    }
  };

  const handleCopyClick = () => {
    const textToCopy = message.explanation || message.text;
    if (onCopy && textToCopy) {
      onCopy(textToCopy);
    }
  };

  return (
    <div className={`flex w-full mb-6 ${isBot ? 'justify-start' : 'justify-end animate-in fade-in slide-in-from-bottom-2 duration-300'}`}>
      <div
        className={`relative max-w-[94%] sm:max-w-[85%] rounded-[2rem] p-1 shadow-sm border transition-all duration-300 ${
          isBot 
            ? 'bg-white text-slate-800 border-slate-200 rounded-bl-none hover:shadow-md' 
            : 'bg-indigo-600 text-white border-indigo-500 rounded-br-none hover:shadow-lg hover:shadow-indigo-200'
        }`}
      >
        <div className="p-4 sm:p-5">
          {message.image && (
            <div className="overflow-hidden rounded-2xl border border-slate-100 mb-4 bg-slate-50">
              <img src={message.image} alt="Verification payload" className="w-full max-h-80 object-contain mx-auto" />
            </div>
          )}
          
          <div className="flex justify-between items-start gap-3">
            <div className={`whitespace-pre-wrap flex-1 text-[15px] sm:text-[16px] leading-relaxed font-semibold ${!isBot ? 'text-indigo-50' : 'text-slate-800'}`}>
              {message.text}
            </div>
            {isBot && !message.verdict && !message.isPending && !message.error && (
              <div className="flex gap-1 shrink-0">
                <button 
                  onClick={handleCopyClick}
                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all"
                  aria-label="Copy text"
                >
                  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/></svg>
                </button>
                <button 
                  onClick={handlePlayClick}
                  disabled={isLocalLoading}
                  className={`p-2 rounded-xl transition-all ${isAudioPlaying && !isAudioPaused ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                  aria-label={isAudioPlaying && !isAudioPaused ? "Pause" : "Play"}
                >
                  {isLocalLoading ? (
                    <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                  ) : isAudioPlaying && !isAudioPaused ? (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 1v22M17 5v14M2 9v6M22 9v6M7 7v10"/></svg>
                  )}
                </button>
              </div>
            )}
          </div>
          {isBot && !message.verdict && isAudioPlaying && (
             <div className="mt-2 w-full h-1 bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-indigo-500 transition-all duration-300 ease-linear" 
                  style={{ width: `${audioProgress}%` }}
                />
             </div>
          )}
        </div>

        {isBot && message.error && !message.isPending && (
          <div className="mx-2 mb-2 p-4 rounded-2xl bg-rose-50 border border-rose-100 text-rose-800 shadow-sm animate-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-4 h-4 text-rose-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span className="text-[10px] font-black uppercase tracking-widest">{message.error.code}</span>
            </div>
            <p className="text-[14px] font-bold opacity-80">{message.explanation}</p>
          </div>
        )}

        {isBot && message.verdict && !message.isPending && !message.error && (
          <div className={`mx-2 mb-2 p-5 rounded-[1.8rem] border shadow-sm ring-1 animate-in slide-in-from-top-2 duration-500 ${getVerdictStyles(message.verdict)}`}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white rounded-xl shadow-sm border border-black/5">
                  {message.verdict === Verdict.TRUE ? (
                    <svg className="w-5 h-5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : message.verdict === Verdict.FALSE ? (
                    <svg className="w-5 h-5 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                </div>
                <span className="font-black text-[14px] uppercase tracking-wider">{message.verdict}</span>
              </div>
              <div className="flex gap-1.5">
                <button 
                  onClick={handleCopyClick}
                  className="p-2 rounded-xl bg-white/70 hover:bg-white transition-all shadow-sm border border-black/5 text-slate-600"
                  aria-label="Copy result"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                </button>
                <button 
                  onClick={handlePlayClick}
                  disabled={isLocalLoading}
                  className={`p-2 rounded-xl transition-all shadow-sm border border-black/5 ${isAudioPlaying && !isAudioPaused ? 'bg-indigo-600 text-white' : 'bg-white/70 text-slate-600 hover:bg-white'}`}
                  aria-label={isAudioPlaying && !isAudioPaused ? "Pause" : "Play audio"}
                >
                  {isLocalLoading ? (
                    <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
                  ) : isAudioPlaying && !isAudioPaused ? (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><rect x="4" y="4" width="6" height="16"/><rect x="14" y="4" width="6" height="16"/></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>
                  )}
                </button>
              </div>
            </div>
            
            <div className="prose max-w-none text-slate-900 mb-4">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {message.explanation || ''}
              </ReactMarkdown>
            </div>

            {isAudioPlaying && (
              <div className="mb-4 w-full h-1.5 bg-black/5 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-slate-900 transition-all duration-300 ease-linear" 
                  style={{ width: `${audioProgress}%` }}
                />
              </div>
            )}
            
            {message.sources && message.sources.length > 0 && (
              <div className="pt-3 border-t border-black/10">
                <div className="flex flex-wrap gap-2">
                  {message.sources.map((source, idx) => (
                    <a
                      key={idx}
                      href={source.uri}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-white/80 hover:bg-white px-3 py-1.5 rounded-xl border border-black/5 text-[11px] font-black text-indigo-700 transition-all active:scale-95 shadow-sm"
                    >
                      <span className="max-w-[140px] truncate">{source.title}</span>
                      <svg className="w-3.5 h-3.5 opacity-60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {message.isPending && (
          <div className="mx-2 mb-2 p-4 rounded-2xl bg-slate-50 border border-slate-100 flex items-center gap-4">
            <div className="flex gap-1.5">
              <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse"></div>
              <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse [animation-delay:0.2s]"></div>
              <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse [animation-delay:0.4s]"></div>
            </div>
            <span className="text-[11px] font-black text-indigo-600/70 uppercase tracking-widest">
              {message.explanation || 'Processing...'}
            </span>
          </div>
        )}

        <div className={`px-5 pb-2.5 flex ${isBot ? 'justify-start' : 'justify-end'} items-center gap-2 opacity-30 text-[9px] font-black uppercase tracking-wider`}>
          <span>{message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          {!isBot && (
            <svg className="w-3 h-3 text-indigo-200" fill="currentColor" viewBox="0 0 24 24"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
          )}
        </div>
      </div>
    </div>
  );
};

export default MessageBubble;
