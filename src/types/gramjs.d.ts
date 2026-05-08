// src/types/gramjs.d.ts
declare module 'telegram' {
  export class TelegramClient {
    constructor(
      session: string,
      apiId: number,
      apiHash: string,
      options?: any
    );
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isUserAuthorized(): boolean;
    start(options?: any): Promise<any>;
    getDialogs(options?: any): Promise<any[]>;
    downloadMedia(message: any, options?: any): Promise<Buffer>;
    sendMessage(entity: any, message: any, options?: any): Promise<any>;
    getMessages(entity: any, options?: any): Promise<any[]>;
    getMe(): Promise<any>;
    setLogLevel(level: string): void;
    invoke(info: any): Promise<any>;
  }

  export class Api {
    static Photo: any;
    static Document: any;
    static Video: any;
    static Audio: any;
    static Voice: any;
    static Sticker: any;
    static InputDocumentFileLocation: any;
    static InputPhotoFileLocation: any;
    static UpdateDeleteMessages: any;
    static UpdateDeleteChannelMessages: any;
    static PingDelayDisconnect: any;
    static InputPeerChannel: any;
    static InputPeerChat: any;
    static InputPeerUser: any;
    static stories: any;
    static channels: any;
  }
}

// Extend Error interface to include .code and .cancelled (used across the codebase)
interface Error {
  code?: string;
  cancelled?: boolean;
}