/**
 * AppRunner — Owner-mode implementation (ADR-0002 Step 9, ADR-0003 Step 8).
 *
 * Modes implemented:
 *   A. Owner-private:  Publish CTA in top bar
 *   B. Owner-public:   Unpublish CTA (destructive) in top bar
 *
 * Deferred to ADR-0004:
 *   C. Try mode (browser viewing another user's app)
 *
 * ADR-0003 Step 8 changes:
 *   - In-screen reducer (ownerStateReducer, dispatchOwnerState, Map<string, A2UIValue>)
 *     replaced with useA2UIState(spec, {onToast: toast.show}).
 *   - Renderer tree wrapped in RendererThemeProvider + RendererLoggerProvider
 *     + RenderErrorBoundary.
 *   - currentViewId from the hook drives which view is rendered.
 *   - Multi-view navigation (Button navigate action) works in-place.
 *
 * Canvas V0 Milestone A demo shim:
 *   When EXPO_PUBLIC_CANVAS_V0_DEMO=true, AppRunnerScreen renders V0DemoRunner
 *   instead of the M1 legacy path. The M1 path is unchanged. To enable:
 *     1. Set EXPO_PUBLIC_CANVAS_V0_DEMO=true in your .env or EAS build profile.
 *     2. Rebuild the dev-client: eas build --profile development
 *     3. Launch: pnpm --filter @app-creator/mobile start
 *   See docs/pipeline/canvas-v0-milestone-A-demo.md for full instructions.
 */
import {BottomSheetModal, BottomSheetModalProvider} from '@gorhom/bottom-sheet'
import {
  NodeRenderer,
  RendererLoggerProvider,
  RendererThemeProvider,
  useA2UIState,
  __V0_NodeRenderer,
  __V0_ThemeProvider,
  __V0_HostProvider,
  __V0_SAMPLE_SPEC,
} from '@app-creator/a2ui-renderer'
import type {RendererTheme, __V0_HostCallbacks} from '@app-creator/a2ui-renderer'
import type {A2UISpec} from '@app-creator/a2ui-schema'
import {useCallback, useRef} from 'react'
import {
  ActionSheetIOS,
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'

import {BackButton} from '#/components/BackButton'
import {SafeContainer} from '#/components/SafeContainer'
import {useToast} from '#/components/ToastProvider'
import {logger} from '#/logger'
import {useProjectQuery} from '#/state/queries/projects'
import {useUnpublishMutation, PublishError} from '#/state/queries/marketplace'
import {useSession} from '#/state/session/useSession'
import {useTheme} from '#/theme'

import {PublishSheet} from './components/PublishSheet'
import {RenderErrorBoundary} from './RenderErrorBoundary'

import type {NativeStackScreenProps} from '@react-navigation/native-stack'
import type {RootStackParamList} from '#/lib/routes/types'

type Props = NativeStackScreenProps<RootStackParamList, 'AppRunner'>

// -- Renderer host (inner component so hooks can use the loaded spec) ---------

interface RendererHostProps {
  spec: A2UISpec
  projectId: string
  renderHash: string
  rendererTheme: RendererTheme
  onBack: () => void
}

function RendererHost({spec, projectId, renderHash, rendererTheme, onBack}: RendererHostProps) {
  const toast = useToast()
  const {state, dispatch, currentViewId} = useA2UIState(spec, {
    onToast: toast.show,
  })

  // Find the view to render by currentViewId
  const currentView = spec.views.find(v => v.id === currentViewId)

  return (
    <RendererThemeProvider value={rendererTheme}>
      <RendererLoggerProvider logger={logger}>
        <RenderErrorBoundary
          projectId={projectId}
          renderHash={renderHash}
          mode="owner"
          onBack={onBack}
        >
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {currentView ? (
              <NodeRenderer node={currentView.root} state={state} dispatch={dispatch} />
            ) : (
              <Text style={styles.noContent}>No content to display.</Text>
            )}
          </ScrollView>
        </RenderErrorBoundary>
      </RendererLoggerProvider>
    </RendererThemeProvider>
  )
}

// -- Canvas V0 demo shim -----------------------------------------------------
// Evaluated once at module load time. Expo replaces EXPO_PUBLIC_* at build time.
// No runtime overhead when the flag is unset.
// Exported for test introspection only — not stable API.
export const V0_DEMO_ENABLED = process.env.EXPO_PUBLIC_CANVAS_V0_DEMO === 'true'

// Minimal HostCallbacks for the static demo. onToast and onAIError are no-ops
// because sampleSpec has no interactive nodes — this is a render demo only.
const V0_DEMO_HOST: __V0_HostCallbacks = {
  onToast: () => {},
  onAIError: () => {},
}

/**
 * V0DemoRunner — mounts SAMPLE_SPEC (productive×focus) via the V0 renderer
 * surface. No navigation, no AI, no data fetching. Pure render demo.
 *
 * The V0 Screen node handles its own safe-area so this component is bare —
 * no SafeContainer wrapper needed.
 */
// Exported for direct unit testing. Not part of the stable public API.
export function V0DemoRunner() {
  // SAMPLE_SPEC always has exactly one screen — the null check satisfies TS
  // and acts as defense-in-depth against hypothetical spec mutations.
  const screen = __V0_SAMPLE_SPEC.screens[0]
  if (!screen) return null

  return (
    <__V0_ThemeProvider stance={__V0_SAMPLE_SPEC.stance} palette={__V0_SAMPLE_SPEC.palette}>
      <__V0_HostProvider value={V0_DEMO_HOST}>
        <__V0_NodeRenderer node={screen.root} />
      </__V0_HostProvider>
    </__V0_ThemeProvider>
  )
}

// -- Screen ------------------------------------------------------------------

/**
 * LegacyAppRunnerScreen — the M1 owner-mode screen, untouched.
 * Extracted so AppRunnerScreen can branch cleanly without conditional hooks.
 */
function LegacyAppRunnerScreen({route, navigation}: Props) {
  const {projectId} = route.params
  const theme = useTheme()
  const toast = useToast()
  const session = useSession()

  const {data: detail, isLoading, error} = useProjectQuery(projectId)
  const unpublishMutation = useUnpublishMutation()
  const publishSheetRef = useRef<BottomSheetModal>(null)

  const handleBack = useCallback(() => {
    navigation.goBack()
  }, [navigation])

  const handlePublishTap = useCallback(() => {
    publishSheetRef.current?.present()
  }, [])

  const handleUnpublishTap = useCallback(() => {
    const title = detail?.project.title ?? 'this app'
    ActionSheetIOS.showActionSheetWithOptions(
      {
        title: `Unpublish '${title}'?`,
        message: "Other makers won't see it anymore. Your draft stays.",
        options: ['Unpublish', 'Cancel'],
        destructiveButtonIndex: 0,
        cancelButtonIndex: 1,
      },
      async idx => {
        if (idx !== 0) return
        try {
          await unpublishMutation.mutateAsync({projectId})
          toast.show('Unpublished.', {durationMs: 2000})
        } catch (err) {
          if (err instanceof PublishError && err.code === 'network') {
            toast.show("Couldn't unpublish. Try again.", {variant: 'error'})
          } else {
            toast.show("Couldn't unpublish. Try again.", {variant: 'error'})
          }
        }
      },
    )
  }, [detail, projectId, unpublishMutation, toast])

  if (isLoading) {
    return (
      <SafeContainer>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={theme.palette.primary} />
        </View>
      </SafeContainer>
    )
  }

  if (error || !detail) {
    return (
      <SafeContainer>
        <View style={styles.topBar}>
          <BackButton onPress={handleBack} accessibilityLabel="Back to library" />
        </View>
        <View style={styles.centered}>
          <Text style={[theme.typography.body, {color: theme.palette.text.muted}]}>
            {error?.message ?? 'Project not found.'}
          </Text>
        </View>
      </SafeContainer>
    )
  }

  const isOwner = detail.project.ownerId === session.user?.id
  const visibility = detail.project.visibility

  // Convert mobile theme to RendererTheme (same token shape — one-line cast).
  const rendererTheme: RendererTheme = {
    spacing: theme.spacing,
    radius: theme.radius,
    palette: theme.palette,
    typography: theme.typography,
  }

  const spec = detail.currentVersion.specJson as unknown as A2UISpec

  return (
    // BottomSheetModalProvider scopes the sheet portal to AppRunner.
    // GestureHandlerRootView is at App.tsx level.
    <BottomSheetModalProvider>
      <SafeContainer>
        {/* Top bar */}
        <View style={styles.topBar}>
          <BackButton
            onPress={handleBack}
            accessibilityLabel="Back to library"
            testID="app-runner-back"
          />

          <Text
            style={[styles.title, theme.typography.heading3, {color: theme.palette.text.primary}]}
            numberOfLines={1}
            accessibilityRole="header"
          >
            {detail.project.title}
          </Text>

          {isOwner ? (
            visibility === 'public' ? (
              <Pressable
                onPress={handleUnpublishTap}
                accessibilityRole="button"
                accessibilityLabel="Unpublish from Library"
                accessibilityHint="Removes this app from the public Library. Your draft stays."
                style={styles.topBarCta}
                hitSlop={8}
                testID="app-runner-unpublish-cta"
              >
                <Text
                  style={[
                    theme.typography.bodyStrong,
                    {
                      color: theme.palette.destructive,
                      fontSize: 14,
                    },
                  ]}
                >
                  Unpublish
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={handlePublishTap}
                accessibilityRole="button"
                accessibilityLabel="Publish to Library"
                style={styles.topBarCta}
                hitSlop={8}
                testID="app-runner-publish-cta"
              >
                <Text
                  style={[
                    theme.typography.bodyStrong,
                    {
                      color: theme.palette.primary,
                      fontSize: 14,
                    },
                  ]}
                >
                  Publish
                </Text>
              </Pressable>
            )
          ) : (
            // Non-owner — no CTA (Try mode placeholder pending ADR-0004)
            <View style={styles.topBarCta} />
          )}
        </View>

        {/* Rendered A2UI body */}
        {spec ? (
          <RendererHost
            spec={spec}
            projectId={projectId}
            renderHash={detail.currentVersion.renderHash}
            rendererTheme={rendererTheme}
            onBack={handleBack}
          />
        ) : (
          <View style={styles.body}>
            <Text style={[theme.typography.body, {color: theme.palette.text.muted}]}>
              No content to display.
            </Text>
          </View>
        )}

        {/* Publish bottom-sheet */}
        {isOwner && (
          <PublishSheet
            ref={publishSheetRef}
            projectId={projectId}
            // `AuthUser` doesn't carry a handle field in ADR-0002 scope.
            // The publish sheet always starts in first-time mode; if the user
            // already has a handle, the server will respond with
            // `handle_immutable` and the sheet will surface that error.
            // Phase 2: extend `AuthUser` with `handle` from `/auth/sync`.
            firstPublish={true}
            currentHandle={null}
          />
        )}
      </SafeContainer>
    </BottomSheetModalProvider>
  )
}

/**
 * AppRunnerScreen — public export.
 *
 * When EXPO_PUBLIC_CANVAS_V0_DEMO=true: renders the Milestone A static demo
 * (V0 renderer surface, SAMPLE_SPEC, no backend calls). The nav shell is
 * intentionally absent — this is a render demo, not a product screen.
 *
 * Otherwise: renders the M1 legacy owner-mode screen (LegacyAppRunnerScreen),
 * unchanged from ADR-0003 Step 8.
 *
 * Step 11 removes this shim and cuts LegacyAppRunnerScreen over to the full
 * V0 <Renderer> component.
 */
export function AppRunnerScreen(props: Props) {
  if (V0_DEMO_ENABLED) {
    return <V0DemoRunner />
  }
  return <LegacyAppRunnerScreen {...props} />
}

// -- Styles ------------------------------------------------------------------

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
  body: {
    flex: 1,
  },
  bodyContent: {
    padding: 16,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  noContent: {
    fontSize: 16,
    fontWeight: '400',
    color: '#5e6470',
  },
})
