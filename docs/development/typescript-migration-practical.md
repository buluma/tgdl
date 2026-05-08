# TypeScript Migration Practical Guide

This document provides practical examples and patterns for migrating the Telegram Media Downloader codebase from JavaScript to TypeScript.

## Quick Start

```bash
npm ci
npm run type-check   # Verify no type errors
npm test             # Run existing tests
```

## Migration Patterns

### 1. Converting `.js` to `.ts`

#### Before (JavaScript)
```javascript
// src/core/bot.js
import { TelegramClient } from 'telegram';

export function createClient(apiId, apiHash, session) {
  const client = new TelegramClient(session, apiId, apiHash, {});
  return client;
}

export async function downloadMessage(client, message) {
  const media = message.media;
  if (!media) return null;
  return client.downloadMedia(message);
}
```

#### After (TypeScript)
```typescript
// src/core/bot.ts
import { TelegramClient } from 'telegram';
import { TelegramClientOptions } from '../types/telegram-client';
import { TelegramMessage, hasMedia } from '../types/type-guards';

export function createClient(
  apiId: number,
  apiHash: string,
  session: string,
  options: TelegramClientOptions = {}
): TelegramClient {
  const client = new TelegramClient(session, apiId, apiHash, options);
  return client;
}

export async function downloadMessage(
  client: TelegramClient,
  message: TelegramMessage
): Promise<Buffer | null> {
  // Use type guard
  if (!hasMedia(message)) {
    return null;
  }
  return client.downloadMedia(message);
}
```

### 2. Handling Dynamic Imports

When dealing with dynamic imports that may not have type definitions:

```typescript
// src/core/dynamic-imports.ts

export async function importModule<T>(
  moduleName: string
): Promise<T | null> {
  try {
    const module = await import(moduleName);
    return module as T;
  } catch (error) {
    console.error(`Failed to import ${moduleName}:`, error);
    return null;
  }
}

// Usage:
// const jsonModule = await importModule<{ default: any }>('some-module');
```

### 3. Converting API Routes

#### Before
```javascript
// src/web/routes/stories.js
export function handleStories(req, res) {
  const username = req.query.username;
  // ...
  res.json(stories);
}
```

#### After
```typescript
// src/web/routes/stories.ts
import { Request, Response } from 'express';
import { stories as storiesApi } from 'telegram';
import { ApiResponse } from '../types';

export async function handleStories(
  req: Request<{}, {}, {}, { username: string }>,
  res: Response<ApiResponse>
): Promise<void> {
  const username: string = req.query.username as string;
  // ...
  res.json(stories);
}
```

### 4. Database Queries with Types

```typescript
// src/core/db.ts
import Database from 'better-sqlite3';
import { MediaDownloadTask } from '../types';

interface MessageRow {
  id: number;
  chat_id: number;
  message_id: number;
  file_name: string;
  file_size: number;
  media_type: string;
  downloaded_at: string;
}

export function getUnprocessedMessages(db: Database.Database): MessageRow[] {
  return db.prepare('SELECT * FROM messages WHERE downloaded = 0').all() as MessageRow[];
}

export function insertMessage(
  db: Database.Database,
  message: MediaDownloadTask
): void {
  db.prepare(`
    INSERT INTO messages (chat_id, message_id, file_name, file_size, media_type, downloaded_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
  `).run(
    message.chatId,
    message.messageId,
    message.media.fileName,
    message.media.size,
    message.media.type
  );
}
```

### 5. Error Handling with Types

```typescript
// src/core/errors.ts

export interface TelegramError extends Error {
  code?: string;
  cancelled?: boolean;
  retryAfter?: number;
}

export function isFloodWaitError(error: unknown): error is TelegramError {
  const err = error as TelegramError;
  return err.code === 'FLOOD_WAIT' || err.code === 'SESSION_CLOSED';
}

export function isAuthError(error: unknown): error is TelegramError {
  const err = error as TelegramError;
  return err.code === 'AUTH_KEY_UNREGISTERED' || err.cancelled === true;
}

// Usage in code:
try {
  await client.invoke(info);
} catch (error) {
  if (isFloodWaitError(error)) {
    await wait(error.retryAfter ?? 5000);
  } else if (isAuthError(error)) {
    // Re-authenticate
  } else {
    throw error;
  }
}
```

### 6. Configuration with Type Safety

```typescript
// src/config/types.ts
export interface AppConfig {
  telegram: {
    apiId: number;
    apiHash: string;
  };
  accounts: AccountConfig[];
  groups: GroupConfig[];
  download: {
    concurrent: number;
    retries: number;
    maxSpeed: number;
    path: string;
  };
  rateLimits: {
    requestsPerMinute: number;
    delayMs: { min: number; max: number };
  };
  diskManagement: {
    maxTotalSize: string;
    maxVideoSize: number | null;
    maxImageSize: number | null;
  };
  proxy?: {
    type: 'socks5' | 'socks4' | 'mtproxy';
    host: string;
    port: number;
    username?: string;
    password?: string;
  };
}

export interface AccountConfig {
  id: string;
  phone: string;
  sessionPath: string;
}

export interface GroupConfig {
  id: number;
  name: string;
  enabled: boolean;
  filters: MediaFilter[];
  autoForward?: number;
  monitorAccount?: string;
  forwardAccount?: string;
}

export type MediaFilter = 'photos' | 'videos' | 'files' | 'audio' | 'gifs' | 'stickers' | 'links';
```

### 7. Converting Tests

```typescript
// tests/runtime.test.ts
import { describe, it, expect } from 'vitest';
import { createClient } from '../src/core/bot';
import { hasMedia, isPhotoMedia } from '../src/types/type-guards';

describe('Bot client', () => {
  it('should create client with valid credentials', () => {
    const client = createClient(12345, 'abc123', './session');
    expect(client).toBeDefined();
  });

  it('should correctly identify media type', () => {
    const message = {
      id: 1,
      media: { type: 'photo' as const, size: 1024 }
    };
    
    expect(hasMedia(message)).toBe(true);
    expect(isPhotoMedia(message.media)).toBe(true);
  });
});
```

### 8. Handling `any` Types (Technical Debt)

Track remaining `any` usage and replace incrementally:

```typescript
// utils/any-usage-tracker.ts

// Note: After migration, all `any` types should be replaced
// Use `unknown` as a safer alternative during transition

// Temporary pattern for legacy code:
export function processLegacyMessage(raw: any): TelegramMessage {
  // Use type assertion with caution
  const message = raw as unknown as TelegramMessage;
  
  // Add runtime validation
  if (!message.id || !message.date) {
    throw new Error('Invalid message format');
  }
  
  return message;
}
```

### 9. ESLint Configuration for TypeScript

The existing `eslint.config.js` works with TypeScript when using `@typescript-eslint`:

```javascript
// eslint.config.js
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';

export default [
  {
    files: ['src/**/*.ts', 'tests/**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
    },
    rules: {
      ...typescriptEslint.configs.recommended.rules,
    },
  },
];
```

### 10. Build Script Updates

```json
// package.json (update scripts)
{
  "scripts": {
    "build": "tsc && cp -r src/web/public dist/web/",
    "start": "node dist/index.js",
    "dev": "tsx watch src/index.ts",
    "test": "vitest run",
    "type-check": "tsc --noEmit",
    "lint": "eslint ."
  }
}
```

## Common Gotchas

### 1. GramJS Dynamic Types
GramJS returns `any` for many methods. Wrap with type guards:

```typescript
// Wrap dynamic responses
export function getMessagesTyped(
  client: TelegramClient,
  entity: any
): Promise<TelegramMessage[]> {
  return client.getMessages(entity, { limit: 100 })
    .then((messages: any[]) => 
      messages.map(msg => msg as TelegramMessage)
    );
}
```

### 2. Module Resolution
Use `moduleResolution: 'NodeNext'` in tsconfig for ES module support:

```json
{
  "compilerOptions": {
    "moduleResolution": "NodeNext"
  }
}
```

### 3. Declaration Files
Create declaration files for untyped dependencies:

```typescript
// src/types/telegram.d.ts
```

## Checklist for Complete Migration

- [ ] All `.js` files converted to `.ts`
- [ ] Type definitions for all public APIs
- [ ] Type guards for dynamic responses
- [ ] Error types defined
- [ ] Tests updated to TypeScript
- [ ] ESLint configured with TypeScript rules
- [ ] Build scripts updated
- [ ] Documentation updated (this file)
- [ ] No remaining `any` types (or tracked as technical debt)
- [ ] CI/CD updated for TypeScript checks

## Related Documentation

- [GramJS Type Definitions](./GRAMJS-TYPES.md)
- [TypeScript Migration Plan](./TYPESCRIPT-MIGRATION-PLAN.md)
- [Architecture Overview](./ARCHITECTURE.md)
- [API Reference](./API.md)
