---
description: "Codebase navigation skill: efficient search and discovery patterns for the Bluesky Social App"
user-invocable: false
---

# Codebase Navigation Skill

Strategies for efficiently finding and understanding code in the Bluesky Social App codebase.

## Search Strategy

When investigating a feature or understanding how something works, follow this order:

### 1. Start with file names (Glob)
```
Glob: src/screens/**/*Profile*.tsx
Glob: src/components/**/*Button*.tsx
Glob: src/state/queries/**/*feed*.ts
```

### 2. Search for symbols (Grep)
```
Grep: "function useProfileQuery"
Grep: "export function.*Screen"
Grep: "createQueryKey"
Grep: "interface.*Props"
```

### 3. Find usages (Grep)
```
Grep: "useProfileQuery("
Grep: "import.*from '#/components/Button'"
Grep: "<ProfileScreen"
```

### 4. Trace data flow
- Start at the screen component
- Find what data it displays → trace to the query hook
- Find what triggers it → trace to the navigation entry point

## Common Search Patterns

### Finding a screen's entry point
```
Grep: "navigate.*ProfileScreen"
Grep: "name: 'Profile'"
```

### Finding API calls
```
Grep: "useQuery(" type:ts
Grep: "useMutation(" type:ts
Grep: "agent\." type:ts
Grep: "app\.bsky\." type:ts
```

### Finding components
```
Grep: "export function.*:" glob:"src/components/**"
Grep: "export const.*:" glob:"src/components/**"
```

### Finding state management
```
Grep: "createQueryKey" type:ts
Grep: "useContext(" type:ts
Grep: "createContext(" type:ts
```

### Finding navigation routes
```
Grep: "CommonNavigatorParams" type:ts
Read: src/lib/routes/types.ts
Read: src/Navigation.tsx
```

### Finding tests for a component
```
Glob: src/**/__tests__/*Profile*
Glob: src/**/*Profile*.test.*
```

### Finding i18n strings
```
Grep: "msg\`" type:ts
Grep: "<Trans>" type:tsx
Grep: "useLingui" type:ts
```

### Finding platform-specific code
```
Glob: src/**/*.web.tsx
Glob: src/**/*.native.tsx
Glob: src/**/*.ios.tsx
```

## Performance Tips

1. **Use Glob before Grep** — file name matching is faster than content search
2. **Scope searches** — specify a path like `path:src/components`
3. **Use type filters** — `type:ts` or `glob:"*.tsx"` avoids non-code files
4. **Read targeted sections** — use Read with offset/limit for large files
5. **Don't read node_modules** — always scope to `src/`
6. **Check components first** — many UI elements already exist in `src/components/`
