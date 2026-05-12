/**
 * RunFailedBanner — render-error fallback (canvas-v0-ux.md §Screen 4a).
 *
 * Shown when the RenderErrorBoundary catches a spec render crash.
 * Also used for general fetch-error states.
 *
 * Layout:
 *   - alert-triangle icon (placeholder text in V0)
 *   - Headline: "This tool didn't render."
 *   - Subhead: "Something went wrong. Try recreating it."
 *   - Primary: "Back to Library"
 *   - Secondary: "Recreate" (→ Create with original prompt)
 *
 * T-0011-274, T-0011-275, T-0011-276, T-0011-282.
 */
import {Pressable, StyleSheet, Text, View} from 'react-native'

import {useAppShellTheme} from '#/theme/AppShellThemeProvider'
import {runCopy} from './copy'

interface RunFailedBannerProps {
  onBackToLibrary: () => void
  onRecreate?: () => void
  /** Override headline copy (used for 404/not-found state). */
  headlineOverride?: string
  /** Hide the Recreate CTA (e.g. for 404 states). */
  hideRecreate?: boolean
}

export function RunFailedBanner({
  onBackToLibrary,
  onRecreate,
  headlineOverride,
  hideRecreate = false,
}: RunFailedBannerProps) {
  const theme = useAppShellTheme()

  return (
    <View style={styles.container} testID="run-failed-banner">
      {/* Icon — alert-triangle placeholder */}
      <Text style={styles.icon} accessibilityElementsHidden>
        {'⚠'}
      </Text>

      <Text
        style={[
          styles.headline,
          {
            fontSize: theme.type.h1.size,
            fontWeight: String(theme.type.h1.weight) as '700',
            lineHeight: theme.type.h1.lineHeight,
            color: theme.fg,
          },
        ]}
        accessibilityRole="header"
        testID="run-failed-headline"
      >
        {headlineOverride ?? runCopy.renderErrorHeadline}
      </Text>

      {!headlineOverride ? (
        <Text
          style={[
            styles.body,
            {
              fontSize: theme.type.body.size,
              fontWeight: String(theme.type.body.weight) as '400',
              lineHeight: theme.type.body.lineHeight,
              color: theme['fg-muted'],
            },
          ]}
          testID="run-failed-body"
        >
          {runCopy.renderErrorBody}
        </Text>
      ) : null}

      <Pressable
        onPress={onBackToLibrary}
        accessibilityRole="button"
        accessibilityLabel={runCopy.renderErrorBackCta}
        style={[styles.button, {borderColor: theme.divider}]}
        testID="run-failed-back"
      >
        <Text
          style={{
            fontSize: theme.type.body.size,
            fontWeight: '600',
            color: theme.fg,
          }}
        >
          {runCopy.renderErrorBackCta}
        </Text>
      </Pressable>

      {!hideRecreate && onRecreate ? (
        <Pressable
          onPress={onRecreate}
          accessibilityRole="button"
          accessibilityLabel={runCopy.renderErrorRecreateCta}
          style={styles.textButton}
          testID="run-failed-recreate"
        >
          <Text
            style={{
              fontSize: theme.type.body.size,
              color: theme.accent,
              fontWeight: '600',
            }}
          >
            {runCopy.renderErrorRecreateCta}
          </Text>
        </Pressable>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  icon: {
    fontSize: 48,
    marginBottom: 8,
  },
  headline: {
    textAlign: 'center',
  },
  body: {
    textAlign: 'center',
  },
  button: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  textButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
})
