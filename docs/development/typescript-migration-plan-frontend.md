# Frontend TypeScript Migration Plan

## Overview
This document outlines a plan to migrate the existing vanilla JavaScript frontend of the Telegram Media Downloader to TypeScript. The migration aims to improve type safety, developer experience, and maintainability while minimizing disruption to existing functionality.

## Benefits
- **Compile-time Type Safety**: Catch type-related errors before runtime.
- **Enhanced IDE Support**: Better autocomplete, refactoring, and navigation.
- **Self-documenting Code**: Explicit interfaces for component props and API responses.
- **Safer Refactoring**: Confidently rename/move code with compiler assistance.
- **Reduced Runtime Bugs**: Fewer production issues related to type mismatches.

## Migration Strategy
We will follow an **incremental approach**, converting files from `.js` to `.ts` and introducing a build step for the frontend. This allows the project to remain functional throughout the migration. We will use a modern bundler like **Vite** or **esbuild** to handle the TypeScript compilation and produce optimized JavaScript bundles for the browser.

### Phases
1. **Setup & Configuration** (1-2 days)
2. **Define Core Types** (1-2 days)
3. **Convert Modules Priority Order** (~7-10 days)
4. **Update HTML and Build Scripts** (1-2 days)
5. **Final Review & Cleanup** (1-2 days)

### Detailed Steps

#### Phase 1: Setup & Configuration
- Install TypeScript and a bundler as dev dependencies:
  ```bash
  npm install -D typescript vite
  ```
- Create a `tsconfig.json` in the `src/web/public` directory to configure the frontend compilation:
  ```json
  {
    "compilerOptions": {
      "target": "ES2022",
      "module": "ESNext",
      "moduleResolution": "node",
      "lib": ["ES2022", "DOM", "DOM.Iterable"],
      "strict": true,
      "outDir": "../../../dist/public",
      "rootDir": "./js",
      "esModuleInterop": true,
      "skipLibCheck": true,
      "forceConsistentCasingInFileNames": true
    },
    "include": ["js/**/*.ts"]
  }
  ```
- Create a `vite.config.js` at the root of the project to configure the build process:
  ```javascript
  import { defineConfig } from 'vite';

  export default defineConfig({
    root: 'src/web/public',
    build: {
      outDir: '../../../dist/public',
      rollupOptions: {
        input: {
          main: 'src/web/public/index.html',
          // Add other HTML files here if needed
        },
      },
    },
  });
  ```

#### Phase 2: Define Core Types
- Create a `js/types/` directory with interfaces for:
  - API responses
  - Component props (for functions in `components.js`)
  - Application state (`store.js`)

#### Phase 3: Module Conversion Priority
Convert files in this order (highest impact first):

1. **API Layer** (`js/api.js`) - Define types for all API requests and responses.
2. **Store** (`js/store.js`) - Define the shape of the application state.
3. **Components** (`js/components.js`) - Add types for component props.
4. **Main App Logic** (`js/app.js`) - The main application entry point.
5. **Utilities** (`js/utils.js`) - Helper functions.
6. **Other modules** - Convert the remaining modules.

For each file:
- Rename `.js` → `.ts`
- Add explicit type annotations.
- Replace `any` with proper types or `unknown` + type guards.

#### Phase 4: Update HTML and Build Scripts
- Update the `<script>` tags in all `.html` files in `src/web/public` to point to the new bundled JavaScript files. The `type="module"` attribute will be important.
  ```html
  <!-- Before -->
  <script src="js/app.js" type="module"></script>

  <!-- After -->
  <script src="/app.ts" type="module"></script> 
  ```
  *(Vite will handle the path resolution during development)*
- Update `package.json` scripts to include the frontend build:
  ```json
  {
    "scripts": {
      "dev:frontend": "vite",
      "build:frontend": "vite build"
    }
  }
  ```

#### Phase 5: Final Review
- Run a full manual test of the web dashboard.
- Clean up any temporary `@ts-ignore` comments.
- Ensure the production build is working correctly.

## Estimated Timeline
| Phase | Effort |
|-------|--------|
| Setup & Configuration | 1-2 days |
| Core Types Definition | 1-2 days |
| Module Conversion | 7-10 days |
| HTML & Build Scripts | 1-2 days |
| Final Review & Cleanup | 1-2 days |
| **Total** | **~11-18 days** (single developer) |

## Risks & Mitigations
| Risk | Mitigation |
|------|------------|
| Breaking existing functionality | Incremental conversion, manual testing after each phase. |
| Build process complexity | Use a modern bundler like Vite to simplify the setup. |
| Learning curve for vanilla TS | The team is already familiar with TypeScript from the backend migration. |

## Rollback Plan
- The migration will be done on a separate feature branch.
- If major issues arise, we can revert commits for specific files or, in the worst case, revert the entire feature branch.

## Success Criteria
- All frontend code is converted to TypeScript.
- The web dashboard is fully functional with no new bugs.
- The build process is integrated into the project's CI/CD pipeline.
- Developers report an improved development experience.
