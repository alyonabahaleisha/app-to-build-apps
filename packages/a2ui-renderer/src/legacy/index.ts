// M1 public surface — exported from src/legacy/ during Steps 1–10 of ADR-0006.
// src/index.ts re-exports from here so apps/mobile keeps building while V0
// is built in src/v0/. Deleted at Step 13 (legacy delete).

export {render, NodeRenderer} from './render'

// -- State engine -------------------------------------------------------------
export {useA2UIState} from './state/useA2UIState'
export type {UseA2UIStateOpts, UseA2UIStateResult} from './state/useA2UIState'

// -- Theme provider -----------------------------------------------------------
export {
  RendererThemeProvider,
  useRendererTheme,
  DEFAULT_LIGHT_THEME,
} from './theme/RendererThemeProvider'

// -- Logger provider ----------------------------------------------------------
export {RendererLoggerProvider, useRendererLogger} from './logger/RendererLoggerProvider'

// -- Types --------------------------------------------------------------------
export type {
  RenderState,
  Dispatch,
  RendererTheme,
  RendererLogger,
  RendererSpacing,
  RendererRadius,
  RendererPalette,
  RendererTypography,
  Showtoast,
} from './types'
