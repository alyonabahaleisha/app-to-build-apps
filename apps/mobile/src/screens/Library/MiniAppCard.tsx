/**
 * MiniAppCard — one cell in the Library grid.
 *
 * Layout per Sable §Screen 2:
 *   - Cover art top (174 × 130pt, radius-md top corners)
 *   - Title row (`type-body` 600 weight, 1 line ellipsize, 8pt above)
 *   - Subtitle (`type-caption`, fg-muted, 1 line ellipsize): relative time
 *
 * Accessibility (T-0011-177):
 *   Card label: "Open <title>, <stance>, <palette> palette, created <time ago>"
 *
 * Long-press hint (T-0011-179):
 *   accessibilityHint="Long-press for options."
 *
 * Touch target ≥44pt (ARCHITECTURE.md §12):
 *   The card is full-width inside its column; height is ≥218pt from the
 *   aspect ratio spec. hitSlop is not needed — the card itself is the target.
 *
 * T-0011-162..163, T-0011-177, T-0011-179, T-0011-183, T-0011-188, T-0011-189.
 */
import {useCallback, useRef} from 'react'
import {Animated, Pressable, StyleSheet, Text, View} from 'react-native'
import * as Haptics from 'expo-haptics'

import {timeAgo} from '#/lib/timeAgo'
import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

import {libraryCopy} from './copy'

// Card dimensions per Sable §Screen 2:
//   Card aspect ratio 4:5 (174 × 218pt on iPhone 14)
//   Cover art top: 174 × 130pt
// estimatedItemSize = 130 (cover) + 56 (text) + 16 (margin) = 202pt  — T-0011-189
export const CARD_COVER_HEIGHT = 130
export const CARD_TEXT_HEIGHT = 56
export const CARD_ESTIMATED_ITEM_SIZE = 202

// Long-press scale animation: 1.0 → 0.96 over 100ms per Sable §Motion.
const LONG_PRESS_SCALE_TARGET = 0.96
const LONG_PRESS_DURATION_MS = 100

export interface MiniAppCardData {
  id: string
  title: string
  stance: string
  accentPalette: string
  coverArtSeed: string
  createdAt: string
  parentMiniAppId: string | null
}

interface Props {
  item: MiniAppCardData
  onPress: (id: string) => void
  onLongPress: (id: string) => void
  /** Optional now-override for deterministic tests. */
  now?: Date
}

export function MiniAppCard({item, onPress, onLongPress, now}: Props) {
  const theme = useAppShellTheme()
  const safeTitle = item.title.trim() === '' ? libraryCopy.cardUntitled : item.title
  const relativeTime = timeAgo(item.createdAt, now)
  const subtitle = `${libraryCopy.cardCreatedPrefix}${relativeTime}`

  // T-0011-177: "Open <title>, <stance>, <palette> palette, created <time ago>"
  const a11yLabel = `Open ${safeTitle}, ${item.stance}, ${item.accentPalette} palette, ${libraryCopy.cardCreatedPrefix}${relativeTime}`

  const scaleAnim = useRef(new Animated.Value(1)).current

  const handleLongPress = useCallback(() => {
    // 100ms scale 1.0 → 0.96 + light haptic per Sable §Motion
    Animated.timing(scaleAnim, {
      toValue: LONG_PRESS_SCALE_TARGET,
      duration: LONG_PRESS_DURATION_MS,
      useNativeDriver: true,
    }).start(() => {
      // Reset scale immediately after the sheet opens
      scaleAnim.setValue(1)
    })
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onLongPress(item.id)
  }, [scaleAnim, onLongPress, item.id])

  const handlePress = useCallback(() => {
    onPress(item.id)
  }, [onPress, item.id])

  return (
    <Animated.View
      style={[styles.animatedWrapper, {transform: [{scale: scaleAnim}]}]}
      testID="mini-app-card"
    >
      <Pressable
        onPress={handlePress}
        onLongPress={handleLongPress}
        accessibilityRole="button"
        accessibilityLabel={a11yLabel}
        accessibilityHint="Long-press for options."
        style={[
          styles.card,
          {
            backgroundColor: theme['bg-elevated'],
            borderColor: theme.divider,
            borderRadius: theme.radii['radius-md'],
          },
        ]}
      >
        {/* Cover art placeholder — cover-art-seed determines the real SVG
            (packages/design-system/coverArt.ts). This Step 8 renders the
            colored placeholder; the real SVG is wired in a later step. */}
        <View
          style={[
            styles.coverArt,
            {backgroundColor: theme['bg-overlay']},
          ]}
          testID="card-cover-art"
        />

        <View style={styles.textBlock}>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[
              styles.title,
              {
                fontSize: theme.type.body.size,
                fontWeight: '600' as const,
                lineHeight: theme.type.body.lineHeight,
                color: theme.fg,
              },
            ]}
            testID="card-title"
          >
            {safeTitle}
          </Text>
          <Text
            numberOfLines={1}
            ellipsizeMode="tail"
            style={[
              {
                fontSize: theme.type.caption.size,
                fontWeight: String(theme.type.caption.weight) as '400',
                lineHeight: theme.type.caption.lineHeight,
                color: theme['fg-muted'],
              },
            ]}
            testID="card-subtitle"
          >
            {subtitle}
          </Text>
        </View>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  animatedWrapper: {
    flex: 1,
  },
  card: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  coverArt: {
    height: CARD_COVER_HEIGHT,
  },
  textBlock: {
    paddingTop: 8,
    paddingHorizontal: 8,
    paddingBottom: 8,
    height: CARD_TEXT_HEIGHT,
    gap: 2,
  },
  title: {},
})
