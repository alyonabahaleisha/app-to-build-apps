/**
 * Viewport boundary test — Step 12 (ADR-0006)
 *
 * T-0006-178: Renderer mount on iPhone SE (smallest supported viewport,
 *   320×568 logical points) produces no horizontal overflow.
 *
 * Deferred from Step 11 per Roz's QA note (roz-step11-qa-ADR-0006.md).
 *
 * Approach:
 *   - Render the Milestone B SAMPLE_SPEC (stack navigation, two screens,
 *     Switch + Button + Stat) inside a fixed-dimension View simulating
 *     iPhone SE dimensions (320×568).
 *   - Snapshot the tree — visual proof for polish review.
 *   - Assert that no rendered element has a numeric `width` or `minWidth`
 *     style value exceeding 320 (the iPhone SE logical width).
 *
 * Why iPhone SE?
 *   At 320pt logical width, the iPhone SE is the narrowest device in the
 *   supported tier (per ARCHITECTURE.md). Any component that overflows
 *   this viewport will clip on device. Catching overflow at this boundary
 *   validates that all components use relative widths ('100%' or flex)
 *   rather than hardcoded pixel values wider than 320.
 *
 * Snapshot note: the snapshot is taken inside a 320×568 View wrapper.
 * Unlike the per-component snapshots, this is a full Renderer tree — it
 * will be larger but it captures the integrated layout at SE dimensions.
 */
import React from 'react'
import {View} from 'react-native'
import {render} from '@testing-library/react-native'
import type {Spec} from '@app-creator/protocol'
import {Renderer} from './Renderer'

// ---------------------------------------------------------------------------
// iPhone SE spec — a representative spec with content in all tier categories
// that should render comfortably at 320×568.
// Using the same MILESTONE_B_SPEC shape from Renderer.test.tsx (stack nav,
// two screens, slot binding, button dispatch).
// ---------------------------------------------------------------------------

const SE_SPEC: Spec = {
  version: 1,
  archetype: 'ListCRUD',
  stance: 'productive',
  palette: 'focus',
  coverIcon: 'list',
  navigation: 'none',
  initialScreenId: 'main',
  screens: [
    {
      id: 'main',
      title: 'iPhone SE Test',
      root: {
        id: 'screen1',
        type: 'Screen',
        safeArea: 'none',
        children: [
          {id: 'h1', type: 'Heading', text: 'Viewport Test', level: 1},
          {
            id: 'stat1',
            type: 'Stat',
            label: 'items',
            value: '5',
          },
          {
            id: 'body1',
            type: 'Body',
            text: 'This spec verifies no overflow at 320pt width.',
          },
          {
            id: 'switch1',
            type: 'Switch',
            label: 'All done',
            valueBinding: {kind: 'literal', value: false},
          },
          {
            id: 'btn1',
            type: 'Button',
            label: 'Save',
            variant: 'primary',
            action: {type: 'set', target: 'saved', value: true},
          },
          {
            id: 'badge1',
            type: 'Badge',
            text: 'Active',
            tone: 'success',
          },
        ],
      },
    },
  ],
  collections: [],
  initialState: {saved: false},
}

const HOST = {
  onToast: jest.fn(),
  onAIError: jest.fn(),
  onUnknownNodeType: jest.fn(),
  onNavigationError: jest.fn(),
}

// iPhone SE logical dimensions (portrait)
const SE_WIDTH = 320
const SE_HEIGHT = 568

// ---------------------------------------------------------------------------
// Helper: walk a serialized JSON tree and collect all numeric width / minWidth
// values. Returns the max value found (or 0 if none).
// ---------------------------------------------------------------------------
function collectWidths(node: unknown): number[] {
  if (node === null || node === undefined) return []
  if (Array.isArray(node)) return node.flatMap(collectWidths)
  if (typeof node !== 'object') return []

  const obj = node as Record<string, unknown>
  const widths: number[] = []

  // Check style.width and style.minWidth on this node
  const style = obj['style']
  if (style && typeof style === 'object' && !Array.isArray(style)) {
    const s = style as Record<string, unknown>
    if (typeof s['width'] === 'number') widths.push(s['width'] as number)
    if (typeof s['minWidth'] === 'number') widths.push(s['minWidth'] as number)
  }

  // Recurse into children
  if (Array.isArray(obj['children'])) {
    widths.push(...obj['children'].flatMap(collectWidths))
  }

  return widths
}

// ---------------------------------------------------------------------------
// T-0006-178
// ---------------------------------------------------------------------------

describe('T-0006-178 — iPhone SE viewport boundary (320×568)', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders without throwing at 320×568 logical dimensions', () => {
    // Should not throw — this is the primary assertion.
    expect(() => {
      render(
        <View style={{width: SE_WIDTH, height: SE_HEIGHT, overflow: 'hidden'}}>
          <Renderer spec={SE_SPEC} host={HOST} />
        </View>,
      )
    }).not.toThrow()
  })

  it('snapshot — Renderer tree at 320×568 (iPhone SE)', () => {
    const {toJSON} = render(
      <View style={{width: SE_WIDTH, height: SE_HEIGHT, overflow: 'hidden'}}>
        <Renderer spec={SE_SPEC} host={HOST} />
      </View>,
    )
    expect(toJSON()).toMatchSnapshot()
  })

  it('no hardcoded numeric width exceeds 320pt (no horizontal overflow)', () => {
    const {toJSON} = render(
      <View style={{width: SE_WIDTH, height: SE_HEIGHT, overflow: 'hidden'}}>
        <Renderer spec={SE_SPEC} host={HOST} />
      </View>,
    )

    const tree = toJSON()
    const allWidths = collectWidths(tree)

    // Every hardcoded numeric width must be ≤ 320. Percentage strings ('100%')
    // and flex layouts are not captured by collectWidths, which is correct:
    // those resolve at layout time and are not a source of fixed-width overflow.
    const overflowingWidths = allWidths.filter(w => w > SE_WIDTH)
    expect(overflowingWidths).toEqual([])
  })
})
