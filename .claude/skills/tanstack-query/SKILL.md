---
description: "TanStack Query skill: data fetching patterns, query keys, mutations, cache management for Bluesky Social App"
user-invocable: false
---

# TanStack Query Skill

Reference for data fetching patterns in the Bluesky Social App using TanStack Query (React Query).

## Query Pattern

```typescript
import {useQuery} from '@tanstack/react-query'
import {createQueryKey} from '#/state/queries/util'
import {useAgent} from '#/state/session'

const featureQueryKeyRoot = 'feature'

export const createFeatureQueryKey = (args: {id: string}) =>
  createQueryKey(featureQueryKeyRoot, args)

export function useFeatureQuery({id}: {id: string}) {
  const agent = useAgent()

  return useQuery({
    queryKey: createFeatureQueryKey({id}),
    queryFn: async () => {
      const res = await agent.app.bsky.feature.get({id})
      return res.data
    },
    staleTime: STALE.MINUTES.FIVE,
    enabled: !!id,
  })
}
```

## Mutation Pattern

```typescript
import {useMutation, useQueryClient} from '@tanstack/react-query'

export function useFeatureMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data) => { /* ... */ },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: createFeatureQueryKey({id: variables.id}),
      })
    },
    onError: (error) => {
      if (isNetworkError(error)) {
        // inform user, don't log
      } else {
        logger.error('Error', {safeMessage: error})
      }
    },
  })
}
```

## Paginated Queries

```typescript
import {useInfiniteQuery} from '@tanstack/react-query'

export function useFeatureListQuery() {
  const agent = useAgent()

  return useInfiniteQuery({
    queryKey: createQueryKey('featureList'),
    queryFn: async ({pageParam}) => {
      const res = await agent.app.bsky.feature.list({cursor: pageParam})
      return res.data
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: page => page.cursor,
  })
}

// Get all items: data?.pages.flatMap(page => page.items) ?? []
```

## Stale Time Constants

From `src/state/queries/index.ts`:
```typescript
STALE.SECONDS.FIFTEEN  // 15s
STALE.MINUTES.ONE      // 1m
STALE.MINUTES.FIVE     // 5m
STALE.HOURS.ONE        // 1h
STALE.INFINITY         // never stale
```

## Cache Mutation

```typescript
export function useFeatureCacheMutation() {
  const queryClient = useQueryClient()

  return (data: Partial<Feature>) => {
    queryClient.setQueryData(
      createFeatureQueryKey({id: data.id}),
      oldData => oldData ? {...oldData, ...data} : oldData
    )
  }
}
```

## Persisted Queries

```typescript
export const createFeatureQueryKey = (args: {id: string}) =>
  createQueryKey(featureQueryKeyRoot, args, {persistedVersion: 1})
```

Increment `persistedVersion` when data shape changes.

## Rules

1. **Use `createQueryKey`** helper for all query keys
2. **Name hooks `use[Name]Query`** for discoverability
3. **Always set `staleTime`** — don't rely on defaults
4. **Use `enabled` flag** to prevent queries from running with missing params
5. **Handle errors in `onError`** — network errors vs unexpected errors
6. **Use `useInfiniteQuery`** for paginated AT Protocol APIs
