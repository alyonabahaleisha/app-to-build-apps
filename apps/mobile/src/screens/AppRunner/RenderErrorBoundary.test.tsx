/**
 * RenderErrorBoundary tests.
 *
 * Covers T-0003-110, T-0003-111, T-0003-112, T-0003-117, T-0003-118, T-0003-119.
 */
import {fireEvent, render} from '@testing-library/react-native'
import React from 'react'

import {RenderErrorBoundary} from './RenderErrorBoundary'

// -- Mocks -------------------------------------------------------------------

const mockLoggerError = jest.fn()
const mockLoggerWarn = jest.fn()

jest.mock('#/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
    warn: (...args: unknown[]) => mockLoggerWarn(...args),
    info: jest.fn(),
  },
  safeMessage: (err: unknown) => (err instanceof Error ? err.message : String(err)),
}))

// -- Helpers -----------------------------------------------------------------

/**
 * A component that unconditionally throws so we can test the boundary.
 */
function Bomb({shouldThrow}: {shouldThrow: boolean}): React.ReactElement {
  if (shouldThrow) {
    throw new Error('Renderer exploded!')
  }
  return <></>
}

function renderBoundary(opts: {
  shouldThrow?: boolean
  onBack?: jest.Mock
  projectId?: string
  renderHash?: string
}) {
  const onBack = opts.onBack ?? jest.fn()
  const projectId = opts.projectId ?? 'proj-abc'
  const renderHash = opts.renderHash ?? 'hash-abc'
  const shouldThrow = opts.shouldThrow ?? true

  // Suppress React's console.error for intentional error-boundary throws.
  const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {})

  const utils = render(
    <RenderErrorBoundary projectId={projectId} renderHash={renderHash} mode="owner" onBack={onBack}>
      <Bomb shouldThrow={shouldThrow} />
    </RenderErrorBoundary>,
  )

  consoleSpy.mockRestore()

  return {...utils, onBack}
}

// -- Tests -------------------------------------------------------------------

describe('RenderErrorBoundary', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  // T-0003-110: renders fallback with exact strings
  it('T-0003-110: renders fallback with exact copy strings when child throws', () => {
    const {getByText} = renderBoundary({shouldThrow: true})

    // Heading — exact string per Sable UX line 307
    expect(getByText("This app didn't render correctly.")).toBeTruthy()
    // Body — exact string
    expect(getByText('Try recreating it.')).toBeTruthy()
    // Button — exact label
    expect(getByText('Back to library')).toBeTruthy()
  })

  // T-0003-111: "Back to library" calls onBack
  it('T-0003-111: "Back to library" button calls onBack', () => {
    const onBack = jest.fn()
    const {getByTestId} = renderBoundary({shouldThrow: true, onBack})

    fireEvent.press(getByTestId('render-error-back-button'))
    expect(onBack).toHaveBeenCalledTimes(1)
  })

  // T-0003-112: render_failed log emitted with {projectId, renderHash, mode:'owner'}
  it('T-0003-112: emits render_failed log with correct payload when boundary fires', () => {
    renderBoundary({
      shouldThrow: true,
      projectId: 'proj-xyz',
      renderHash: 'hash-xyz',
    })

    expect(mockLoggerError).toHaveBeenCalledWith('render_failed', {
      projectId: 'proj-xyz',
      renderHash: 'hash-xyz',
      mode: 'owner',
    })
  })

  // T-0003-117: no error boundary on navigate-to-unknown-viewId
  it('T-0003-117: children render normally when no throw occurs', () => {
    const {getByTestId} = render(
      <RenderErrorBoundary projectId="proj" renderHash="hash" mode="owner" onBack={jest.fn()}>
        {/* No throw — boundary should be transparent */}
        <></>
      </RenderErrorBoundary>,
    )

    // The fallback should NOT be present
    expect(() => getByTestId('render-error-fallback')).toThrow()
  })

  // T-0003-118: fallback copy does NOT include spec content
  it('T-0003-118: fallback does not expose spec content or prompt in visible text', () => {
    const {queryByText} = renderBoundary({shouldThrow: true})

    // None of these spec/prompt-related strings should appear
    expect(queryByText(/spec/i)).toBeNull()
    expect(queryByText(/original_prompt/i)).toBeNull()
    expect(queryByText(/specJson/i)).toBeNull()
    expect(queryByText(/views/i)).toBeNull()
  })

  // T-0003-119: log payload has no raw spec JSON or original_prompt
  it('T-0003-119: render_failed log payload has no raw spec or PII', () => {
    renderBoundary({shouldThrow: true, projectId: 'p1', renderHash: 'h1'})

    // Find the render_failed call
    const renderFailedCall = mockLoggerError.mock.calls.find(call => call[0] === 'render_failed')
    expect(renderFailedCall).toBeDefined()
    const payload = renderFailedCall![1] as Record<string, unknown>

    // Only these three keys are allowed
    expect(Object.keys(payload).sort()).toEqual(['mode', 'projectId', 'renderHash'])

    // Ensure no large blob or spec data snuck in
    expect(JSON.stringify(payload)).not.toMatch(/specJson/)
    expect(JSON.stringify(payload)).not.toMatch(/original_prompt/)
    expect(JSON.stringify(payload)).not.toMatch(/views/)
  })

  // Renders children normally when no error
  it('renders children when no error is thrown', () => {
    const {queryByTestId} = render(
      <RenderErrorBoundary projectId="p" renderHash="h" mode="owner" onBack={jest.fn()}>
        <Bomb shouldThrow={false} />
      </RenderErrorBoundary>,
    )

    // Fallback should not be visible
    expect(queryByTestId('render-error-fallback')).toBeNull()
  })
})
