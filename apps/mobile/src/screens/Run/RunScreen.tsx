/**
 * RunScreen — host that renders generated mini-apps.
 *
 * ADR-0011 Step 10 + canvas-v0-ux.md §Screen 4.
 *
 * Layout (top → bottom):
 *   - SafeContainer (safe-area insets + theme bg)
 *   - RunHeader (back | title | meatball) — always visible (AC-R6)
 *   - Renderer area (V0 Renderer from query)
 *   - TabBar (host chrome)
 *   - FirstRunCoachmark overlay (conditionally)
 *
 * States:
 *   - Loading   → RunHeader.Loading + ActivityIndicator
 *   - Error     → RunHeader.Loading + RunFailedBanner (fetch error or 404)
 *   - Populated → RunHeader + V0 Renderer inside RenderErrorBoundary
 *   - Render-error → RenderErrorBoundary catches → RunFailedBanner
 *
 * Meatball menu actions:
 *   - Share (calls POST /me/mini-apps/:id/share — 501 stub; T-0011-251)
 *   - Copy link (same 501 path)
 *   - Make changes → Create with editingMiniAppId + prefilledPrompt
 *   - Rename → RenameSheet
 *   - Archive → confirmation + useArchiveMiniAppMutation → pop to Library
 *   - Delete → confirmation + useDeleteMiniAppMutation → pop to Library
 *
 * Cal R3 closures:
 *   - P1-9: share 501 → toast "Share isn't ready yet"; no share_link_copied telemetry
 *   - P1-10: useAuthDeepLink regression (unaffected — lives at Navigation root)
 *
 * ADR-0008 hook point: celebrate sheet for clone landing left for ADR-0008 PR 3.
 *
 * T-0011-244..T-0011-284.
 */
import {BottomSheetModalProvider} from '@gorhom/bottom-sheet'
import {useCallback, useEffect, useRef, useState} from 'react'
import {
  ActivityIndicator,
  Alert,
  Clipboard,
  StyleSheet,
  View,
  type LayoutRectangle,
} from 'react-native'

import {SafeContainer} from '#/components/SafeContainer'
import {useToast} from '#/components/ToastProvider'
import {hasSeenCoachmark} from '#/lib/coachmarkStorage'
import {apiFetch, ApiError} from '#/lib/api'
import {writeEvent} from '#/lib/telemetry'
import {
  useArchiveMiniAppMutation,
  useDeleteMiniAppMutation,
  useMiniAppQuery,
} from '#/state/queries/miniApps'
import {useAppShellTheme} from '#/theme/AppShellThemeProvider'

import {Renderer, type HostCallbacks} from '@app-creator/a2ui-renderer'
import type {Spec} from '@app-creator/protocol'

import {FirstRunCoachmark} from './FirstRunCoachmark'
import {MeatballMenu, type MeatballMenuRef} from './MeatballMenu'
import {RenameSheet, type RenameSheetRef} from './RenameSheet'
import {RunErrorBoundary} from './RunErrorBoundary'
import {RunErrorState} from './RunErrorState'
import {RunFailedBanner} from './RunFailedBanner'
import {RunHeader} from './RunHeader'
import {runCopy} from './copy'

import type {NativeStackScreenProps} from '@react-navigation/native-stack'
import type {RootStackParamList} from '#/lib/routes/types'

type Props = NativeStackScreenProps<RootStackParamList, 'Run'>

// ---------------------------------------------------------------------------
// RunScreen
// ---------------------------------------------------------------------------

export function RunScreen({route, navigation}: Props) {
  const {miniAppId} = route.params
  const theme = useAppShellTheme()
  const toast = useToast()

  const query = useMiniAppQuery(miniAppId)
  const archiveMutation = useArchiveMiniAppMutation()
  const deleteMutation = useDeleteMiniAppMutation()

  const meatballRef = useRef<MeatballMenuRef>(null)
  const renameSheetRef = useRef<RenameSheetRef>(null)

  // Meatball layout — used to anchor the coachmark.
  const [meatballLayout, setMeatballLayout] = useState<LayoutRectangle | null>(null)

  // Coachmark visibility.
  const [coachmarkVisible, setCoachmarkVisible] = useState(false)
  const [coachmarkChecked, setCoachmarkChecked] = useState(false)

  // Check coachmark on mount.
  useEffect(() => {
    void hasSeenCoachmark().then(seen => {
      setCoachmarkChecked(true)
      if (!seen) {
        setCoachmarkVisible(true)
      }
    })
  }, [])

  // Host callbacks wired to the app's toast system (CLAUDE.md §3).
  const hostCallbacks: HostCallbacks = {
    onToast: (message: string) => toast.show(message),
    onAIError: () => {
      // AI dispatch errors — no user-visible action in V0.
    },
    onNavigationError: () => {
      // Internal nav errors — no host-level action in V0.
    },
  }

  // ---------- navigation handlers ----------

  const handleBack = useCallback(() => {
    navigation.goBack()
  }, [navigation])

  const handleMeatball = useCallback(() => {
    // Dismiss coachmark when user taps meatball (the intended next action).
    if (coachmarkVisible) {
      setCoachmarkVisible(false)
    }
    meatballRef.current?.present()
  }, [coachmarkVisible])

  // ---------- meatball action handlers ----------

  const handleShare = useCallback(async () => {
    meatballRef.current?.dismiss()
    try {
      const result = await apiFetch<{share_id: string; universal_link: string}>(
        `/me/mini-apps/${miniAppId}/share`,
        {method: 'POST'},
      )
      // 200 path (ADR-0008): copy link + haptic + telemetry.
      // share_id_prefix is the first 4 chars of the ksuid — anonymous time-bucket, no PII.
      writeEvent({eventType: 'share_link_copied', share_id_prefix: result.share_id.slice(0, 4)})
      toast.show(runCopy.linkCopied)
    } catch (err) {
      if (err instanceof ApiError && err.status === 501) {
        // 501 stub — temporary toast; no telemetry (T-0011-251).
        toast.show(runCopy.shareNotReady, {variant: 'error'})
        // Explicitly: do NOT call writeEvent here.
        return
      }
      toast.show(runCopy.shareNotReady, {variant: 'error'})
    }
  }, [miniAppId, toast])

  const handleCopyLink = useCallback(async () => {
    meatballRef.current?.dismiss()
    try {
      const result = await apiFetch<{share_id: string; universal_link: string}>(
        `/me/mini-apps/${miniAppId}/share`,
        {method: 'POST'},
      )
      Clipboard.setString(result.universal_link)
      // share_id_prefix is the first 4 chars of the ksuid — anonymous time-bucket, no PII.
      writeEvent({eventType: 'share_link_copied', share_id_prefix: result.share_id.slice(0, 4)})
      toast.show(runCopy.linkCopied)
    } catch (err) {
      if (err instanceof ApiError && err.status === 501) {
        toast.show(runCopy.shareNotReady, {variant: 'error'})
        return
      }
      toast.show(runCopy.shareNotReady, {variant: 'error'})
    }
  }, [miniAppId, toast])

  const handleMakeChanges = useCallback(() => {
    meatballRef.current?.dismiss()
    const originalPrompt = (query.data?.miniApp as {originalPrompt?: string} | undefined)?.originalPrompt ?? ''
    navigation.navigate('Create', {
      editingMiniAppId: miniAppId,
      prefilledPrompt: originalPrompt,
    })
  }, [miniAppId, navigation, query.data])

  const handleRename = useCallback(() => {
    meatballRef.current?.dismiss()
    const currentTitle = query.data?.miniApp.title ?? ''
    renameSheetRef.current?.present(miniAppId, currentTitle)
  }, [miniAppId, query.data])

  const handleArchive = useCallback(() => {
    meatballRef.current?.dismiss()
    Alert.alert(
      runCopy.archiveAlertTitle,
      runCopy.archiveAlertBody,
      [
        {text: runCopy.archiveAlertCancel, style: 'cancel'},
        {
          text: runCopy.archiveAlertConfirm,
          onPress: () => {
            archiveMutation.mutate({id: miniAppId}, {
              onSuccess: () => {
                navigation.goBack()
              },
            })
          },
        },
      ],
    )
  }, [miniAppId, archiveMutation, navigation])

  const handleDelete = useCallback(() => {
    meatballRef.current?.dismiss()
    Alert.alert(
      runCopy.deleteAlertTitle,
      runCopy.deleteAlertBody,
      [
        {text: runCopy.deleteAlertCancel, style: 'cancel'},
        {
          text: runCopy.deleteAlertConfirm,
          style: 'destructive',
          onPress: () => {
            deleteMutation.mutate({id: miniAppId}, {
              onSuccess: () => {
                navigation.goBack()
              },
            })
          },
        },
      ],
    )
  }, [miniAppId, deleteMutation, navigation])

  const handleCoachmarkDismiss = useCallback(() => {
    setCoachmarkVisible(false)
  }, [])

  // ---------- render states ----------

  const isLoading = query.isPending && !query.data
  const isError = query.isError && !query.data

  // 404 detection: ApiError with status 404
  const is404 =
    isError &&
    query.error instanceof ApiError &&
    query.error.status === 404

  // ---------- render ----------

  if (isLoading) {
    return (
      <SafeContainer>
        <View style={styles.root} testID="run-screen-root">
          <RunHeader.Loading onBack={handleBack} />
          <View style={styles.centerContent} testID="run-loading">
            <ActivityIndicator size="large" color={theme.accent} />
          </View>
        </View>
      </SafeContainer>
    )
  }

  if (isError || !query.data) {
    return (
      <RunErrorState
        is404={is404}
        onBack={handleBack}
        onRecreate={() => {
          navigation.navigate('Create', {prefilledPrompt: ''})
        }}
      />
    )
  }

  const {miniApp, currentVersion} = query.data
  const specJson = currentVersion.specJson

  return (
    <BottomSheetModalProvider>
      <SafeContainer>
        <View style={styles.root} testID="run-screen-root">
          {/* Host header — always visible (AC-R6) */}
          <RunHeader
            title={miniApp.title}
            onBack={handleBack}
            onMeatball={handleMeatball}
            onMeatballLayout={event => setMeatballLayout(event.nativeEvent.layout)}
          />

          {/* Renderer area */}
          <View style={styles.rendererContainer} testID="run-renderer-container">
            <RunErrorBoundary
              miniAppId={miniAppId}
              renderHash={currentVersion.renderHash}
              fallback={
                <RunFailedBanner
                  onBackToLibrary={handleBack}
                  onRecreate={() => {
                    navigation.navigate('Create', {
                      editingMiniAppId: miniAppId,
                      prefilledPrompt: (miniApp as {originalPrompt?: string}).originalPrompt ?? '',
                    })
                  }}
                />
              }
            >
              <Renderer
                // specJson from the wire is validated by Renderer's internal SpecSchema.parse().
                // A structural mismatch throws a ZodError → RenderErrorBoundary catches it.
                spec={specJson as Spec}
                host={hostCallbacks}
              />
            </RunErrorBoundary>
          </View>

          {/* Coachmark overlay (first-time-user) */}
          {coachmarkChecked ? (
            <FirstRunCoachmark
              meatballLayout={meatballLayout}
              visible={coachmarkVisible}
              onDismiss={handleCoachmarkDismiss}
            />
          ) : null}
        </View>

        {/* Meatball action sheet */}
        <MeatballMenu
          ref={meatballRef}
          onShare={() => { void handleShare() }}
          onCopyLink={() => { void handleCopyLink() }}
          onMakeChanges={handleMakeChanges}
          onRename={handleRename}
          onArchive={handleArchive}
          onDelete={handleDelete}
        />

        {/* Rename sheet */}
        <RenameSheet ref={renameSheetRef} />
      </SafeContainer>
    </BottomSheetModalProvider>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  rendererContainer: {
    flex: 1,
  },
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
