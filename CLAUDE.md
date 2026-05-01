# CLAUDE.md — App Creator MVP tactical patterns

> Companion to `ARCHITECTURE.md`. Where ARCHITECTURE.md says **what the
> rules are**, this file says **how to apply them in code**. When the two
> disagree, ARCHITECTURE.md wins — log the conflict and proceed with the
> spec's rule.
>
> This file grows with the codebase. Tentative entries are marked
> **[tentative]** and will solidify after the bootstrap PR lands.

---

## 0. Project shape and conventions

- **Language**: TypeScript strict everywhere. No JS files except `app.config.ts`.
- **Imports**: use the `#/` alias for the local app's `src/` (configured per workspace), not relative paths into `src/`.
  - ✅ `import {Button} from '#/components/Button'`
  - ❌ `import {Button} from '../../components/Button'`
- **Workspace boundaries**: do not deep-import another workspace's `src/`. Import from its package entry only.
  - ✅ `import {render} from '@app-creator/a2ui-renderer'`
  - ❌ `import {render} from '../../packages/a2ui-renderer/src/render'`
- **Naming**: PascalCase for components and types, camelCase for functions and variables, SCREAMING_SNAKE_CASE for module-level constants.
- **No barrel files** (`index.ts` re-exports) at `src/` root. Per-folder index files are fine when they re-export a directory's public API.

---

## 1. React Native components (app-shell)

### Functional components only

```tsx
export function ProjectCard({project, onPress}: Props) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Open ${project.title}`}>
      <Text>{project.title}</Text>
    </Pressable>
  )
}
```

- `Pressable` over `TouchableOpacity` for new code (RN's modern primitive).
- Always provide `accessibilityRole` + `accessibilityLabel` on interactive elements (ARCHITECTURE.md §12).
- No proactive `useMemo` / `useCallback`. React Compiler is enabled — let it do its job.

### Theming

```tsx
import {useTheme} from '#/theme'

const t = useTheme()
<View style={{backgroundColor: t.atoms.bg, padding: t.spacing.md}} />
```

- Never hardcode colors or spacing values.
- Tokens live in `apps/mobile/src/theme/tokens.ts`. Atoms in `apps/mobile/src/theme/atoms.ts`.
- Light/dark themes are first-class — every component must work in both.

---

## 2. Server-state hooks (TanStack Query)

### Shape of a domain module

```ts
// apps/mobile/src/state/queries/projects.ts
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query'
import {createQueryKey, STALE} from '#/state/queries/util'
import {apiClient} from '#/lib/api'

export const projectsKeys = {
  list: () => createQueryKey('projects', 'list'),
  detail: (id: string) => createQueryKey('projects', 'detail', {id}),
}

export function useProjectsListQuery() {
  return useQuery({
    queryKey: projectsKeys.list(),
    queryFn: () => apiClient.get('/projects').json<Project[]>(),
    staleTime: STALE.MINUTES.FIVE,
  })
}

export function useDeleteProjectMutation() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => apiClient.delete(`/projects/${id}`).void(),
    onSuccess: () => qc.invalidateQueries({queryKey: projectsKeys.list()}),
  })
}
```

- Always export a `<domain>Keys` factory; never inline keys in `useQuery`.
- Always set `staleTime` from `STALE.*`; never hardcode milliseconds.
- One file per domain in `state/queries/`. No god-files.

### Optimistic mutations

```ts
useMutation({
  mutationFn: (input) => apiClient.post('/x', {json: input}).json(),
  onMutate: async (input) => {
    await qc.cancelQueries({queryKey: keys.list()})
    const previous = qc.getQueryData(keys.list())
    qc.setQueryData(keys.list(), (old) => optimisticUpdate(old, input))
    return {previous}
  },
  onError: (_err, _input, ctx) => {
    if (ctx?.previous) qc.setQueryData(keys.list(), ctx.previous)
    toast.error('Could not save')
  },
  onSettled: () => qc.invalidateQueries({queryKey: keys.list()}),
})
```

The `previous` snapshot pattern is mandatory. The `onSettled` invalidate is mandatory.

---

## 3. LLM call pattern (server-only)

All LLM calls go through `services/api/src/llm/anthropic.ts`. Never instantiate the SDK at a call site.

```ts
// services/api/src/llm/generate.ts
import {anthropic} from './anthropic'
import {appSpecTool} from './tools/produceAppSpec'
import {systemPrompt, catalogBlock} from './prompts'
import {trace} from 'langfuse'

export async function generateAppSpec(opts: {
  userId: string
  projectId: string
  conversation: Message[]
}) {
  return trace('generate', {userId: opts.userId, projectId: opts.projectId}, async () => {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 8000,
      metadata: {user_id: hashUserId(opts.userId)},
      system: [
        {type: 'text', text: systemPrompt},
        {type: 'text', text: catalogBlock, cache_control: {type: 'ephemeral'}},
      ],
      tools: [appSpecTool],
      tool_choice: {type: 'tool', name: 'produce_app_spec'},
      messages: opts.conversation,
    })
    return extractToolInput(response, 'produce_app_spec')
  })
}
```

Required pieces in every LLM call:
1. **Wrapped in `trace(...)`** for Langfuse (ARCHITECTURE.md §8).
2. **`metadata.user_id`** is hashed, never raw.
3. **System prompt is split into a static and a cacheable block** with `cache_control: {type: 'ephemeral'}` on the catalog. The first message's system content is always non-cacheable, the catalog is cacheable. (See `claude-api` skill.)
4. **`tool_choice` forces** the model to use the spec tool — no free-text JSON.
5. **`max_tokens: 8000`** — never higher (ARCHITECTURE.md §4).

### Edit-by-chat (JSON Patch)

```ts
const editTool = {
  name: 'produce_app_spec_patch',
  description: 'Produce an RFC 6902 JSON Patch to apply to the current spec',
  input_schema: jsonPatchSchema,
}
// ... same wrapper ...
const patch = extractToolInput(response, 'produce_app_spec_patch')
const newSpec = applyPatch(currentSpec, patch).newDocument
A2UISchema.parse(newSpec) // re-validate; throw if invalid
```

If `parse` throws, return a structured error to the client and do NOT persist. The user sees a "couldn't apply that change, try rephrasing" toast.

---

## 4. A2UI renderer pattern

Every catalog component is a pure function of `{node, state, dispatch}`.

```tsx
// packages/a2ui-renderer/src/components/Button.tsx
import type {A2UIButtonNode, RenderState, Dispatch} from '../types'

export function ButtonRenderer({node, state, dispatch}: {
  node: A2UIButtonNode
  state: RenderState
  dispatch: Dispatch
}) {
  return (
    <Pressable
      onPress={() => dispatch(node.action, state)}
      accessibilityRole="button"
      accessibilityLabel={node.label}
    >
      <Text>{node.label}</Text>
    </Pressable>
  )
}
```

- **No refs to anything outside the spec.** No `useNavigation`, no `useTheme` — the renderer accepts theme as a context provided by the host app, but components must not reach into app-specific contexts.
- **No side effects.** No `useEffect`. State only changes through `dispatch(action, state)`.
- **Snapshot tests are mandatory** — one per component type, exercising the props matrix from `ARCHITECTURE.md §6`.

---

## 5. Logger pattern

### Client

```ts
import {logger} from '#/logger'

logger.error('Failed to load projects', {safeMessage: err, projectId})
logger.info('User opened project', {projectId})
```

Never `console.log` in `apps/mobile/src/`. ESLint blocks it.

### Server

```ts
import {logger} from '#/lib/logger'

logger.error({err, traceId, projectId}, 'failed to apply patch')
logger.info({traceId, eventType: 'generation_succeeded'}, 'generation done')
```

Pino structured-first: object first, message second.

### `safeMessage`

`safeMessage(err)` strips internal stack paths and known PII. Use it whenever an error originates outside our code (Anthropic SDK, fetch, DB driver).

---

## 6. Error handling at the API boundary

### Server route shape

```ts
// services/api/src/routes/projects.ts
fastify.post('/projects', {
  schema: {body: projectCreateSchema},
  preHandler: [requireAuth],
}, async (req, reply) => {
  try {
    const project = await projectsService.create(req.user.id, req.body)
    return reply.code(201).send(project)
  } catch (err) {
    req.log.error({err: safeMessage(err)}, 'project create failed')
    if (err instanceof ValidationError) return reply.code(400).send({error: err.message})
    return reply.code(500).send({error: 'internal'})
  }
})
```

- Routes are thin: validate → delegate → return. No DB, no LLM.
- Always return a typed error body with `{error: string}`. The client reads `error` to drive UX copy.
- 500s are intentionally vague (don't leak internals); 4xx are specific (the user can act on them).

### Client error handling

```ts
useMutation({
  mutationFn: (...) => apiClient.post(...),
  onError: (err) => {
    if (isNetworkError(err)) return toast.warn('Offline — changes will retry')
    if (err.status === 400) return toast.error(err.body.error ?? 'Invalid input')
    logger.error('Unexpected mutation error', {safeMessage: err})
    toast.error('Something went wrong')
  },
})
```

---

## 7. Streaming generation (SSE)

### Server

```ts
fastify.post('/generate', {preHandler: [requireAuth]}, async (req, reply) => {
  reply.raw.setHeader('Content-Type', 'text/event-stream')
  reply.raw.setHeader('Cache-Control', 'no-cache')
  reply.raw.setHeader('X-Accel-Buffering', 'no')

  const stream = await generateAppSpecStream({...})
  for await (const chunk of stream) {
    reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`)
  }
  reply.raw.write('data: [DONE]\n\n')
  reply.raw.end()
})
```

### Client

```ts
import {createParser} from 'eventsource-parser'

const res = await fetch(url, {method: 'POST', body, headers: {Accept: 'text/event-stream'}})
const parser = createParser(({type, data}) => {
  if (type !== 'event') return
  if (data === '[DONE]') return
  const chunk = JSON.parse(data)
  onChunk(chunk)
})
const reader = res.body!.getReader()
const decoder = new TextDecoder()
while (true) {
  const {done, value} = await reader.read()
  if (done) break
  parser.feed(decoder.decode(value))
}
```

This pattern is identical for `/generate` (text streaming) and `/edit` (when streaming is enabled in M2).

---

## 8. Testing patterns

### Unit test

```ts
// apps/mobile/src/lib/projectTitle.test.ts
import {projectTitleFromSpec} from './projectTitle'

describe('projectTitleFromSpec', () => {
  it('returns the heading text when present', () => {
    expect(projectTitleFromSpec({type: 'Heading', text: 'Hello'})).toBe('Hello')
  })

  it('returns "Untitled" for spec with no headings', () => {
    expect(projectTitleFromSpec({type: 'Container', children: []})).toBe('Untitled')
  })
})
```

- Co-located with the file under test (`<file>.test.ts(x)`).
- Describe = subject under test, it = behavior in plain English.
- One assertion per `it` when practical; multiple are fine for a single behavior with multiple observable outputs.

### Renderer snapshot test

```tsx
// packages/a2ui-renderer/src/components/Button.test.tsx
import {render} from '@testing-library/react-native'
import {ButtonRenderer} from './Button'

describe('ButtonRenderer', () => {
  it('renders primary variant', () => {
    const {toJSON} = render(<ButtonRenderer node={{type: 'Button', label: 'OK', action: {type: 'toast', message: 'hi'}, variant: 'primary'}} state={{}} dispatch={jest.fn()} />)
    expect(toJSON()).toMatchSnapshot()
  })
})
```

One snapshot per props variant per component type. Updates require an explicit `--updateSnapshot` and a code-review note explaining why.

---

## 9. JSON Patch helpers

We use `fast-json-patch`:

```ts
import {applyPatch, validate} from 'fast-json-patch'

const errors = validate(patch, currentSpec)
if (errors) throw new ValidationError('invalid patch')

const result = applyPatch(currentSpec, patch, /*validate*/ true, /*mutate*/ false)
const newSpec = result.newDocument
A2UISchema.parse(newSpec) // throws if structurally invalid
```

`mutate: false` is mandatory — we never mutate the stored spec. Every edit produces a new `project_versions` row.

---

## 10. Common gotchas

### Expo Go vs dev-client

- **Expo Go does NOT support our project** because we use `react-native-mmkv`, `@sentry/react-native`, and `expo-secure-store` with native dependencies that aren't in the Expo Go bundle.
- Always use `eas build --profile development` to produce a dev-client build, then run `expo start --dev-client`.

### EAS Secrets

- App-side env vars must start with `EXPO_PUBLIC_` to be readable in app code; everything else is build-time only.
- API keys for the backend live in the host's secret manager, not in EAS Secrets — the mobile app talks to the API, not to Anthropic directly.

### `buildNumber` on iOS

- App Store Connect rejects re-uploaded binaries with the same `buildNumber`. Bump every time, even after a failed build.

### Postgres migrations on Drizzle

- Generate with `pnpm drizzle-kit generate`, review the SQL, commit both the schema diff and the generated SQL file.
- Never edit a committed migration. Always add a new one.

---

## 11. Things you do **not** do

- Don't run `git push --force` on a shared branch.
- Don't add a UI kit dependency. The list in ARCHITECTURE.md §14 is the closure.
- Don't call the Anthropic SDK from a route handler (`services/api/src/llm/` is the only allowed home).
- Don't store tokens in MMKV or AsyncStorage. Only `expo-secure-store`.
- Don't bypass the A2UI catalog by emitting JSX from the LLM. The catalog is the contract.
- Don't `console.log`. Use the logger.
- Don't write `// TODO: confirm with architect` comments. If you need clarity, raise a block per `rn-executor.md`.
