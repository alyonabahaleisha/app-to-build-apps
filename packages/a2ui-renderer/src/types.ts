import type {A2UIAction, A2UIValue} from '@app-creator/a2ui-schema'

export type RenderState = Record<string, A2UIValue>

export type Dispatch = (action: A2UIAction, state: RenderState) => void

export type RendererTheme = {
  spacing: Record<'none' | 'sm' | 'md' | 'lg', number>
  // Theme is kept minimal at M1; expand as catalog grows.
}

export type Showtoast = (message: string) => void
