# TypeScript Migration Plan for Telegram Media Downloader

## Overview
This document outlines a plan to migrate the existing JavaScript codebase of the Telegram Media Downloader to TypeScript. The migration aims to improve type safety, developer experience, and maintainability while minimizing disruption to existing functionality.

## Benefits
- **Compile-time Type Safety**: Catch type-related errors before runtime.
- **Enhanced IDE Support**: Better autocomplete, refactoring, and navigation.
- **Self-documenting Code**: Explicit interfaces serve as API contracts.
- **Safer Refactoring**: Confidently rename/move code with compiler assistance.
- **Team Scalability**: Easier onboarding and consistent code quality.
- **Reduced Runtime Bugs**: Fewer production issues related to type mismatches.

## Best Practices
- **Version Control**: Create a dedicated feature branch for the migration (e.g., `feature/typescript-migration`).
- **Linting & Formatting**: Integrate TypeScript-aware linting (ESLint with `@typescript-eslint/parser`) and formatting (Prettier) early to ensure consistency.
- **CI/CD Integration**: Update CI/CD pipelines to include TypeScript compilation and linting checks as part of the build process.

## Migration Strategy
We recommend an **incremental approach** using `allowJs: true` and gradual conversion of files from `.js` to `.ts`. This allows the project to remain functional throughout the migration.

### Phases
1. **Setup & Configuration** (1-2 days)
2. **Define Core Types** (2-3 days)
3. **Convert Modules Priority Order** (~10-12 days)
4. **Update Tests & Build Scripts** (2-3 days)
5. **Final Review & Cleanup** (1-2 days)

### Detailed Steps

#### Phase 1: Setup & Configuration
- Install TypeScript and related dev dependencies:
  ```bash
  npm install -D typescript @types/node ts-node tsx
  npm install -D @types/express @types/ws @types/better-sqlite3 @types/fluent-ffmpeg @types/scrypt-js @types/gramjs --save-dev
  ```
- Create `tsconfig.json` with incremental settings:
  ```json
  {
    "compilerOptions": {
      "target": "ES2024",
      "module": "NodeNext",
      "moduleResolution": "NodeNext",
      "lib": ["ES2024"],
      "allowJs": true,
      "checkJs": false,
      "strict": false,
      "noImplicitAny": false,
      "strictNullChecks": false,
      "outDir": "./dist",
      "rootDir": "./src",
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true,
      "resolveJsonModule": true
    },
    "include": ["src/**/*", "tests/**/*", "scripts/**/*"]
  }
  ```
  *Note: The `strict` flags are initially `false` to facilitate the migration. A key goal is to enable `strict: true` once the migration is complete.*
- Update `package.json` scripts:
  ```json
  {
    "scripts": {
      "build": "tsc",
      "start": "node dist/index.js",
      "dev": "tsx watch src/index.ts",
      "test": "vitest"
    },
    "type": "module"
  }
  ```

#### Phase 2: Define Core Types
Create a shared types directory (`src/types/`) with interfaces for:
- `TelegramMessage`
- `MediaPayload`
- `ChatConfig`
- `UserSession`
- `AppConfig`
- WebSocket event types
- API response types

*Note: For better organization, consider splitting types into more granular files as the number of types grows (e.g., `src/types/telegram.ts`, `src/types/config.ts`).*

Example:
```typescript
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
```

#### Phase 3: Module Conversion Priority
Convert files in this order (highest impact first):

1. **Database Layer** (`src/db/`) - SQLite queries benefit greatly from types
2. **API Layer** (`src/api/`) - Telegram API wrappers
3. **Bot/Core Logic** (`src/bot/`) - Main Telegram client interaction
4. **Web Layer** (`src/web/`) - Express routes, middleware, WebSocket
5. **Download Logic** (`src/download/`) - File handling and processing
6. **Utilities** (`src/utils/`) - Helper functions, parsers, sanitizers
7. **IPC & Workers** (`src/ipc/`, `src/workers/`) - Inter-process communication
8. **Scripts** (`scripts/`) - Migration, setup scripts
9. **Tests** (`tests/`) - Convert vitest specs to TypeScript

For each file:
- Rename `.js` → `.ts`
- Add explicit type annotations
- Replace `any` with proper types or `unknown` + type guards. Track remaining `any`s as technical debt.
- Handle dynamic imports with `(await import('module')).default`
- Create declaration files for libraries without types (e.g., GramJS)

#### Phase 4: Testing & Build
- Ensure all existing tests pass after each conversion batch
- Add type coverage to tests where appropriate
- Verify build output matches previous behavior
- Update CI/CD pipelines to run TypeScript compilation and linting checks.
- Update Dockerfile to include build stage:
  ```dockerfile
  FROM node:24-slim AS builder
  WORKDIR /app
  COPY package*.json ./
  RUN npm ci
  COPY tsconfig.json ./
  COPY src/ ./src/
  RUN npm run build

  FROM node:24-slim
  WORKDIR /app
  COPY --from=builder /app/dist ./dist
  COPY --from=builder /app/node_modules ./node_modules
  COPY package*.json ./
  CMD ["node", "dist/index.js"]
  ```

#### Phase 5: Final Review
- Run full test suite
- Perform manual verification of core features
- Clean up any temporary `// @ts-ignore` comments
- Incrementally enable stricter TypeScript rules (`strict: true`).
- After the full migration, set `allowJs: false` in `tsconfig.json`.

## Estimated Timeline
| Phase | Effort |
|-------|--------|
| Setup & Configuration | 1-2 days |
| Core Types Definition | 2-3 days |
| Database Layer Conversion | 2-3 days |
| API/Bot Layer Conversion | 3-5 days |
| Web Layer Conversion | 2-3 days |
| Download/Utils Conversion | 2-3 days |
| Tests & Scripts Conversion | 2-3 days |
| Final Review & Cleanup | 1-2 days |
| **Total** | **~14-20 days** (single developer) |

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Incremental conversion, run tests after each file |
| GramJS lacks type definitions | Create custom declaration file (`src/types/gramjs.d.ts`) |
| Dynamic imports causing issues | Use `(await import('module')).default` pattern |
| Build process complexity | Maintain parallel npm scripts during transition |
| Team learning curve | Pair programming on initial conversions, code reviews |

## Rollback Plan
Since we're using an incremental approach with Git:
1. Commit after each successfully converted file/test suite pass
2. If issues arise, revert commits for that file
3. Keep `allowJs: true` to allow mixing JS/TS during transition
4. Worst case: revert to pre-migration feature branch (created before start)

## Success Criteria
- All existing tests pass in TypeScript
- No new runtime type-related errors introduced
- Build process produces identical output to previous JS build
- Developers report improved productivity after migration
- Ability to enable stricter TypeScript rules incrementally

## Next Steps
1. Create a feature branch: `git checkout -b feature/typescript-migration`
2. Begin Phase 1: Install dependencies and create tsconfig
3. Start converting highest-priority modules (db layer)

---
*This plan should be reviewed and adjusted based on team capacity and specific codebase complexities encountered during migration.*