export interface Message {
  id: string;
  text: string;
  timestamp: number;
  sender: string;
  senderId: string;
  fileUrl?: string;
  fileName?: string;
  remainingTime?: number;
}

export type WebSocketMessage =
  | {
      type: 'identity';
      userId: string;
      anonName: string;
    }
  | {
      type: 'init';
      roomId: string;
      messages: Message[];
      username: string;
    }
  | {
      type: 'new_message';
      message: Message;
    }
  | {
      type: 'room_created';
      roomId: string;
      roomKey: string;
      username: string;
    }
  | {
      type: 'room_joined';
      roomId: string;
      messages: Message[];
      username: string;
    }
  | {
      type: 'error';
      message: string;
    }
  | {
      type: 'pong';
    };

export interface FileUploadResponse {
  fileUrl: string;
  fileId: string;
  expiresIn: number;
}