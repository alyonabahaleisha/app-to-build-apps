// packages/a2ui-renderer/src/index.ts (Step 13 form — ADR-0006 §A)
//
// Step 13: src/legacy/ has been deleted. V0 is the sole implementation.
// The "@app-creator/a2ui-renderer/legacy" subpath export has been removed
// from package.json. No legacy symbols exist anywhere in this package.

// ---------------------------------------------------------------------------
// V0 public surface — the canonical API post-Step-11
// ---------------------------------------------------------------------------

// Top-level renderer component — the single public entry point.
export {Renderer} from './v0/Renderer'
export type {RendererProps} from './v0/Renderer'

// Host callbacks — the seam between renderer and host.
export type {HostCallbacks, NavigationErrorSignal} from './v0/state/hostCallbacks'

// Theme provider — exposed for host apps that want to read tokens.
export {RendererThemeProvider} from './v0/theme/RendererThemeProvider'

// Host context provider — for advanced embedding cases.
export {HostProvider} from './v0/host/HostContext'

// Node renderer — for hosts that want to render individual nodes.
export {NodeRenderer} from './v0/components/NodeRenderer'

// Demo sample spec — used by AppRunner while real generation still emits M1 specs
// (ADR-0007 deferral). Canonical source: @app-creator/protocol/test/fixtures.demo.
// Removed when ADR-0007 lands.
export {SAMPLE_SPEC, DEMO_SPECS} from './v0/__demo__/sampleSpec'
