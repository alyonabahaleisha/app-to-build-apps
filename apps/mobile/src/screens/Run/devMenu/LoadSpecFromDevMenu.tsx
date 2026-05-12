/**
 * LoadSpecFromDevMenu — dev-only component.
 *
 * ADR-0011 Step 13. Guards every registration behind `__DEV__` so the
 * production bundle never registers the dev-menu item or the URL handler.
 *
 * Two entry points:
 *
 * 1. Dev menu item "Load spec from JSON"
 *    Opens a Gorhom Bottom Sheet with a multi-line TextInput. On submit,
 *    validates against SpecSchema (.safeParse). Invalid → inline error.
 *    Valid → builds a synthetic mini_app row (never persisted to DB) and
 *    navigates to the Run screen, injecting the spec via DevSpecContext.
 *
 * 2. URL scheme `appcreator://devmenu/load-spec?fixture=<name>`
 *    Loads a bundled fixture from __fixtures__/<name>.json.
 *    Validates + navigates. Works on both cold-start and warm-start.
 *    Unknown fixture → toast "Fixture not found".
 *
 * Telemetry suppression (T-0011-317a):
 *    This component NEVER calls writeEvent. No telemetry is emitted during
 *    the load + mount flow so grader sessions (ADR-0010) stay clean.
 *
 * T-0011-311..T-0011-320.
 */
import {BottomSheetModal, BottomSheetTextInput, BottomSheetView} from '@gorhom/bottom-sheet'
import {useCallback, useEffect, useRef, useState} from 'react'
import {DevSettings, Pressable, StyleSheet, Text, View} from 'react-native'
import * as Linking from 'expo-linking'

import {useToast} from '#/components/ToastProvider'
import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

import {SpecSchema} from '@app-creator/protocol'
import type {Spec} from '@app-creator/protocol'
import type {NavigationProp} from '@react-navigation/native'

import type {RootStackParamList} from '#/lib/routes/types'
import {useDevSpecContext, type SyntheticMiniApp} from './DevSpecContext'

// ---------------------------------------------------------------------------
// Fixture registry — bundled JSONs for URL-scheme entrypoint.
// Add new fixtures here when adding JSON files to __fixtures__/.
// ---------------------------------------------------------------------------

import exampleProductivityFixture from './__fixtures__/example-productivity.json'
import trackerFixture from './__fixtures__/tracker.json'

const FIXTURES: Record<string, unknown> = {
  'example-productivity': exampleProductivityFixture,
  tracker: trackerFixture,
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DEV_SPEC_SCHEME = 'appcreator'
const DEV_SPEC_HOST = 'devmenu'
const DEV_SPEC_PATH = '/load-spec'

/**
 * Parse a URL and return the fixture name if it matches the dev-menu scheme.
 * Returns null for unrecognised URLs.
 */
export function parseDevMenuUrl(url: string): {fixtureName: string} | null {
  try {
    const parsed = Linking.parse(url)
    if (parsed.scheme !== DEV_SPEC_SCHEME) return null
    if (parsed.hostname !== DEV_SPEC_HOST) return null
    if (parsed.path !== DEV_SPEC_PATH) return null
    const fixture = parsed.queryParams?.fixture
    if (typeof fixture !== 'string' || fixture.length === 0) return null
    return {fixtureName: fixture}
  } catch {
    return null
  }
}

/**
 * Extract a title from a spec: first Heading node's text, or 'Dev spec'.
 */
export function titleFromSpec(spec: Spec): string {
  for (const screen of spec.screens) {
    const title = findFirstHeading(screen.root)
    if (title) return title
  }
  return 'Dev spec'
}

function findFirstHeading(node: unknown): string | null {
  if (!node || typeof node !== 'object') return null
  const n = node as Record<string, unknown>
  if (n.type === 'Heading' && typeof n.text === 'string') return n.text
  if (Array.isArray(n.children)) {
    for (const child of n.children) {
      const found = findFirstHeading(child)
      if (found) return found
    }
  }
  return null
}

/**
 * Build a synthetic mini_app row. Never persisted to DB.
 * Id includes a timestamp so repeated dev loads get distinct keys,
 * avoiding stale TanStack Query cache collisions.
 */
function buildSyntheticApp(spec: Spec): SyntheticMiniApp {
  return {
    id: `devmenu-${Date.now()}`,
    title: titleFromSpec(spec),
    stance: spec.stance,
    accentPalette: spec.palette,
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export interface LoadSpecFromDevMenuProps {
  /** Passed in from the screen that mounts this component. */
  navigation: NavigationProp<RootStackParamList>
}

/**
 * Mount this component once inside the authenticated navigator tree (e.g.
 * as a sibling of the Stack.Navigator in Navigation.tsx — but since we cannot
 * touch Navigation.tsx, mount it in RunScreen or wherever DevSpecProvider lives).
 *
 * Renders nothing visible. Side-effects only:
 *   - Registers the dev-menu item (once, on mount).
 *   - Listens for the URL scheme (warm-start via Linking.addEventListener).
 *   - On cold-start: Linking.getInitialURL() is checked by the provider
 *     that calls `useDevMenuUrlHandler`.
 *
 * __DEV__ guard: registration is wrapped so it is a no-op in prod builds.
 * The guard is evaluated at runtime, which TypeScript cannot dead-strip, but
 * RN's Metro bundler strips __DEV__ blocks in release builds.
 */
export function LoadSpecFromDevMenu({navigation}: LoadSpecFromDevMenuProps) {
  const theme = useAppShellTheme()
  const toast = useToast()
  const {setDevSpec} = useDevSpecContext()
  const sheetRef = useRef<BottomSheetModal>(null)
  const [jsonText, setJsonText] = useState('')
  const [parseError, setParseError] = useState<string | null>(null)

  // ------------------------------------------------------------------
  // Core: validate + mount
  // ------------------------------------------------------------------

  const mountSpec = useCallback(
    (spec: Spec) => {
      const synthetic = buildSyntheticApp(spec)
      setDevSpec(synthetic, spec)
      navigation.navigate('Run', {miniAppId: synthetic.id})
    },
    [navigation, setDevSpec],
  )

  const handleLoadFixture = useCallback(
    (fixtureName: string) => {
      const raw = FIXTURES[fixtureName]
      if (raw === undefined) {
        toast.show('Fixture not found')
        return
      }
      const result = SpecSchema.safeParse(raw)
      if (!result.success) {
        toast.show(`Invalid fixture: ${result.error.issues[0]?.message ?? 'unknown error'}`)
        return
      }
      mountSpec(result.data)
    },
    [mountSpec, toast],
  )

  // ------------------------------------------------------------------
  // Dev-menu item registration (only in __DEV__)
  // ------------------------------------------------------------------

  useEffect(() => {
    if (!__DEV__) return
    DevSettings.addMenuItem('Load spec from JSON', () => {
      setJsonText('')
      setParseError(null)
      sheetRef.current?.present()
    })
  // addMenuItem is idempotent per RN docs — safe to register once on mount.
  }, [])

  // ------------------------------------------------------------------
  // URL scheme: warm-start listener
  // ------------------------------------------------------------------

  useEffect(() => {
    if (!__DEV__) return

    const subscription = Linking.addEventListener('url', ({url}) => {
      const parsed = parseDevMenuUrl(url)
      if (!parsed) return
      handleLoadFixture(parsed.fixtureName)
    })

    return () => subscription.remove()
  }, [handleLoadFixture])

  // ------------------------------------------------------------------
  // URL scheme: cold-start
  // ------------------------------------------------------------------

  useEffect(() => {
    if (!__DEV__) return

    void Linking.getInitialURL().then(url => {
      if (!url) return
      const parsed = parseDevMenuUrl(url)
      if (!parsed) return
      handleLoadFixture(parsed.fixtureName)
    })
  // Run once on mount. handleLoadFixture is stable (useCallback with stable deps).
  }, [])

  // ------------------------------------------------------------------
  // Sheet: JSON submit
  // ------------------------------------------------------------------

  const handleSubmit = useCallback(() => {
    setParseError(null)
    let parsed: unknown
    try {
      parsed = JSON.parse(jsonText)
    } catch {
      setParseError('Invalid JSON — check your syntax.')
      return
    }
    const result = SpecSchema.safeParse(parsed)
    if (!result.success) {
      const firstIssue = result.error.issues[0]
      setParseError(firstIssue?.message ?? 'Spec validation failed.')
      return
    }
    sheetRef.current?.dismiss()
    mountSpec(result.data)
  }, [jsonText, mountSpec])

  const handleCancel = useCallback(() => {
    sheetRef.current?.dismiss()
  }, [])

  // In prod, render nothing (registration never happened).
  if (!__DEV__) return null

  return (
    <BottomSheetModal
      ref={sheetRef}
      snapPoints={['60%']}
      backgroundStyle={{backgroundColor: theme['bg-elevated']}}
      handleIndicatorStyle={{backgroundColor: theme.divider}}
      keyboardBehavior="extend"
      keyboardBlurBehavior="restore"
    >
      <BottomSheetView>
        <View style={styles.sheet} testID="load-spec-sheet">
          <Text
            style={[
              styles.title,
              {
                fontSize: theme.type.h2.size,
                fontWeight: String(theme.type.h2.weight) as '600',
                lineHeight: theme.type.h2.lineHeight,
                color: theme.fg,
              },
            ]}
            accessibilityRole="header"
          >
            Load spec from JSON
          </Text>

          <BottomSheetTextInput
            value={jsonText}
            onChangeText={text => {
              setJsonText(text)
              setParseError(null)
            }}
            placeholder="Paste a SpecSchema JSON here…"
            placeholderTextColor={theme['fg-muted']}
            multiline
            numberOfLines={8}
            style={[
              styles.input,
              {
                fontSize: theme.type.body.size,
                color: theme.fg,
                backgroundColor: theme.bg,
                borderColor: parseError ? '#EF4444' : theme.divider,
              },
            ]}
            testID="load-spec-input"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {parseError !== null ? (
            <Text
              style={[styles.error, {color: '#EF4444'}]}
              testID="load-spec-error"
            >
              {parseError}
            </Text>
          ) : null}

          <View style={styles.buttonRow}>
            <Pressable
              onPress={handleCancel}
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              style={[styles.button, {borderColor: theme.divider}]}
              testID="load-spec-cancel"
            >
              <Text style={{color: theme['fg-muted'], fontSize: theme.type.body.size}}>
                Cancel
              </Text>
            </Pressable>

            <Pressable
              onPress={handleSubmit}
              accessibilityRole="button"
              accessibilityLabel="Load spec"
              style={[
                styles.button,
                {
                  backgroundColor: theme.accent,
                  opacity: jsonText.trim().length === 0 ? 0.5 : 1,
                },
              ]}
              testID="load-spec-submit"
            >
              <Text
                style={{
                  color: theme['accent-fg'],
                  fontSize: theme.type.body.size,
                  fontWeight: '600',
                }}
              >
                Load
              </Text>
            </Pressable>
          </View>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  )
}

const styles = StyleSheet.create({
  sheet: {
    paddingHorizontal: 20,
    paddingBottom: 24,
    gap: 12,
  },
  title: {
    marginBottom: 4,
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 140,
    textAlignVertical: 'top',
  },
  error: {
    fontSize: 13,
    marginTop: -4,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
