import { Message } from '../types';

interface ChatMessageProps {
  message: Message;
  formatRemainingTime: (ms: number) => string;
  isNew?: boolean;
}

function ChatMessage({ message, formatRemainingTime, isNew }: ChatMessageProps) {
  const hasAttachment = message.fileUrl && message.fileName;
  const remainingTime = message.remainingTime || 0;

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    }
    if (['mp4', 'webm', 'mov', 'avi'].includes(ext || '')) {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    }
    if (['mp3', 'wav', 'ogg', 'm4a'].includes(ext || '')) {
      return (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
        </svg>
      );
    }
    return (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

  return (
    <div
      className={`animate-fadeIn ${isNew ? 'animate-slideIn' : ''}`}
    >
      <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 hover:bg-white/15 transition-colors">
        {/* Message text */}
        {message.text && (
          <p className="text-white/90 whitespace-pre-wrap break-words mb-2">
            {message.text}
          </p>
        )}

        {/* File attachment */}
        {hasAttachment && (
          <a
            href={`https://oneminute-chat.onrender.com${message.fileUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-lg p-2 mb-2 transition-colors group"
          >
            <div className="text-cyan-400 group-hover:text-cyan-300">
              {getFileIcon(message.fileName!)}
            </div>
            <span className="text-sm text-white/80 truncate flex-1">
              {message.fileName}
            </span>
            <svg 
              className="w-4 h-4 text-white/40 group-hover:text-white/60" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </a>
        )}

        {/* Footer with timestamp and countdown */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-white/40">
            {new Date(message.timestamp).toLocaleTimeString()}
          </span>
          <div className="flex items-center gap-1 text-orange-300/80">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-mono">{formatRemainingTime(remainingTime)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ChatMessage;
