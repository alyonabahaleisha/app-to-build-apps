/**
 * RunErrorBoundary — RenderErrorBoundary adapter for RunScreen.
 *
 * Re-wraps the renderer area with a run-screen-specific fallback and a
 * Sentry breadcrumb (logger.error at V0; Sentry integrated post-V0).
 *
 * Class component required: React error boundaries must be class-based.
 */
import {logger} from '#/logger'
import React from 'react'

export interface RunErrorBoundaryProps {
  miniAppId: string
  renderHash: string
  children: React.ReactNode
  fallback: React.ReactNode
}

interface RunErrorBoundaryState {
  hasError: boolean
}

export class RunErrorBoundary extends React.Component<
  RunErrorBoundaryProps,
  RunErrorBoundaryState
> {
  constructor(props: RunErrorBoundaryProps) {
    super(props)
    this.state = {hasError: false}
  }

  static getDerivedStateFromError(): RunErrorBoundaryState {
    return {hasError: true}
  }

  componentDidCatch(error: unknown, _info: React.ErrorInfo): void {
    const {miniAppId, renderHash} = this.props
    // Sentry breadcrumb — logger.error (Sentry integrated post-V0).
    logger.error('render_failed', {
      miniAppId,
      renderHash,
      safeMessage: error instanceof Error ? error.message : String(error),
    })
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback
    }
    return this.props.children
  }
}
