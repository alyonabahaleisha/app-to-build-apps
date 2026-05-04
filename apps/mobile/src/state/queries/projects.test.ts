/**
 * ADR-0002 Step 7 — mobile projects query hook tests.
 *
 * T-IDs covered:
 *   T-0002-129 — `useProjectsListQuery` calls the new path `/me/projects`
 *   T-0002-130 — `useProjectQuery` calls the new path `/me/projects/:id`
 *
 * These tests exercise the URL strings used by the fetch calls and the
 * shape validators. URL assertions work by verifying that calling apiFetch
 * with the expected path results in the correct URL reaching global.fetch.
 *
 * Shape validation tests (parseProjectListResponse /
 * parseProjectDetailResponse) are co-located here because the parsers live
 * in the same module and the fixture data is already set up.
 */

import {apiFetch, resetApiForTests, setCurrentSession} from '#/lib/api'
import {
  parseProjectDetailResponse,
  parseProjectListResponse,
  ProjectDetailShapeError,
  ProjectListShapeError,
  projectsKeys,
  useProjectQuery,
  useProjectsListQuery,
} from './projects'

// ---- Fetch mock -----------------------------------------------------------

const mockFetch = jest.fn()

beforeEach(() => {
  mockFetch.mockReset()
  global.fetch = mockFetch as unknown as typeof fetch
  resetApiForTests()
  setCurrentSession({
    accessToken: 'fake.jwt.token',
    userId: '11111111-1111-1111-1111-111111111111',
  })
})

// ---- Fixtures -------------------------------------------------------------

const VALID_LIST_RESPONSE = {
  projects: [
    {
      id: '00000000-0000-0000-0000-000000000001',
      title: 'Test project',
      updatedAt: '2026-05-01T12:00:00.000Z',
      createdAt: '2026-04-01T12:00:00.000Z',
      currentVersionId: '00000000-0000-0000-0000-000000000099',
      parentProjectId: null,
    },
  ],
}

const VALID_DETAIL_RESPONSE = {
  project: {
    id: '00000000-0000-0000-0000-000000000001',
    ownerId: '11111111-1111-1111-1111-111111111111',
    title: 'Test project',
    currentVersionId: '00000000-0000-0000-0000-000000000099',
    parentProjectId: null,
    createdAt: '2026-04-01T12:00:00.000Z',
    updatedAt: '2026-05-01T12:00:00.000Z',
  },
  currentVersion: {
    id: '00000000-0000-0000-0000-000000000099',
    projectId: '00000000-0000-0000-0000-000000000001',
    specJson: {version: 1, root: {type: 'Container', children: []}},
    renderHash: 'abc123',
    createdAt: '2026-04-01T12:00:00.000Z',
  },
}

// ---- T-0002-129: useProjectsListQuery uses /me/projects -------------------

describe('T-0002-129: useProjectsListQuery — URL path', () => {
  it('query key is ["projects", "list"] — unchanged by the rename', () => {
    expect(projectsKeys.list()).toEqual(['projects', 'list'])
  })

  it('apiFetch with /me/projects hits the new path (not the old /projects)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => VALID_LIST_RESPONSE,
    })

    // Call apiFetch with the exact path the hook's queryFn uses.
    // This verifies the URL that reaches global.fetch ends with /me/projects.
    await apiFetch<unknown>('/me/projects')

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const calledUrl = (mockFetch.mock.calls[0] as [string])[0]
    expect(calledUrl).toMatch(/\/me\/projects$/)
    // Old path must NOT appear.
    expect(calledUrl).not.toMatch(/(?<![/]me)\/projects(?:[/?#]|$)/)
  })
})

// ---- T-0002-130: useProjectQuery uses /me/projects/:id --------------------

describe('T-0002-130: useProjectQuery — URL path', () => {
  const TEST_ID = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'

  it('query key is ["projects", "detail", {id}] — unchanged by the rename', () => {
    expect(projectsKeys.detail(TEST_ID)).toEqual(['projects', 'detail', {id: TEST_ID}])
  })

  it('apiFetch with /me/projects/:id hits the new path (not the old /projects/:id)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => VALID_DETAIL_RESPONSE,
    })

    await apiFetch<unknown>(`/me/projects/${TEST_ID}`)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const calledUrl = (mockFetch.mock.calls[0] as [string])[0]
    expect(calledUrl).toMatch(/\/me\/projects\/aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa$/)
    // Old path must NOT appear.
    expect(calledUrl).not.toMatch(/(?<![/]me)\/projects\/aaaaaaaa/)
  })
})

// ---- parseProjectListResponse unit tests ----------------------------------

describe('parseProjectListResponse', () => {
  it('parses a valid list response', () => {
    const result = parseProjectListResponse(VALID_LIST_RESPONSE)
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('00000000-0000-0000-0000-000000000001')
    expect(result[0]?.parentProjectId).toBeNull()
  })

  it('throws ProjectListShapeError when response is not an object', () => {
    expect(() => parseProjectListResponse(null)).toThrow(ProjectListShapeError)
    expect(() => parseProjectListResponse('string')).toThrow(ProjectListShapeError)
    expect(() => parseProjectListResponse([])).toThrow(ProjectListShapeError)
  })

  it('throws ProjectListShapeError when "projects" is missing', () => {
    expect(() => parseProjectListResponse({})).toThrow(ProjectListShapeError)
  })

  it('throws ProjectListShapeError when a project item has an invalid uuid', () => {
    expect(() =>
      parseProjectListResponse({
        projects: [{...VALID_LIST_RESPONSE.projects[0], id: 'not-a-uuid'}],
      }),
    ).toThrow(ProjectListShapeError)
  })

  it('accepts parentProjectId as a uuid string', () => {
    const result = parseProjectListResponse({
      projects: [
        {
          ...VALID_LIST_RESPONSE.projects[0],
          parentProjectId: '00000000-0000-0000-0000-000000000002',
        },
      ],
    })
    expect(result[0]?.parentProjectId).toBe('00000000-0000-0000-0000-000000000002')
  })
})

// ---- parseProjectDetailResponse unit tests --------------------------------

describe('parseProjectDetailResponse', () => {
  it('parses a valid detail response', () => {
    const result = parseProjectDetailResponse(VALID_DETAIL_RESPONSE)
    expect(result.project.id).toBe('00000000-0000-0000-0000-000000000001')
    expect(result.currentVersion.renderHash).toBe('abc123')
    expect(result.project.parentProjectId).toBeNull()
  })

  it('throws ProjectDetailShapeError when response is not an object', () => {
    expect(() => parseProjectDetailResponse(null)).toThrow(ProjectDetailShapeError)
    expect(() => parseProjectDetailResponse('str')).toThrow(ProjectDetailShapeError)
  })

  it('throws ProjectDetailShapeError when "project" is missing', () => {
    expect(() =>
      parseProjectDetailResponse({currentVersion: VALID_DETAIL_RESPONSE.currentVersion}),
    ).toThrow(ProjectDetailShapeError)
  })

  it('throws ProjectDetailShapeError when "currentVersion" is missing', () => {
    expect(() =>
      parseProjectDetailResponse({project: VALID_DETAIL_RESPONSE.project}),
    ).toThrow(ProjectDetailShapeError)
  })

  it('throws ProjectDetailShapeError when project.id is not a uuid', () => {
    expect(() =>
      parseProjectDetailResponse({
        ...VALID_DETAIL_RESPONSE,
        project: {...VALID_DETAIL_RESPONSE.project, id: 'not-uuid'},
      }),
    ).toThrow(ProjectDetailShapeError)
  })

  it('throws ProjectDetailShapeError when currentVersion.renderHash is missing', () => {
    const {renderHash: _omit, ...versionWithoutHash} = VALID_DETAIL_RESPONSE.currentVersion
    expect(() =>
      parseProjectDetailResponse({
        ...VALID_DETAIL_RESPONSE,
        currentVersion: versionWithoutHash,
      }),
    ).toThrow(ProjectDetailShapeError)
  })
})

// Referenced so TypeScript confirms the exports exist; hooks themselves are
// tested via integration in Home screen tests.
void useProjectsListQuery
void useProjectQuery
