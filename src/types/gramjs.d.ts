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
    // Add more methods as needed
  }

  export class Api {
    static Photo: any;
    static Document: any;
    static Video: any;
    static Audio: any;
    static Voice: any;
    static Sticker: any;
    // Add other classes as needed
  }
}