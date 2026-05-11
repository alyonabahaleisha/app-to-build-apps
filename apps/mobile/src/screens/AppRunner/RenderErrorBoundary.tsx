/**
 * RenderErrorBoundary — class Error Boundary for the A2UI renderer.
 *
 * Per ADR-0003 §F: error boundaries need React class components; the renderer
 * stays a function. AppRunner is the natural host since it owns the navigation
 * primitive (Back). Error boundaries live at the app layer, not in pure-function
 * packages.
 *
 * Fallback copy is pinned per Sable UX line 307 + T-0003-110:
 *   heading:  "This app didn't render correctly."
 *   body:     "Try recreating it."
 *   button:   "Back to library"
 *
 * On componentDidCatch, emits render_failed at error level with
 * {projectId, renderHash, mode} — no raw spec content, no PII (T-0003-119).
 *
 * The class itself can't call `useTheme`, so the fallback UI is delegated to
 * the inner `RenderErrorFallback` function component which consumes theme
 * tokens via hooks. Closes Roz Step 8 Finding 1 (CLAUDE.md §1 compliance).
 */
import React from 'react'
import {Pressable, StyleSheet, Text, View} from 'react-native'

import {logger} from '#/logger'
import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

// -- Types --------------------------------------------------------------------

interface Props {
  projectId: string
  renderHash: string
  mode: 'owner'
  onBack: () => void
  children: React.ReactNode
}

interface State {
  hasError: boolean
}

// -- Inner fallback (function component — uses theme tokens) -----------------

function RenderErrorFallback({onBack}: {onBack: () => void}): React.ReactElement {
  const t = useAppShellTheme()
  return (
    <View style={styles.container} testID="render-error-fallback">
      {/* Icon placeholder — at M1 we use a text stand-in */}
      <Text style={styles.icon} accessibilityElementsHidden={true}>
        ⚠️
      </Text>

      <Text style={[styles.heading, {color: t.fg}]} accessibilityRole="header">
        This app didn't render correctly.
      </Text>

      <Text style={[styles.body, {color: t['fg-muted']}]}>Try recreating it.</Text>

      <Pressable
        onPress={onBack}
        style={[styles.button, {backgroundColor: t.accent}]}
        accessibilityRole="button"
        accessibilityLabel="Back to library"
        testID="render-error-back-button"
      >
        <Text style={[styles.buttonText, {color: t['accent-fg']}]}>Back to library</Text>
      </Pressable>
    </View>
  )
}

// -- Component ----------------------------------------------------------------

export class RenderErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {hasError: false}
  }

  static getDerivedStateFromError(_error: unknown): State {
    return {hasError: true}
  }

  componentDidCatch(error: unknown, _info: React.ErrorInfo): void {
    const {projectId, renderHash, mode} = this.props
    // Emit render_failed — payload is intentionally minimal (T-0003-119).
    // No raw spec JSON, no original_prompt, no PII.
    logger.error('render_failed', {projectId, renderHash, mode})
    if (__DEV__) {
      logger.error('RenderErrorBoundary caught', {
        safeMessage: error instanceof Error ? error.message : String(error),
      })
    }
  }

  render(): React.ReactNode {
    if (!this.state.hasError) {
      return this.props.children
    }
    return <RenderErrorFallback onBack={this.props.onBack} />
  }
}

// -- Styles (theme-agnostic structural styles only; colors via theme) --------

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
  heading: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    textAlign: 'center',
  },
  button: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
})
