/**
 * AppRunner — Step 13 update (ADR-0006 §Step 13).
 *
 * STEP-13 ADDITIONS:
 *   - Dev-only demo picker: in __DEV__ builds, a small floating button lets
 *     the developer switch between the 4 demo archetypes (ListCRUD, Tracker,
 *     Journal, Calculator). The picker is invisible in production builds
 *     (tree-shaken at Metro's dead-code elimination pass because __DEV__ is
 *     a compile-time constant in Hermes + Metro release bundles).
 *   - SAMPLE_SPEC is now the ListCRUD demo (re-exported from protocol).
 *   - T-0006-177: Renderer now calls SpecSchema.parse() internally; any M1
 *     spec fed post-Step-13 causes a ZodError that RenderErrorBoundary catches.
 *
 * STEP-11 NOTE (ADR-0007 deferral):
 *   The LLM pipeline still emits M1 specs. Until ADR-0007 rewrites the
 *   generation pipeline to emit V0 specs, this screen mounts the selected
 *   demo spec instead of the project's stored spec. The route params
 *   (projectId) are still passed through so the host chrome (title bar,
 *   share button) can display project metadata. The real spec path is
 *   wired in ADR-0007.
 *
 * Host chrome (per T-0006-176):
 *   - Back button: navigates back to Library.
 *   - Share button: calls copyShareLink(projectId) — host-side only,
 *     the renderer is uninvolved (Concern 1 cleanup, ADR-0006 rev-1).
 */
import {Renderer, DEMO_SPECS, SAMPLE_SPEC} from '@app-creator/a2ui-renderer'
import type {HostCallbacks} from '@app-creator/a2ui-renderer'
import {useCallback, useState} from 'react'
import {Pressable, StyleSheet, Text, View} from 'react-native'
import type {Spec} from '@app-creator/protocol'

import {BackButton} from '#/components/BackButton'
import {SafeContainer} from '#/components/SafeContainer'
import {useToast} from '#/components/ToastProvider'
import {logger} from '#/logger'
import {useTheme} from '#/theme'

import {RenderErrorBoundary} from './RenderErrorBoundary'

import type {NativeStackScreenProps} from '@react-navigation/native-stack'
import type {RootStackParamList} from '#/lib/routes/types'

type Props = NativeStackScreenProps<RootStackParamList, 'AppRunner'>

// ---------------------------------------------------------------------------
// Share helper (T-0006-176)
// Host-side share wiring — the renderer is uninvolved.
// In V0 the share URL is the project's canonical deep link; this stub uses
// RN's Share API so we don't need expo-clipboard.
// ---------------------------------------------------------------------------

import {Share} from 'react-native'

/**
 * copyShareLink — copies a sharable project link to the clipboard / share sheet.
 * Exported so tests can spy on it.
 *
 * Step 11: projectId is undefined when a demo spec is mounted (ADR-0007 deferral).
 * The function is a no-op in that case.
 */
export async function copyShareLink(projectId: string | undefined): Promise<void> {
  if (!projectId) return
  try {
    await Share.share({message: `https://app.canvas.so/m/${projectId}`})
  } catch (err) {
    logger.warn('copyShareLink: Share.share failed', {err})
  }
}

// ---------------------------------------------------------------------------
// Host callbacks wired to the app's toast system
// ---------------------------------------------------------------------------

function makeHostCallbacks(onToast: (msg: string) => void): HostCallbacks {
  return {
    onToast: (message) => onToast(message),
    onAIError: (err) => {
      logger.error('AppRunner: AI dispatch error', {err})
    },
    onNavigationError: (signal) => {
      if (__DEV__) {
        logger.warn('AppRunner: navigation error', {signal})
      }
    },
  }
}

// ---------------------------------------------------------------------------
// Dev-only demo picker (Step 13)
// Invisible in production builds — __DEV__ is a compile-time constant in
// Hermes + Metro release mode.
// ---------------------------------------------------------------------------

const DEMO_ARCHETYPE_KEYS = ['ListCRUD', 'Tracker', 'Journal', 'Calculator'] as const
type DemoArchetype = (typeof DEMO_ARCHETYPE_KEYS)[number]

interface DevDemoPickerProps {
  current: DemoArchetype
  onSelect: (archetype: DemoArchetype) => void
}

function DevDemoPicker({current, onSelect}: DevDemoPickerProps) {
  const [open, setOpen] = useState(false)

  return (
    <View style={devStyles.pickerRoot} testID="dev-demo-picker">
      <Pressable
        onPress={() => setOpen(o => !o)}
        style={devStyles.toggleBtn}
        accessibilityRole="button"
        accessibilityLabel="Toggle demo spec picker"
        testID="dev-demo-picker-toggle"
      >
        <Text style={devStyles.toggleLabel}>Demo: {current}</Text>
      </Pressable>

      {open && (
        <View style={devStyles.menu} testID="dev-demo-picker-menu">
          {DEMO_ARCHETYPE_KEYS.map(key => (
            <Pressable
              key={key}
              onPress={() => {
                onSelect(key)
                setOpen(false)
              }}
              style={[devStyles.menuItem, current === key && devStyles.menuItemActive]}
              accessibilityRole="menuitem"
              accessibilityLabel={`Switch to ${key} demo`}
              testID={`dev-demo-option-${key}`}
            >
              <Text
                style={[devStyles.menuItemText, current === key && devStyles.menuItemTextActive]}
              >
                {key}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  )
}

const devStyles = StyleSheet.create({
  pickerRoot: {
    position: 'absolute',
    top: 64,
    right: 8,
    zIndex: 999,
    alignItems: 'flex-end',
  },
  toggleBtn: {
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  toggleLabel: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  menu: {
    marginTop: 4,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderRadius: 8,
    paddingVertical: 4,
    minWidth: 120,
  },
  menuItem: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  menuItemActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  menuItemText: {
    color: '#ccc',
    fontSize: 13,
  },
  menuItemTextActive: {
    color: '#fff',
    fontWeight: '700',
  },
})

// ---------------------------------------------------------------------------
// AppRunnerScreen — public export
// ---------------------------------------------------------------------------

export function AppRunnerScreen({route, navigation}: Props) {
  const {projectId} = route.params
  const theme = useTheme()
  const toast = useToast()

  // Dev-mode demo spec selection — defaults to ListCRUD (the Milestone B spec).
  const [demoArchetype, setDemoArchetype] = useState<DemoArchetype>('ListCRUD')
  const activeSpec: Spec = __DEV__
    ? (DEMO_SPECS[demoArchetype] ?? SAMPLE_SPEC)
    : SAMPLE_SPEC

  const handleBack = useCallback(() => {
    navigation.goBack()
  }, [navigation])

  const handleShare = useCallback(async () => {
    // T-0006-176: host meatball share — renderer is uninvolved.
    await copyShareLink(projectId)
  }, [projectId])

  const hostCallbacks = makeHostCallbacks(toast.show)

  return (
    <SafeContainer>
      {/* Host chrome — top bar */}
      <View style={styles.topBar}>
        <BackButton
          onPress={handleBack}
          accessibilityLabel="Back to library"
          testID="app-runner-back"
        />

        {/* Project title — placeholder until ADR-0007 wires real project data */}
        <Text
          style={[styles.title, theme.typography.heading3, {color: theme.palette.text.primary}]}
          numberOfLines={1}
          accessibilityRole="header"
          testID="app-runner-title"
        >
          My App
        </Text>

        {/* Share button (T-0006-176) */}
        <Pressable
          onPress={handleShare}
          accessibilityRole="button"
          accessibilityLabel="Share this app"
          style={styles.topBarCta}
          hitSlop={8}
          testID="app-runner-share"
        >
          <Text
            style={[
              theme.typography.bodyStrong,
              {color: theme.palette.primary, fontSize: 14},
            ]}
          >
            Share
          </Text>
        </Pressable>
      </View>

      {/* V0 Renderer */}
      <RenderErrorBoundary
        projectId={projectId}
        renderHash="v0-sample"
        mode="owner"
        onBack={handleBack}
      >
        {/* Sentinel View lets tests confirm the renderer tree mounted. */}
        <View testID="v0-renderer-sentinel" style={styles.rendererContainer}>
          <Renderer spec={activeSpec} host={hostCallbacks} />
        </View>
      </RenderErrorBoundary>

      {/* Dev-only demo picker — invisible in production */}
      {__DEV__ && (
        <DevDemoPicker
          current={demoArchetype}
          onSelect={setDemoArchetype}
        />
      )}
    </SafeContainer>
  )
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingTop: 8,
    paddingBottom: 8,
    gap: 8,
  },
  title: {
    flex: 1,
  },
  topBarCta: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  rendererContainer: {
    flex: 1,
  },
})
