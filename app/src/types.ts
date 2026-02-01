export interface Message {
  id: string;
  text: string;
  timestamp: number;
  fileUrl?: string;
  fileName?: string;
  remainingTime?: number;
}

export interface WebSocketMessage {
  type: 'init' | 'new_message' | 'error' | 'pong';
  messages?: Message[];
  message?: Message;
  error?: string;
  message_text?: string;
}

export interface FileUploadResponse {
  fileUrl: string;
  fileId: string;
  expiresIn: number;
}
