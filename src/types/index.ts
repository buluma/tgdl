// src/types/index.ts
export interface TelegramMessage {
  id: number;
  chatId: number;
  media?: MediaPayload;
  date: Date;
  fromId?: number;
}

export interface MediaPayload {
  type: 'photo' | 'video' | 'audio' | 'document' | 'voice' | 'sticker';
  fileId: string;
  mimeType?: string;
  size: number;
  width?: number;
  height?: number;
  duration?: number;
}

export interface ChatConfig {
  id: number;
  name: string;
  filters: MediaFilter[];
  autoForward?: number;
  enabled: boolean;
}

export interface DownloadRow {
  id: number;
  group_id: number;
  message_id: number;
  file_name: string;
  file_size: number;
  file_hash?: string;
  media_type: string;
  created_at: string;
  updated_at: string;
}

export interface MediaFilter {
  type: 'photo' | 'video' | 'audio' | 'document' | 'voice' | 'sticker';
  minSize?: number;
  maxSize?: number;
  mimeType?: string;
}

export interface UserSession {
  id: string;
  phone: string;
  session: string;
  apiId: number;
  apiHash: string;
}

export interface AppConfig {
  port: number;
  dataDir: string;
  sessions: UserSession[];
  chats: ChatConfig[];
  webAuth: {
    enabled: boolean;
    username: string;
    password: string;
  };
}

export interface WebSocketEvent {
  type: 'download' | 'error' | 'status';
  data: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}