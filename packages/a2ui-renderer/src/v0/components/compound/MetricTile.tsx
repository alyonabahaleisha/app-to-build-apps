/**
 * MetricTileRenderer — KPI tile with optional sparkline.
 *
 * V1 Phase 1 Step 5 (T-0009-121..124, T-0009-131, T-0009-235, T-0009-236).
 *
 * Visual (per ADR-0009 Step 5):
 *   - Prominent value (h1 type scale) + label (caption, fg-muted).
 *   - Optional delta string with tone-driven color.
 *   - Optional sparkline via react-native-svg <Polyline> (NOT Skia).
 *   - Optional leading icon.
 *
 * deltaTone colors (T-0009-123):
 *   'positive' → success, 'negative' → danger, 'neutral' → fg-muted.
 *
 * Sparkline (T-0009-122):
 *   - react-native-svg <Svg> + <Polyline> — NOT Skia, NOT Victory Native.
 *   - Single-point guard (T-0009-235): sparklineData.length === 1 renders
 *     a horizontal line at the vertical midpoint. The formula
 *     (i / (points.length - 1)) * width would be 0/0 for a single point.
 *   - Without sparklineData, no sparkline area is rendered (T-0009-124).
 *   - Max 30 points accepted without truncation (T-0009-236).
 *
 * Accessibility:
 *   accessibilityRole="text" on root; accessibilityLabel combines value + label.
 *
 * T-0009-122: sparkline uses react-native-svg <Polyline>
 * T-0009-123: deltaTone colors
 * T-0009-124: no sparklineData → no sparkline rendered
 * T-0009-131: snapshots at productive×focus + expressive×health
 * T-0009-235: single-point sparkline → horizontal line at midpoint
 * T-0009-236: 30-point sparkline renders without truncation
 */
import React from 'react'
import {View, Text} from 'react-native'
import Svg, {Polyline, Line} from 'react-native-svg'
import type {Node} from '@app-creator/protocol'
import {Icon} from '@app-creator/design-system'
import {useTheme} from '../../theme/RendererThemeProvider.js'

type MetricTileNode = Extract<Node, {type: 'MetricTile'}>

// Sparkline dimensions.
const SPARKLINE_HEIGHT = 40
const SPARKLINE_WIDTH = 80

// Icon size for optional leading icon.
const ICON_SIZE = 20

// deltaTone → theme color key.
function deltaToneColor(
  deltaTone: MetricTileNode['deltaTone'],
  theme: ReturnType<typeof useTheme>,
): string {
  switch (deltaTone) {
    case 'positive':
      return theme.success
    case 'negative':
      return theme.danger
    case 'neutral':
    default:
      return theme['fg-muted']
  }
}

// Compute polyline points string from data array.
//
// Single-point guard (T-0009-235): when data.length === 1, render a horizontal
// line at the vertical midpoint. The normal formula
// (i / (data.length - 1)) * width would produce 0/0 → NaN for a single point.
//
// Returns: "x1,y1 x2,y2 ..." SVG points attribute string.
function computeSparklinePoints(
  data: readonly number[],
  width: number,
  height: number,
): string {
  if (data.length === 0) return ''

  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1 // prevent div-by-zero when all values equal

  if (data.length === 1) {
    // T-0009-235: single-point guard — horizontal line at midpoint.
    const midY = height / 2
    return `0,${midY} ${width},${midY}`
  }

  return data
    .map((value, index) => {
      const x = (index / (data.length - 1)) * width
      // Invert Y: SVG origin is top-left; higher values should be higher visually.
      const y = height - ((value - min) / range) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

function Sparkline({
  data,
  color,
}: {
  data: readonly number[]
  color: string
}) {
  const points = computeSparklinePoints(data, SPARKLINE_WIDTH, SPARKLINE_HEIGHT)

  // Single-point: render as a horizontal Line (more semantically correct).
  if (data.length === 1) {
    const midY = SPARKLINE_HEIGHT / 2
    return (
      <Svg
        width={SPARKLINE_WIDTH}
        height={SPARKLINE_HEIGHT}
        accessibilityElementsHidden
      >
        <Line
          x1={0}
          y1={midY}
          x2={SPARKLINE_WIDTH}
          y2={midY}
          stroke={color}
          strokeWidth={1.5}
        />
      </Svg>
    )
  }

  return (
    <Svg
      width={SPARKLINE_WIDTH}
      height={SPARKLINE_HEIGHT}
      accessibilityElementsHidden
    >
      <Polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  )
}

export function MetricTileRenderer({node}: {node: MetricTileNode}) {
  const theme = useTheme()

  const h1Spec = theme.type['h1']
  const captionSpec = theme.type.caption
  const microSpec = theme.type.micro

  const toneColor = deltaToneColor(node.deltaTone, theme)

  const a11yLabel =
    node.accessibilityLabel ??
    [node.value, node.label, node.delta].filter(Boolean).join(', ')

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={a11yLabel}
      style={{
        padding: theme.spacing['space-md'],
        backgroundColor: theme['bg-elevated'],
        borderRadius: theme.radii['radius-md'],
      }}
    >
      {/* Header row: optional icon + value + sparkline */}
      <View style={{flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between'}}>
        <View style={{flex: 1}}>
          {/* Optional leading icon */}
          {node.icon ? (
            <View style={{marginBottom: theme.spacing['space-xs']}} accessibilityElementsHidden>
              <Icon name={node.icon} size={ICON_SIZE} color={theme['fg-muted']} />
            </View>
          ) : null}

          {/* Value */}
          <Text
            style={{
              fontSize: h1Spec.size,
              lineHeight: h1Spec.lineHeight,
              fontWeight: String(h1Spec.weight) as '700',
              color: theme.fg,
            }}
            accessibilityElementsHidden
          >
            {node.value}
          </Text>
        </View>

        {/* Sparkline — T-0009-124: only rendered when sparklineData is present */}
        {node.sparklineData && node.sparklineData.length > 0 ? (
          <Sparkline data={node.sparklineData} color={theme.accent} />
        ) : null}
      </View>

      {/* Label */}
      <Text
        style={{
          fontSize: captionSpec.size,
          lineHeight: captionSpec.lineHeight,
          fontWeight: String(captionSpec.weight) as '400',
          color: theme['fg-muted'],
          marginTop: 2,
        }}
        accessibilityElementsHidden
      >
        {node.label}
      </Text>

      {/* Delta — T-0009-123: tone-driven color */}
      {node.delta !== undefined ? (
        <Text
          style={{
            fontSize: microSpec.size,
            lineHeight: microSpec.lineHeight,
            fontWeight: String(microSpec.weight) as '500',
            color: toneColor,
            marginTop: 2,
          }}
          accessibilityElementsHidden
        >
          {node.delta}
        </Text>
      ) : null}
    </View>
  )
}
