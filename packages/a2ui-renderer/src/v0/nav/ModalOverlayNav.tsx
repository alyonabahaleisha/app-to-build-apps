/**
 * ModalOverlayNav — base screen + Gorhom BottomSheet for specs with
 * navigation: 'modal-overlay'.
 *
 * Per UX doc §Pattern 4: modal-overlay:
 *   FAB at bottom-right opens a Gorhom Bottom Sheet at 75% height.
 *   Sheet contains the target screen's root.
 *   Sheet dismissable via drag-down or tap on overlay.
 *
 * Architecture:
 *   - Base screen: spec.screens[0] (initialScreenId's screen).
 *   - Modal screens: all other screens in spec.screens.
 *   - navigate(target) where target is a non-base screen id → open sheet.
 *   - navigate(target) where target is the base screen id → close sheet (go home).
 *   - navigate(target) while sheet is already open → swap target (T-0006-172b),
 *     calls host.onNavigationError('navigate-while-sheet-open') for observability.
 *   - back → close sheet (pop action, sheet dismisses).
 *
 * NavigationPrimitive:
 *   navigate(screenId) — if already-open, signals navigate-while-sheet-open
 *     then swaps to new target. If closed, opens sheet with target.
 *   pop() — dismisses the sheet.
 *
 * T-0006-169: mounts root + Gorhom sheet
 * T-0006-170: navigate(target) opens sheet with target screen
 * T-0006-171: sheet drag-down dismisses (Gorhom built-in)
 * T-0006-172b: navigate while sheet open → swap + onNavigationError
 */
import React, {useState, useRef, useCallback, useEffect} from 'react'
import {View} from 'react-native'
import {BottomSheetModal, BottomSheetModalProvider, BottomSheetView} from '@gorhom/bottom-sheet'
import type {Spec} from '@app-creator/protocol'
import type {NavigationPrimitive} from '../state/middleware/navigation.js'
import type {HostCallbacks} from '../state/hostCallbacks.js'
import {NodeRenderer} from '../components/NodeRenderer.js'

export type ModalOverlayNavProps = {
  spec: Spec
  onPrimitiveReady: (primitive: NavigationPrimitive | null) => void
  onNavigationError?: HostCallbacks['onNavigationError']
}

export function ModalOverlayNav({spec, onPrimitiveReady, onNavigationError}: ModalOverlayNavProps) {
  const sheetRef = useRef<BottomSheetModal>(null)
  // Which non-base screen is currently being shown in the sheet.
  const [modalScreenId, setModalScreenId] = useState<string | null>(null)
  // Track whether the sheet is currently open.
  const sheetOpenRef = useRef(false)

  const baseScreen = spec.screens[0]

  const handleSheetChange = useCallback((index: number) => {
    // index === -1 means the sheet is dismissed (fully closed).
    if (index === -1) {
      sheetOpenRef.current = false
      setModalScreenId(null)
    } else {
      sheetOpenRef.current = true
    }
  }, [])

  // Register the NavigationPrimitive on mount.
  useEffect(() => {
    const primitive: NavigationPrimitive = {
      navigate(screenId: string) {
        if (sheetOpenRef.current) {
          // Sheet already open: swap target and signal observability error.
          onNavigationError?.('navigate-while-sheet-open')
          setModalScreenId(screenId)
          // Sheet is already presented; just swap the content.
          return
        }
        // Open the sheet with the target screen's content.
        setModalScreenId(screenId)
        sheetRef.current?.present()
        sheetOpenRef.current = true
      },
      pop() {
        // Dismiss the modal sheet.
        sheetRef.current?.dismiss()
        sheetOpenRef.current = false
      },
    }
    onPrimitiveReady(primitive)
    return () => {
      onPrimitiveReady(null)
    }
  }, [onPrimitiveReady, onNavigationError])

  const modalScreen = modalScreenId
    ? spec.screens.find(s => s.id === modalScreenId)
    : null

  return (
    <BottomSheetModalProvider>
      {/* Base screen — always rendered */}
      <View style={{flex: 1}}>
        {baseScreen && <NodeRenderer node={baseScreen.root} />}
      </View>

      {/* Modal sheet — 75% screen height per UX doc */}
      <BottomSheetModal
        ref={sheetRef}
        snapPoints={['75%']}
        onChange={handleSheetChange}
        enablePanDownToClose
      >
        <BottomSheetView style={{flex: 1}}>
          {modalScreen && <NodeRenderer node={modalScreen.root} />}
        </BottomSheetView>
      </BottomSheetModal>
    </BottomSheetModalProvider>
  )
}
