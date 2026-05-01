---
description: "Project layout skill: Bluesky Social App structure, module conventions, file organization"
user-invocable: false
---

# Project Layout Skill

Understanding the Bluesky Social App structure, module organization, and code conventions.

## Repository Structure

```
src/
├── alf/                    # Design system (ALF) - themes, atoms, tokens
│   ├── themes.ts           # Theme definitions (light/dark)
│   ├── tokens.ts           # Design tokens
│   └── atoms.ts            # Static atoms (extends @bsky.app/alf)
│
├── components/             # Shared UI components
│   ├── Button.tsx           # Button, ButtonText, ButtonIcon
│   ├── Dialog/              # Dialog system (native bottom sheet / web modal)
│   │   ├── index.tsx        # Native implementation
│   │   └── index.web.tsx    # Web implementation
│   ├── Menu/                # Menu system (web dropdown / native bottom sheet)
│   ├── Typography.tsx       # Text, H1, H2, P
│   └── forms/
│       └── TextField.tsx    # Text input with label, icon, validation
│
├── screens/                # Full-page screen components (newer pattern)
│   └── ProfileScreen/
│       ├── index.tsx        # Main screen
│       └── components/      # Screen-specific components
│
├── features/               # Macro-features bridging components/screens
│   └── liveNow/
│
├── view/                   # LEGACY - avoid new files here
│   ├── screens/            # Legacy screen location
│   ├── com/                # Legacy reusable components
│   └── shell/              # App shell (nav bars, tabs)
│
├── state/
│   ├── queries/            # TanStack Query hooks
│   │   ├── profile.ts
│   │   └── util.ts         # createQueryKey helper
│   ├── preferences/        # User preferences (React Context)
│   ├── session/            # Authentication state (useSession, useAgent)
│   └── persisted/          # Persistent storage layer
│
├── lib/                    # Utilities, constants, helpers
│   ├── routes/
│   │   └── types.ts        # Route type definitions
│   └── constants.ts
│
├── locale/                 # i18n configuration (Lingui)
│   └── i18n.ts
│
├── Navigation.tsx          # Main navigation configuration
└── routes.ts               # Route definitions
```

## Key Patterns

### Architecture
- **Component-driven**: Reusable components in `src/components/`
- **Screen-based routing**: React Navigation with typed params
- **Server state**: TanStack Query (React Query) for API data
- **UI state**: React Context for preferences, local state for UI

### Navigation
- React Navigation (native stack + tabs)
- Type-safe route params in `src/lib/routes/types.ts`
- Navigation config in `src/Navigation.tsx`

### Data Layer
- AT Protocol (atproto) via `@atproto/api`
- Agent-based API calls (`useAgent()`)
- TanStack Query for caching and reactivity
- `createQueryKey` helper for consistent query keys

### Styling
- ALF design system (Tailwind-inspired, underscores not hyphens)
- Static atoms: `atoms as a` from `#/alf`
- Theme atoms: `useTheme()` → `t.atoms.bg`, `t.palette.primary_500`
- Platform utilities: `web()`, `native()`, `ios()`, `android()`

### Internationalization
- Lingui framework
- `msg()` for strings, `<Trans>` for JSX
- `useLingui()` hook for `_()` function

## Where to Put New Code

### New screen
```
src/screens/MyScreen/
├── index.tsx           # Main screen component
├── components/         # Screen-specific sub-components
└── __tests__/
    └── MyScreen.test.tsx
```

### New shared component
```
src/components/MyComponent.tsx
# Or for platform-specific:
src/components/MyComponent/
├── index.tsx           # Native
└── index.web.tsx       # Web
```

### New feature with multiple screens/components
```
src/features/myFeature/
├── index.tsx           # Main entry
├── components/
├── hooks/
└── README.md           # Optional documentation
```

### New query hook
```
src/state/queries/myFeature.ts
```

## Conventions

1. **ProudCamelCase** for components, **camelCase** for files/directories
2. **`#/` alias** for all imports from `src/`
3. **New screens** in `src/screens/`, NOT `src/view/screens/`
4. **No new top-level dirs** in `src/`
5. **Platform files** grouped in directories: `Component/index.tsx` + `Component/index.web.tsx`
6. **Co-locate tests** with source code
7. **React Compiler enabled** — no manual `useMemo`/`useCallback`

## Finding Things

### Feature code
1. `src/screens/<Feature>/` — screen components
2. `src/components/` — shared UI components
3. `src/state/queries/` — data fetching hooks
4. `src/features/<feature>/` — complex features
5. `src/view/` — legacy code (check last)

### Configuration
- Route types: `src/lib/routes/types.ts`
- Navigation: `src/Navigation.tsx`
- Theme: `src/alf/themes.ts`
- Tokens: `src/alf/tokens.ts`

### Tests
Mirror source structure with `__tests__/` directories or `.test.tsx` suffix.
