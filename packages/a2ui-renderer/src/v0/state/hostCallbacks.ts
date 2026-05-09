/**
 * HostCallbacks — the seam between the renderer and the host application.
 *
 * Defined here (near the state module that uses it) and re-exported from
 * src/v0/index.ts. The full renderer public surface (including RendererProps)
 * is defined in src/v0/Renderer.tsx at Step 10.
 *
 * Per ADR-0006 §G (rev-1):
 *   - onShare removed (F-04 closure; share is host-meatball-only)
 *   - onNavigationError added (NF-01 Roz fix; separate hook from onUnknownNodeType)
 */
import type {Tone} from '@app-creator/protocol'

export type NavigationErrorSignal =
  | 'back-on-empty-history'
  | 'navigate-on-none-nav'
  | 'navigate-while-sheet-open'

export type HostCallbacks = {
  /** Enqueue a toast message on the host's toast surface. */
  onToast: (message: string, tone: Tone | undefined) => void
  /** Called when an AI dispatch fails. */
  onAIError: (err: Error) => void
  /**
   * Called when a schema-violating node type is encountered at render time.
   * The parameter is the unknown type string. NOT used for navigation errors.
   */
  onUnknownNodeType?: (type: string) => void
  /**
   * Called when a navigation runtime error occurs (NF-01 Roz fix).
   * Separate from onUnknownNodeType — different observability concern.
   */
  onNavigationError?: (signal: NavigationErrorSignal) => void
}
