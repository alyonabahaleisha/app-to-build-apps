/**
 * Projects domain — TanStack Query hooks for the user's project list and
 * individual project detail.
 *
 * Per CLAUDE.md §2: query keys via `createQueryKey` (no inline literals);
 * fetcher routed through `apiFetch`. Endpoints are auth-required
 * (`apiFetch`'s default classification handles that).
 *
 * ADR-0002 Step 7: URLs updated from /projects → /me/projects and
 * /projects/:id → /me/projects/:id. Query cache keys are unchanged
 * (internal concern, independent of the wire path).
 *
 * Defense-in-depth shape validation — T-0001-136 requires the client to
 * detect a mismatched server payload and surface it as an error (rather
 * than letting malformed data render). zod is not on the mobile dependency
 * list, so we hand-roll a tiny validator. It returns a typed array on
 * success and throws `ProjectListShapeError` on mismatch — TanStack Query
 * propagates the throw into the `error` slot of the query result.
 */
import {useQuery, type UseQueryResult} from '@tanstack/react-query'

import {apiFetch} from '#/lib/api'
import {createQueryKey, STALE} from '#/state/queries/util'

// -- Public types ----------------------------------------------------------

export interface Project {
  id: string
  title: string
  updatedAt: string
  createdAt: string
  currentVersionId: string
  parentProjectId: string | null
}

// -- Errors ----------------------------------------------------------------

export class ProjectListShapeError extends Error {
  readonly issue: string
  constructor(issue: string) {
    super(`projects/list: shape mismatch — ${issue}`)
    this.name = 'ProjectListShapeError'
    this.issue = issue
  }
}

// -- Query keys ------------------------------------------------------------

export const projectsKeys = {
  all: () => createQueryKey('projects'),
  list: () => createQueryKey('projects', 'list'),
  detail: (id: string) => createQueryKey('projects', 'detail', {id}),
} as const

// -- Validator -------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isStringField(o: Record<string, unknown>, key: string): boolean {
  return typeof o[key] === 'string'
}

/**
 * Parse the server response into a typed `Project[]`. Throws
 * `ProjectListShapeError` on mismatch. Exported for direct unit testing
 * and for the test harness that needs to verify T-0001-136.
 */
export function parseProjectListResponse(raw: unknown): Project[] {
  if (!isObject(raw)) {
    throw new ProjectListShapeError('response is not an object')
  }
  const projects = raw.projects
  if (!Array.isArray(projects)) {
    throw new ProjectListShapeError('"projects" is not an array')
  }
  const out: Project[] = []
  for (let i = 0; i < projects.length; i++) {
    const p = projects[i]
    if (!isObject(p)) {
      throw new ProjectListShapeError(`projects[${i}] is not an object`)
    }
    if (!isStringField(p, 'id') || !UUID_RE.test(p.id as string)) {
      throw new ProjectListShapeError(`projects[${i}].id missing or not uuid`)
    }
    if (!isStringField(p, 'title')) {
      throw new ProjectListShapeError(`projects[${i}].title missing`)
    }
    if (!isStringField(p, 'updatedAt')) {
      throw new ProjectListShapeError(`projects[${i}].updatedAt missing`)
    }
    if (!isStringField(p, 'createdAt')) {
      throw new ProjectListShapeError(`projects[${i}].createdAt missing`)
    }
    if (!isStringField(p, 'currentVersionId') || !UUID_RE.test(p.currentVersionId as string)) {
      throw new ProjectListShapeError(`projects[${i}].currentVersionId missing or not uuid`)
    }
    // parentProjectId is nullable; accept null or a uuid string.
    const parent = p.parentProjectId
    if (parent !== null && parent !== undefined) {
      if (typeof parent !== 'string' || !UUID_RE.test(parent)) {
        throw new ProjectListShapeError(`projects[${i}].parentProjectId not uuid or null`)
      }
    }
    out.push({
      id: p.id as string,
      title: p.title as string,
      updatedAt: p.updatedAt as string,
      createdAt: p.createdAt as string,
      currentVersionId: p.currentVersionId as string,
      parentProjectId: typeof parent === 'string' ? parent : null,
    })
  }
  return out
}

// -- Hook ------------------------------------------------------------------

/**
 * `useProjectsListQuery` — fetches GET /me/projects, validates the shape,
 * and returns `Project[]` sorted by `updatedAt DESC`.
 *
 * The server already sorts; we don't re-sort here. If the server contract
 * changes, the test that asserts ordering (T-0001-104) will catch it.
 */
export function useProjectsListQuery(): UseQueryResult<Project[], Error> {
  return useQuery<Project[], Error>({
    queryKey: projectsKeys.list(),
    queryFn: async () => {
      const data = await apiFetch<unknown>('/me/projects')
      return parseProjectListResponse(data)
    },
    staleTime: STALE.MINUTES(5),
    retry: false,
  })
}

// -- Detail shape ----------------------------------------------------------

export interface ProjectDetail {
  project: {
    id: string
    ownerId: string
    title: string
    currentVersionId: string
    parentProjectId: string | null
    createdAt: string
    updatedAt: string
    /**
     * Visibility is set by the marketplace publish/unpublish flow (ADR-0002
     * Step 9). The server's GET /me/projects/:id response includes this field.
     * Absent on older responses or if the server hasn't been updated yet —
     * defaults to 'private' defensively.
     */
    visibility: 'public' | 'private'
  }
  currentVersion: {
    id: string
    projectId: string
    specJson: unknown
    renderHash: string
    createdAt: string
  }
}

export class ProjectDetailShapeError extends Error {
  readonly issue: string
  constructor(issue: string) {
    super(`projects/detail: shape mismatch — ${issue}`)
    this.name = 'ProjectDetailShapeError'
    this.issue = issue
  }
}

/**
 * Parse the server response for GET /me/projects/:id into a typed
 * `ProjectDetail`. Throws `ProjectDetailShapeError` on mismatch.
 * Exported for direct unit testing.
 */
export function parseProjectDetailResponse(raw: unknown): ProjectDetail {
  if (!isObject(raw)) {
    throw new ProjectDetailShapeError('response is not an object')
  }
  if (!isObject(raw.project)) {
    throw new ProjectDetailShapeError('"project" is not an object')
  }
  if (!isObject(raw.currentVersion)) {
    throw new ProjectDetailShapeError('"currentVersion" is not an object')
  }
  const p = raw.project
  const v = raw.currentVersion
  if (!isStringField(p, 'id') || !UUID_RE.test(p.id as string)) {
    throw new ProjectDetailShapeError('project.id missing or not uuid')
  }
  if (!isStringField(p, 'ownerId')) {
    throw new ProjectDetailShapeError('project.ownerId missing')
  }
  if (!isStringField(p, 'title')) {
    throw new ProjectDetailShapeError('project.title missing')
  }
  if (!isStringField(p, 'currentVersionId') || !UUID_RE.test(p.currentVersionId as string)) {
    throw new ProjectDetailShapeError('project.currentVersionId missing or not uuid')
  }
  const parent = p.parentProjectId
  if (parent !== null && parent !== undefined) {
    if (typeof parent !== 'string' || !UUID_RE.test(parent)) {
      throw new ProjectDetailShapeError('project.parentProjectId not uuid or null')
    }
  }
  if (!isStringField(p, 'createdAt')) {
    throw new ProjectDetailShapeError('project.createdAt missing')
  }
  if (!isStringField(p, 'updatedAt')) {
    throw new ProjectDetailShapeError('project.updatedAt missing')
  }
  if (!isStringField(v, 'id') || !UUID_RE.test(v.id as string)) {
    throw new ProjectDetailShapeError('currentVersion.id missing or not uuid')
  }
  if (!isStringField(v, 'projectId') || !UUID_RE.test(v.projectId as string)) {
    throw new ProjectDetailShapeError('currentVersion.projectId missing or not uuid')
  }
  if (!isStringField(v, 'renderHash')) {
    throw new ProjectDetailShapeError('currentVersion.renderHash missing')
  }
  if (!isStringField(v, 'createdAt')) {
    throw new ProjectDetailShapeError('currentVersion.createdAt missing')
  }
  // visibility is optional in the current server response — default to 'private'
  // if absent. Present once the marketplace endpoints land (ADR-0002 Step 9).
  const rawVisibility = p.visibility
  const visibility: 'public' | 'private' = rawVisibility === 'public' ? 'public' : 'private'

  return {
    project: {
      id: p.id as string,
      ownerId: p.ownerId as string,
      title: p.title as string,
      currentVersionId: p.currentVersionId as string,
      parentProjectId: typeof parent === 'string' ? parent : null,
      createdAt: p.createdAt as string,
      updatedAt: p.updatedAt as string,
      visibility,
    },
    currentVersion: {
      id: v.id as string,
      projectId: v.projectId as string,
      specJson: v.specJson,
      renderHash: v.renderHash as string,
      createdAt: v.createdAt as string,
    },
  }
}

/**
 * `useProjectQuery` — fetches GET /me/projects/:id, validates the shape,
 * and returns `ProjectDetail`. Returns 404 errors as query errors.
 */
export function useProjectQuery(
  projectId: string | undefined,
): UseQueryResult<ProjectDetail, Error> {
  return useQuery<ProjectDetail, Error>({
    queryKey: projectsKeys.detail(projectId ?? ''),
    queryFn: async () => {
      const data = await apiFetch<unknown>(`/me/projects/${projectId}`)
      return parseProjectDetailResponse(data)
    },
    staleTime: STALE.MINUTES(5),
    retry: false,
    enabled: !!projectId,
  })
}
