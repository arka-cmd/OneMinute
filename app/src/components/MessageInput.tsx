import { useState, useRef } from 'react';

interface MessageInputProps {
  onSendMessage: (text: string, fileInfo?: { fileUrl: string; fileName: string }) => void;
  onUploadFile: (file: File) => Promise<{ fileUrl: string; fileName: string } | null>;
  isConnected: boolean;
  isUploading: boolean;
}

function MessageInput({ onSendMessage, onUploadFile, isConnected, isUploading }: MessageInputProps) {
  const [text, setText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!text.trim() && !selectedFile) return;

    let fileInfo: { fileUrl: string; fileName: string } | undefined;

    // Upload file if selected
    if (selectedFile) {
      const result = await onUploadFile(selectedFile);
      if (!result) return; // Upload failed
      fileInfo = result;
    }

    // Send message
    onSendMessage(text.trim(), fileInfo);

    // Reset form
    setText('');
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const validateAndSetFile = (file: File) => {
    if (file.size > MAX_FILE_SIZE) {
      alert('File too large. Maximum size is 1 MB.');
      return;
    }
    setSelectedFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files?.[0];
    if (file) {
      validateAndSetFile(file);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      {/* Selected file preview */}
      {selectedFile && (
        <div className="flex items-center gap-2 bg-cyan-500/20 border border-cyan-500/30 rounded-lg p-2">
          <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          <span className="text-sm text-cyan-200 flex-1 truncate">
            {selectedFile.name}
          </span>
          <span className="text-xs text-cyan-300/60">
            {formatFileSize(selectedFile.size)}
          </span>
          <button
            type="button"
            onClick={() => {
              setSelectedFile(null);
              if (fileInputRef.current) {
                fileInputRef.current.value = '';
              }
            }}
            className="text-cyan-300/60 hover:text-cyan-200 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}

      {/* Input area */}
      <div
        className={`flex items-end gap-2 bg-white/10 backdrop-blur-sm rounded-lg p-2 transition-all ${
          isDragging ? 'ring-2 ring-cyan-400 bg-cyan-500/20' : ''
        } ${!isConnected ? 'opacity-60' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Text input */}
        <textarea
          ref={textInputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isConnected ? 'Type a message...' : 'Connecting...'}
          disabled={!isConnected || isUploading}
          rows={1}
          className="flex-1 bg-transparent text-white placeholder-white/40 resize-none outline-none min-h-[40px] max-h-[120px] py-2 px-2"
          style={{ height: 'auto' }}
          onInput={(e) => {
            const target = e.target as HTMLTextAreaElement;
            target.style.height = 'auto';
            target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
          }}
        />

        {/* File attachment button */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          disabled={!isConnected || isUploading || selectedFile !== null}
          className="hidden"
          id="file-input"
        />
        <label
          htmlFor="file-input"
          className={`p-2 rounded-lg transition-colors cursor-pointer ${
            !isConnected || isUploading || selectedFile !== null
              ? 'text-white/20 cursor-not-allowed'
              : 'text-white/50 hover:text-white/80 hover:bg-white/10'
          }`}
          title="Attach file (max 1 MB)"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </label>

        {/* Send button */}
        <button
          type="submit"
          disabled={(!text.trim() && !selectedFile) || !isConnected || isUploading}
          className={`p-2 rounded-lg transition-all ${
            (!text.trim() && !selectedFile) || !isConnected || isUploading
              ? 'bg-white/10 text-white/30 cursor-not-allowed'
              : 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:from-cyan-400 hover:to-blue-500 shadow-lg hover:shadow-cyan-500/25'
          }`}
        >
          {isUploading ? (
            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>

      {/* Hint */}
      <p className="text-xs text-white/30 text-center">
        Press Enter to send, Shift+Enter for new line • Drag & drop files here
      </p>
    </form>
  );
}

export default MessageInput;
