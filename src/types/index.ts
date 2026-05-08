// src/types/index.ts
import { WebSocket as WS } from 'ws';

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
  id: number | string;
  name: string;
  filters: MediaFilter;
  autoForward?: number;
  enabled: boolean;
}

export interface DownloadRow {
  id: number;
  group_id: number | string;
  message_id: number;
  file_name: string;
  file_size: number;
  file_hash?: string;
  media_type?: string; // Legacy
  file_type: string;
  file_path: string;
  pending_until?: number | null;
  rescued_at?: number | null;
  pinned?: number | boolean;
  group_name?: string;
  created_at: string;
  updated_at: string;
}

export interface MediaFilter {
    photos: boolean;
    videos: boolean;
    files: boolean;
    links: boolean;
    voice: boolean;
    audio: boolean;
    gifs: boolean;
    stickers: boolean;
    urls: boolean;
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
  monitor?: {
    autoStart?: boolean;
  };
  groups?: ChatConfig[];
}

export interface WebSocketEvent {
  type: string;
  [key: string]: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SafeWebSocket extends WS {
    role?: string;
}
