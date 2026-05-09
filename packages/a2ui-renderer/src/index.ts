// packages/a2ui-renderer/src/index.ts (Step 1 form — ADR-0006 §A)
//
// Re-exports the M1 public surface from src/legacy/ so apps/mobile keeps
// building unchanged throughout Steps 1–10. V0 is built in src/v0/ across
// Steps 2–10 and replaces this file at Step 11.
export {
  render,
  NodeRenderer,
  useA2UIState,
  RendererThemeProvider,
  useRendererTheme,
  DEFAULT_LIGHT_THEME,
  RendererLoggerProvider,
  useRendererLogger,
} from './legacy/index.js'

export type {
  UseA2UIStateOpts,
  UseA2UIStateResult,
  RenderState,
  Dispatch,
  RendererTheme,
  RendererLogger,
  RendererSpacing,
  RendererRadius,
  RendererPalette,
  RendererTypography,
  Showtoast,
} from './legacy/index.js'

// ---------------------------------------------------------------------------
// V0 demo entry-point — Milestone A shim, NOT stable API.
// The __V0_* prefix signals these are temporary demo exports.
// They are consumed only by the AppRunner V0 demo branch when
// EXPO_PUBLIC_CANVAS_V0_DEMO=true. Step 11 will replace this block with
// the production V0 surface and remove the __V0_ prefix convention.
// ---------------------------------------------------------------------------
export {NodeRenderer as __V0_NodeRenderer} from './v0/components/NodeRenderer.js'
export {RendererThemeProvider as __V0_ThemeProvider} from './v0/theme/RendererThemeProvider.js'
export {
  HostProvider as __V0_HostProvider,
} from './v0/host/HostContext.js'
export type {HostCallbacks as __V0_HostCallbacks} from './v0/state/hostCallbacks.js'
export {SAMPLE_SPEC as __V0_SAMPLE_SPEC} from './v0/__demo__/sampleSpec.js'
