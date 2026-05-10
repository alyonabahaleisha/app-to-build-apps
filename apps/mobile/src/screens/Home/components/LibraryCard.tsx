/**
 * LibraryCard — single library row per Sable's §Screen 2.
 *
 * Title (bold, 1 line, ellipsize) + subtitle ("Created {time-ago}") +
 * trailing chevron. Whole row is the hit target.
 *
 * Defense-in-depth (T-0001-111): even though the server derives titles
 * server-side (§Step 4) and falls back to "Untitled", we re-apply the
 * fallback here in case a malformed row sneaks through — a "" title on the
 * client would otherwise render as a blank line with just the subtitle.
 *
 * Step 11 (ADR-0006 F-11): adds an optional `stance` prop. When `stance`
 * is `'productive'`, a LinearGradient overlay is rendered over the cover-art
 * area — Layer 4 of the cover-art composition spec (canvas-v0-ux.md §Cover
 * Art). The overlay is host-rendered (not part of the cover-art SVG) so it
 * can be applied independently of the spec data.
 *
 * The current card has no real cover-art area (that comes in Step 12). The
 * placeholder cover area (`cover-art-area` testID) provides the mounting
 * surface for the gradient. Step 12 replaces the placeholder with the real
 * SVG from `packages/design-system/coverArt.ts`.
 */
import {LinearGradient} from 'expo-linear-gradient'
import {Feather} from '@expo/vector-icons'
import {StyleSheet, Text, View} from 'react-native'

import {Card} from '#/components/Card'
import {timeAgo} from '#/lib/timeAgo'
import {useTheme} from '#/theme'

import {homeCopy} from '../copy'

// Layer 4 gradient spec (canvas-v0-ux.md §Cover Art, Layer 4):
// Vertical linear gradient from bg-elevated at the bottom to transparent at
// 30% from the bottom — provides legibility floor for the title text below.
// bg-elevated = #FFFFFF for both stances (stance-locked, not palette-resolved).
//
// Opacity is capped at 20% (well within the ≤25% accessibility threshold)
// so the gradient tints without fully obscuring the cover-art underneath.
// Per-palette tinting: not applied — bg-elevated is palette-invariant.
const GRADIENT_OPACITY = 0.20 // ≤ 0.25 per accessibility constraint

// rgba(255,255,255,OPACITY) — bg-elevated at 20% opacity.
const BG_ELEVATED_TINTED = `rgba(255,255,255,${GRADIENT_OPACITY})`

// The overlay runs from transparent (at top of overlay area) to bg-elevated
// (at low opacity) at the bottom.
const PRODUCTIVE_GRADIENT_COLORS = ['transparent', BG_ELEVATED_TINTED] as const
const PRODUCTIVE_GRADIENT_START = {x: 0, y: 0}
const PRODUCTIVE_GRADIENT_END = {x: 0, y: 1}

interface Props {
  projectId: string
  title: string
  /** ISO timestamp from the server. */
  createdAt: string
  onPress: (projectId: string) => void
  /**
   * Visual stance of the project's spec. When `'productive'`, a Layer 4
   * gradient overlay is rendered over the cover-art area. Expressive stance
   * and undefined (M1 / pre-V0 specs) receive no overlay.
   */
  stance?: 'productive' | 'expressive'
  /** Optional now-override for deterministic tests. */
  now?: Date
}

export function LibraryCard({projectId, title, createdAt, onPress, stance, now}: Props) {
  const theme = useTheme()
  const safeTitle = title.trim() === '' ? homeCopy.cardUntitled : title
  const subtitle = `${homeCopy.cardCreatedPrefix}${timeAgo(createdAt, now)}`
  const a11yLabel = `Open ${safeTitle}, ${subtitle.toLowerCase()}`
  const isProductive = stance === 'productive'

  return (
    <Card
      onPress={() => onPress(projectId)}
      accessibilityLabel={a11yLabel}
      accessibilityRole="button"
      testID="library-card"
    >
      {/* Cover-art placeholder (Step 12 replaces with real SVG) */}
      <View style={styles.coverArt} testID="cover-art-area">
        {/* Layer 4: productive gradient overlay — canvas-v0-ux.md §Cover Art */}
        {isProductive && (
          <LinearGradient
            colors={PRODUCTIVE_GRADIENT_COLORS}
            start={PRODUCTIVE_GRADIENT_START}
            end={PRODUCTIVE_GRADIENT_END}
            style={StyleSheet.absoluteFill}
            testID="productive-gradient-overlay"
          />
        )}
      </View>

      <View style={styles.row}>
        <View style={styles.text}>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[theme.typography.heading3, {color: theme.palette.text.primary}]}
          >
            {safeTitle}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.subtitle, theme.typography.caption, {color: theme.palette.text.muted}]}
          >
            {subtitle}
          </Text>
        </View>
        <Feather
          name="chevron-right"
          size={20}
          color={theme.palette.text.muted}
          accessibilityElementsHidden
          importantForAccessibility="no"
        />
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  coverArt: {
    height: 130,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  row: {flexDirection: 'row', alignItems: 'center', gap: 12},
  text: {flex: 1, gap: 4},
  subtitle: {marginTop: 2},
})
