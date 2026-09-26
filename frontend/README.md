# NiffyInsur Frontend

Next.js App Router application for the NiffyInsur decentralized insurance platform.

## Getting started

```bash
npm install
npm run dev
```

## Quality gates

```bash
npm run lint
npm run typecheck
npm run build
```

`npm run lint` fails on warnings by design — keep it that way.

## Folder conventions

```
src/
  app/                          # App Router routes, layouts, and route handlers
  features/<feature>/           # Feature-scoped modules
    components/                 # Feature UI
    hooks/                      # Feature hooks
    api/                        # Feature data access
  components/ui/                # Shared, reusable UI primitives
  lib/                          # Shared utilities, providers, and config
  styles/                       # Global styles and design tokens
```

Path aliases: `@/*` maps to `src/*` (see `tsconfig.json`).
