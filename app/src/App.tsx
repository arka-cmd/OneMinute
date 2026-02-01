import { useState, useEffect, useRef, useCallback } from 'react';
import ChatMessage from './components/ChatMessage';
import MessageInput from './components/MessageInput';
import ConnectionStatus from './components/ConnectionStatus';
import { Message, WebSocketMessage } from './types';

// WebSocket server URL - configured for Render deployment
const WS_URL = 'wss://oneminute-chat.onrender.com';
const HTTP_URL = 'https://oneminute-chat.onrender.com';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Format remaining time
  const formatRemainingTime = (ms: number): string => {
    const seconds = Math.ceil(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Connect to WebSocket
  const connect = useCallback(() => {
    try {
      // Close existing connection
      if (wsRef.current) {
        wsRef.current.close();
      }

      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('Connected to server');
        setIsConnected(true);
        setConnectionError(null);

        // Start ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
        }
        pingIntervalRef.current = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping' }));
          }
        }, 30000);
      };

      ws.onmessage = (event) => {
        try {
          const data: WebSocketMessage = JSON.parse(event.data);

          switch (data.type) {
            case 'init':
              setMessages(data.messages || []);
              break;

            case 'new_message':
              if (data.message) {
                setMessages((prev) => {
                  // Avoid duplicates
                  if (prev.some((m) => m.id === data.message!.id)) {
                    return prev;
                  }
                  return [...prev, data.message!];
                });
              }
              break;

            case 'error':
              console.error('Server error:', data.message);
              alert(data.message || 'An error occurred');
              break;

            case 'pong':
              // Ping-pong successful
              break;
          }
        } catch (error) {
          console.error('Error parsing message:', error);
        }
      };

      ws.onclose = () => {
        console.log('Disconnected from server');
        setIsConnected(false);

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current);
          pingIntervalRef.current = null;
        }

        // Attempt to reconnect after 3 seconds
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log('Attempting to reconnect...');
          connect();
        }, 3000);
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        setConnectionError('Connection error. Retrying...');
      };
    } catch (error) {
      console.error('Error creating WebSocket:', error);
      setConnectionError('Failed to connect. Retrying...');
    }
  }, []);

  // Initial connection
  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [connect]);

  // Update remaining times every second
  useEffect(() => {
    const interval = setInterval(() => {
      setMessages((prev) =>
        prev
          .map((msg) => ({
            ...msg,
            remainingTime: msg.remainingTime ? msg.remainingTime - 1000 : 0,
          }))
          .filter((msg) => msg.remainingTime && msg.remainingTime > 0)
      );
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Send message
  const sendMessage = (text: string, fileInfo?: { fileUrl: string; fileName: string }) => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      alert('Not connected to server. Please wait...');
      return;
    }

    const message: { type: string; text: string; fileUrl?: string; fileName?: string } = {
      type: 'message',
      text,
    };

    if (fileInfo) {
      message.fileUrl = fileInfo.fileUrl;
      message.fileName = fileInfo.fileName;
    }

    wsRef.current.send(JSON.stringify(message));
  };

  // Upload file
  const uploadFile = async (file: File): Promise<{ fileUrl: string; fileName: string } | null> => {
    // Client-side size check (1 MB)
    const MAX_FILE_SIZE = 1 * 1024 * 1024;
    if (file.size > MAX_FILE_SIZE) {
      alert('File too large. Maximum size is 1 MB.');
      return null;
    }

    setIsUploading(true);

    try {
      // Convert file to base64
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          // Remove data URL prefix
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const response = await fetch(`${HTTP_URL}/upload`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileData: base64,
          fileName: file.name,
          mimeType: file.type || 'application/octet-stream',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Upload failed');
      }

      const data = await response.json();
      return { fileUrl: data.fileUrl, fileName: file.name };
    } catch (error) {
      console.error('Upload error:', error);
      alert(error instanceof Error ? error.message : 'Failed to upload file');
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-black/20 backdrop-blur-md border-b border-white/10 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">OneMinute</h1>
              <p className="text-xs text-white/60">Anonymous Global Chat</p>
            </div>
          </div>

          <ConnectionStatus isConnected={isConnected} error={connectionError} />
        </div>
      </header>

      {/* Warning Banner */}
      <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 border-b border-orange-500/30 px-4 py-2">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 text-sm text-orange-200">
          <svg className="w-4 h-4 animate-pulse-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="font-medium">Messages disappear after 10 minutes</span>
        </div>
      </div>

      {/* Chat Area */}
      <main className="flex-1 overflow-hidden flex flex-col max-w-4xl mx-auto w-full">
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-white/40">
              <svg className="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p className="text-lg">No messages yet</p>
              <p className="text-sm">Be the first to send a message!</p>
            </div>
          ) : (
            messages.map((message, index) => (
              <ChatMessage
                key={message.id}
                message={message}
                formatRemainingTime={formatRemainingTime}
                isNew={index === messages.length - 1}
              />
            ))
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-white/10 bg-black/20 backdrop-blur-md">
          <MessageInput
            onSendMessage={sendMessage}
            onUploadFile={uploadFile}
            isConnected={isConnected}
            isUploading={isUploading}
          />
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-black/30 border-t border-white/10 px-4 py-2 text-center">
        <p className="text-xs text-white/40">
          No login required • No tracking • Messages auto-delete after 10 minutes
        </p>
      </footer>
    </div>
  );
}

export default App;
