# GramJS Type Definitions for Telegram Media Downloader

## Overview

This document provides comprehensive TypeScript type definitions for the GramJS library used in the Telegram Media Downloader project. These types extend the basic declarations in `src/types/gramjs.d.ts` with detailed interfaces for better type safety.

## Core Type Definitions

### TelegramClient Extended Types

```typescript
// src/types/telegram-client.ts

export interface TelegramClientOptions {
  connectionRetries?: number;
  retryDelay?: number;
  timeout?: number;
  requestRetries?: number;
  floodSleepThreshold?: number;
  deviceModel?: string;
  systemVersion?: string;
  appVersion?: string;
  langCode?: string;
  systemLangCode?: string;
  session?: string;
}

export interface MessageMedia {
  type: 'photo' | 'video' | 'document' | 'audio' | 'voice' | 'sticker' | 'gif';
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
  fileName?: string;
  // Telegram-specific properties
  documentId?: string;
  accessHash?: string;
  fileReference?: Buffer;
}

export interface TelegramMessage {
  id: number;
  peerId: PeerId;
  date: Date;
  message?: string;
  media?: MessageMedia;
  mediaType?: string;
  mediaUnread?: boolean;
  ttlPeriod?: number; // For self-destructing media
  fromId?: PeerId;
  // Additional properties used in the codebase
  action?: any;
  groupedId?: string; // For albums
}

export type PeerId = number | string | { userId?: number; channelId?: number; chatId?: number };
```

### API Types for Media Handling

```typescript
// src/types/telegram-api.ts

export interface InputFileLocation {
  type: 'inputDocumentFileLocation' | 'inputPhotoFileLocation' | 'inputPeerPhotoFileLocation';
  id: string;
  accessHash: string;
  fileReference?: Buffer;
  thumbSize?: string;
}

export interface DownloadOptions {
  fileSize?: number;
  progressCallback?: (progress: number) => void;
  outputFile?: string;
  // Advanced options
  dcId?: number;
  cdnAuthRedirect?: boolean;
  chunkSize?: number;
}

export interface UploadOptions {
  file: string | Buffer;
  fileName?: string;
  mimeType?: string;
  progressCallback?: (progress: number) => void;
}
```

## Type Guards

Use these type guards to safely handle dynamic GramJS responses:

```typescript
// src/types/type-guards.ts

import { TelegramMessage, MessageMedia } from './telegram-client';

export function hasMedia(message: TelegramMessage): message is TelegramMessage & { media: MessageMedia } {
  return !!message.media && typeof message.media === 'object';
}

export function isPhotoMedia(media: MessageMedia): boolean {
  return media.type === 'photo' || (media.mimeType?.startsWith('image/') ?? false);
}

export function isVideoMedia(media: MessageMedia): boolean {
  return media.type === 'video' || (media.mimeType?.startsWith('video/') ?? false);
}

export function isDocumentMedia(media: MessageMedia): boolean {
  return media.type === 'document' || !!(media.mimeType && !isPhotoMedia(media) && !isVideoMedia(media));
}

export function hasTtl(message: TelegramMessage): message is TelegramMessage & { ttlPeriod: number } {
  return typeof message.ttlPeriod === 'number' && message.ttlPeriod > 0;
}
```

## Common Patterns

### Downloading Media with Type Safety

```typescript
import { TelegramClient } from 'telegram';
import { Api } from 'telegram';
import { hasMedia, isPhotoMedia, DownloadOptions } from '../types';

async function downloadMediaSafely(
  client: TelegramClient,
  message: any, // GramJS dynamic type
  options?: DownloadOptions
): Promise<Buffer | null> {
  // Type guard check
  if (!hasMedia(message)) {
    return null;
  }

  const media = message.media;
  
  // Handle different media types
  if (isPhotoMedia(media)) {
    return await client.downloadMedia(message, {
      ...options,
      type: 'photo',
    });
  }
  
  // For documents/videos
  return await client.downloadMedia(message, options);
}
```

### Handling Self-Destructing Media (TTL)

```typescript
import { hasTtl, TelegramMessage } from '../types';

function prioritizeTtlDownload(message: any): number {
  const msg = message as TelegramMessage;
  
  if (hasTtl(msg)) {
    // TTL media gets highest priority (0)
    return 0;
  }
  
  // Normal priority
  return 1;
}
```

## Declaration File Updates

The existing `src/types/gramjs.d.ts` should be updated to include these detailed types:

```typescript
// Update src/types/gramjs.d.ts with:

declare module 'telegram' {
  export interface TelegramClient {
    // ... existing methods ...
    
    // More specific overloads
    downloadMedia(
      message: any, 
      options?: { 
        outputFile?: string; 
        progressCallback?: (progress: number) => void;
        fileSize?: number;
      }
    ): Promise<Buffer | string>;
    
    getMessages(
      entity: any, 
      options: { 
        limit?: number; 
        offsetId?: number; 
        maxId?: number; 
        minId?: number;
        fromUser?: any;
        filter?: any;
      }
    ): Promise<any[]>;
  }
  
  export namespace Api {
    // More specific types for media
    export class MessageMediaPhoto {
      photo: any;
      ttlSeconds?: number;
    }
    
    export class MessageMediaDocument {
      document: any;
      ttlSeconds?: number;
    }
    
    // Input types for API calls
    export class InputMessagesFilterPhotos {}
    export class InputMessagesFilterVideo {}
    export class InputMessagesFilterDocument {}
    export class InputMessagesFilterVoice {}
    export class InputMessagesFilterGif {}
    export class InputMessagesFilterUrl {}
  }
}
```

## Integration with Project Types

These GramJS types integrate with the project's core types defined in `src/types/index.ts`:

```typescript
// src/types/index.ts (additions)

import { TelegramMessage as GramJSMessage, MessageMedia } from './telegram-client';

export interface MediaDownloadTask {
  messageId: number;
  chatId: number;
  media: MessageMedia;
  priority: number;
  ttlExpiry?: Date;
  // ... other properties
}

export interface TelegramChat {
  id: number;
  title: string;
  type: 'channel' | 'supergroup' | 'group' | 'user';
  // GramJS specific
  participantsCount?: number;
  adminRights?: any;
}
```

## Migration Notes

When migrating from JavaScript to TypeScript:

1. **Replace `any` with proper types** - Use the `TelegramMessage` interface instead of `any` for message parameters
2. **Add type assertions sparingly** - Use `as unknown as TelegramMessage` only when necessary
3. **Create wrapper functions** - Wrap GramJS calls with typed wrappers like `downloadMediaSafely`
4. **Handle dynamic responses** - Use type guards for properties that may not exist

## Further Reading

- [GramJS Documentation](https://gram.js.org/)
- [Telegram API Types](https://core.telegram.org/api/types)
- [Project TypeScript Migration Plan](./TYPESCRIPT-MIGRATION-PLAN.md)
- [TypeScript Migration Practical Guide](./TYPESCRIPT-MIGRATION-PRACTICAL.md) (if available)
