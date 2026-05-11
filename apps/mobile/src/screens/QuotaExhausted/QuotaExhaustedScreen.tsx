/**
 * QuotaExhaustedScreen — full-screen takeover when the server returns
 * HTTP 429 with error=quota_exhausted.
 *
 * ADR-0011 Step 9 + Sable's canvas-v0-ux.md §Screen 3c.
 *
 * Layout:
 *   - Hourglass illustration (64pt icon on 120pt warning-tinted circle)
 *   - Headline: "You've hit the daily limit"
 *   - Body: relative reset time (e.g. "Your limit resets in 3h 22m")
 *   - "Got it" button → pop to Library
 *
 * T-0011-223..226.
 * T-0011-224: hourglass + headline + relative reset time
 * T-0011-225: "Got it" tap → pop to Library
 * T-0011-226: headline + body in accessibilityLiveRegion="polite"
 * T-0011-242: snapshot
 */
import {useCallback} from 'react'
import {Pressable, StyleSheet, Text, View} from 'react-native'

import {SafeContainer} from '#/components/SafeContainer'
import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

import type {NativeStackScreenProps} from '@react-navigation/native-stack'
import type {RootStackParamList} from '#/lib/routes/types'

type Props = NativeStackScreenProps<RootStackParamList, 'QuotaExhausted'>

function formatResetTime(resetAt: string): string {
  const now = Date.now()
  const resetMs = new Date(resetAt).getTime()
  const diffMs = Math.max(0, resetMs - now)
  const diffMin = Math.floor(diffMs / 60_000)
  const hours = Math.floor(diffMin / 60)
  const mins = diffMin % 60

  if (hours > 0 && mins > 0) {
    return `Your limit resets in ${hours}h ${mins}m`
  } else if (hours > 0) {
    return `Your limit resets in ${hours}h`
  } else if (mins > 0) {
    return `Your limit resets in ${mins}m`
  }
  return 'Your limit resets shortly'
}

export function QuotaExhaustedScreen({route, navigation}: Props) {
  const theme = useAppShellTheme()
  const {resetAt} = route.params

  const resetMessage = formatResetTime(resetAt)

  const handleGotIt = useCallback(() => {
    // T-0011-225: pop to Library — use popToTop so the back-button history
    // doesn't loop through Create → Generating → here.
    // Note: Step 11's navigator restructure may revisit this if Library moves
    // out of the root stack.
    navigation.popToTop()
  }, [navigation])

  const bodyStyle = {
    fontSize: theme.type.body.size,
    fontWeight: String(theme.type.body.weight) as '400',
    lineHeight: theme.type.body.lineHeight,
  }

  return (
    <SafeContainer>
      <View style={styles.root} testID="quota-exhausted-root">
        {/* Hourglass illustration */}
        <View
          style={[
            styles.iconCircle,
            {backgroundColor: theme.warning + '33'}, // 20% opacity warning tint
          ]}
          testID="quota-exhausted-icon"
        >
          <Text style={styles.hourglass}>⏳</Text>
        </View>

        {/* Headline + body in accessibilityLiveRegion="polite" (T-0011-226) */}
        <View accessibilityLiveRegion="polite" style={styles.textBlock}>
          <Text
            style={[
              bodyStyle,
              styles.headline,
              {color: theme.fg, fontWeight: '600'},
            ]}
            accessibilityRole="header"
            testID="quota-exhausted-headline"
          >
            {"You've hit the daily limit"}
          </Text>

          <Text
            style={[bodyStyle, styles.body, {color: theme['fg-muted']}]}
            testID="quota-exhausted-reset-time"
          >
            {resetMessage}
          </Text>
        </View>

        {/* "Got it" button */}
        <Pressable
          onPress={handleGotIt}
          accessibilityRole="button"
          accessibilityLabel="Got it"
          hitSlop={{top: 8, bottom: 8, left: 8, right: 8}}
          style={[
            styles.gotItButton,
            {
              backgroundColor: theme.accent,
              borderRadius: theme.radii['radius-md'],
            },
          ]}
          testID="quota-exhausted-got-it"
        >
          <Text style={[bodyStyle, {color: theme['accent-fg'], fontWeight: '600'}]}>
            Got it
          </Text>
        </Pressable>
      </View>
    </SafeContainer>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 24,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  hourglass: {
    fontSize: 64,
  },
  textBlock: {
    alignItems: 'center',
    gap: 8,
  },
  headline: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
  },
  gotItButton: {
    height: 48,
    minWidth: 160,
    paddingHorizontal: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
})
