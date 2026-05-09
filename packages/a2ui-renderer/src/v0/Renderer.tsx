/**
 * Renderer — top-level V0 renderer component.
 *
 * This is the single public entry point for the V0 renderer:
 *   <Renderer spec={spec} host={hostCallbacks} />
 *
 * Composes, in order:
 *   1. RendererThemeProvider  — token resolution for stance + palette
 *   2. AICapabilitiesProvider — on-device AI availability check
 *   3. HostProvider           — host callbacks (toasts, errors)
 *   4. RendererInner          — state + dispatch + nav
 *
 * Navigation wiring:
 *   Each navigator component calls onPrimitiveReady to register its
 *   NavigationPrimitive. The primitive is stored in a ref and accessed by
 *   the navigation middleware via a stable getter () => navPrimitiveRef.current.
 *
 *   The critical insight: useRendererState's navigationPrimitive option is read
 *   via its own internal ref (navRef) on every middleware dispatch call. We pass
 *   a wrapper NavigationPrimitive that reads from our navPrimitiveRef, so the
 *   middleware always gets the latest primitive without re-composing the chain.
 *
 * Step 10: provides the Renderer wrapper for Milestone B interactive demo.
 * Step 11: AppRunner cuts over to this component from the M1 legacy renderer.
 *
 * Exported as __V0_Renderer from the package root for the Milestone B demo shim.
 */
import React, {useRef, useMemo} from 'react'
import type {Spec} from '@app-creator/protocol'
import {RendererThemeProvider} from './theme/RendererThemeProvider.js'
import {AICapabilitiesProvider} from './ai/AICapabilitiesProvider.js'
import {HostProvider} from './host/HostContext.js'
import {useRendererState, RendererStateContext} from './state/useRendererState.js'
import type {HostCallbacks, NavigationErrorSignal} from './state/hostCallbacks.js'
import type {NavigationPrimitive} from './state/middleware/navigation.js'
import {NoNav} from './nav/NoNav.js'
import {StackNav} from './nav/StackNav.js'
import {TabsNav} from './nav/TabsNav.js'
import {ModalOverlayNav} from './nav/ModalOverlayNav.js'

export type RendererProps = {
  spec: Spec
  host: HostCallbacks
}

/**
 * NavRouter — picks the correct navigator based on spec.navigation.
 */
function NavRouter({
  spec,
  onPrimitiveReady,
  onNavigationError,
}: {
  spec: Spec
  onPrimitiveReady: (primitive: NavigationPrimitive | null) => void
  onNavigationError?: (signal: NavigationErrorSignal) => void
}) {
  switch (spec.navigation) {
    case 'none':
      // NoNav: no navigation primitive. The middleware already handles
      // 'navigate-on-none-nav' when getNav() returns null.
      return <NoNav spec={spec} />
    case 'stack':
      return <StackNav spec={spec} onPrimitiveReady={onPrimitiveReady} />
    case 'tabs':
      return <TabsNav spec={spec} onPrimitiveReady={onPrimitiveReady} />
    case 'modal-overlay':
      return (
        <ModalOverlayNav
          spec={spec}
          onPrimitiveReady={onPrimitiveReady}
          onNavigationError={onNavigationError}
        />
      )
  }
}

/**
 * RendererInner — has access to provider stack; owns the state + nav wiring.
 *
 * Navigation primitive bridge:
 *   navPrimitiveRef holds the most-recently registered NavigationPrimitive.
 *   We create a stable forwardingPrimitive that reads from navPrimitiveRef —
 *   this forwarding object is passed to useRendererState's navigationPrimitive
 *   option. Because useRendererState stores it in its own internal ref and
 *   the middleware getter reads that ref, the chain always sees the latest
 *   primitive on each dispatch — even if the primitive was null at mount time.
 */
function RendererInner({spec, host}: RendererProps) {
  // Holds the real nav primitive provided by whichever navigator is mounted.
  const navPrimitiveRef = useRef<NavigationPrimitive | null>(null)

  // A stable forwarding primitive that delegates to navPrimitiveRef.
  // This never changes reference, so useRendererState's navRef stabilizes.
  const forwardingPrimitive = useMemo<NavigationPrimitive>(() => ({
    navigate(screenId: string) {
      navPrimitiveRef.current?.navigate(screenId)
    },
    pop() {
      navPrimitiveRef.current?.pop()
    },
  }), [])

  const onPrimitiveReady = (primitive: NavigationPrimitive | null) => {
    navPrimitiveRef.current = primitive
  }

  const {state, dispatch} = useRendererState(spec, {
    host,
    // Always pass the forwarding primitive — it is non-null.
    // The forwarding primitive delegates to navPrimitiveRef which starts null.
    // When nav pattern is 'none', navPrimitiveRef stays null and the forwarding
    // primitive calls undefined → no-op. The middleware's getState() check for
    // back-on-empty-history still fires correctly.
    // Note: we pass forwardingPrimitive directly so the middleware always has
    // a non-null primitive and can delegate to the real primitive internally.
    // For 'none' nav: navPrimitiveRef.current is null, so navigate/pop are no-ops
    // and the middleware's host.onNavigationError fires via getState() / null-nav checks.
    //
    // Correction: the navigation middleware checks getNav() === null to decide
    // whether to call onNavigationError('navigate-on-none-nav'). If we always
    // pass a non-null forwardingPrimitive, the middleware NEVER fires that error.
    // Instead, we need getNav() to return null for 'none' nav.
    //
    // Solution: for 'none' nav, pass null. For all others, pass forwardingPrimitive.
    navigationPrimitive: spec.navigation === 'none' ? null : forwardingPrimitive,
  })

  return (
    <RendererStateContext.Provider value={{state, dispatch}}>
      <NavRouter
        spec={spec}
        onPrimitiveReady={onPrimitiveReady}
        onNavigationError={host.onNavigationError}
      />
    </RendererStateContext.Provider>
  )
}

/**
 * Renderer — public entry point.
 */
export function Renderer({spec, host}: RendererProps) {
  return (
    <RendererThemeProvider stance={spec.stance} palette={spec.palette}>
      <AICapabilitiesProvider>
        <HostProvider value={host}>
          <RendererInner spec={spec} host={host} />
        </HostProvider>
      </AICapabilitiesProvider>
    </RendererThemeProvider>
  )
}
