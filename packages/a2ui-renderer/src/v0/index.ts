// V0 renderer surface. Populated in Steps 2–10 of ADR-0006.
// Step 11 cuts AppRunner over to V0; Step 13 deletes src/legacy/.

// Step 3: Theme provider + AI capabilities provider + accessibility wrapper
// Step 4 addition: useStance() hook added to RendererThemeProvider
export {RendererThemeProvider, useTheme, useStance} from './theme/RendererThemeProvider.js'
export type {RendererThemeProviderProps} from './theme/RendererThemeProvider.js'

export {AICapabilitiesProvider, useAICapabilities} from './ai/AICapabilitiesProvider.js'
export type {AICapabilities} from './ai/AICapabilitiesProvider.js'

export {aiCapabilitiesCheck} from './ai/aiCapabilitiesCheck.js'

export {AccessibilityWrapper} from './a11y/AccessibilityWrapper.js'
export type {AccessibilityWrapperProps, RendererAccessibilityRole} from './a11y/AccessibilityWrapper.js'

export {useReducedMotion} from './a11y/useReducedMotion.js'

// Step 2: State model + middleware framework + Binding<T> resolution
export type {
  RendererState,
  CollectionState,
  PendingUndo,
  Row,
  RowId,
  SlotName,
  CollectionId,
  RendererAction,
  ClearPendingUndoAction,
  BindingValue,
} from './state/types.js'
export {MAX_ROWS} from './state/types.js'

export {reducer, buildInitialRendererState, buildCollectionFromSeedData} from './state/reducer.js'

export type {Middleware, DispatchFn, ComposedChain} from './state/middleware.js'
export {composeMiddleware, makeReducerMiddleware} from './state/middleware.js'

export {haptics} from './state/middleware/haptics.js'
export {makeToastMiddleware} from './state/middleware/toast.js'
export {makeAIBridgeMiddleware} from './state/middleware/aiBridge.js'
export type {AIDispatcher} from './state/middleware/aiBridge.js'
export {makeNavigationMiddleware} from './state/middleware/navigation.js'
export type {NavigationPrimitive} from './state/middleware/navigation.js'
export {makeUndoBufferMiddleware, UNDO_WINDOW_MS} from './state/middleware/undoBuffer.js'

export type {HostCallbacks, NavigationErrorSignal} from './state/hostCallbacks.js'

export {
  useRendererState,
  RendererStateContext,
  useRendererStateContext,
} from './state/useRendererState.js'
export type {UseRendererStateOpts, UseRendererStateResult} from './state/useRendererState.js'

export {useBinding} from './state/useBinding.js'
export type {Binding} from './state/useBinding.js'
export {setUnknownNodeTypeCallback} from './state/useBinding.js'

export {useListItemContext, ListItemContextProvider} from './state/ListItemContext.js'
export type {ListItemContextValue} from './state/ListItemContext.js'

// Step 4: Layout tier + NodeRenderer + HostContext
export {NodeRenderer} from './components/NodeRenderer.js'
export {ScreenRenderer} from './components/layout/Screen.js'
export {SectionRenderer} from './components/layout/Section.js'
export {StackRenderer} from './components/layout/Stack.js'
export {RowRenderer} from './components/layout/Row.js'
export {CardRenderer, SHADOW_RECIPES} from './components/layout/Card.js'
export {LAYOUT_DEFAULTS} from './components/layout/defaults.js'
export {HostProvider, useHost} from './host/HostContext.js'

// Step 5: Typography tier + Display tier
export {HeadingRenderer} from './components/typography/Heading.js'
export {BodyRenderer} from './components/typography/Body.js'
export {CaptionRenderer} from './components/typography/Caption.js'
export {StatRenderer} from './components/display/Stat.js'
export {BadgeRenderer} from './components/display/Badge.js'
export {ChipRenderer} from './components/display/Chip.js'
export {AvatarRenderer} from './components/display/Avatar.js'

// Step 6: Inputs tier
export {TextFieldRenderer} from './components/inputs/TextField.js'
export {NumberFieldRenderer} from './components/inputs/NumberField.js'
export {DateFieldRenderer} from './components/inputs/DateField.js'
export {PickerRenderer} from './components/inputs/Picker.js'
export {SwitchRenderer} from './components/inputs/Switch.js'
export {INPUT_DEFAULTS} from './components/inputs/defaults.js'

// Step 7: Lists tier
export {ListRenderer, buildAnimationProps} from './components/lists/List.js'
export {ListItemRenderer} from './components/lists/ListItem.js'
export {SwipeableRowRenderer} from './components/lists/SwipeableRow.js'
export {EmptyStateRenderer} from './components/lists/EmptyState.js'
export {LoadingStateRenderer} from './components/lists/LoadingState.js'
export {LIST_DEFAULTS, ITEM_LAYOUT_HEIGHT} from './components/lists/defaults.js'

// Step 8: Compound tier + AI dispatcher
export {ConditionalSectionRenderer} from './components/compound/ConditionalSection.js'
export {ListSummaryRenderer} from './components/compound/ListSummary.js'
export {MediaTrayRenderer} from './components/compound/MediaTray.js'
export {ImagePickerRenderer} from './components/compound/ImagePicker.js'
export {makeAIDispatcher, sanitizeRowsForPrompt, AI_TIMEOUT_MS} from './ai/aiDispatcher.js'

// Step 9: Actions tier + feedback middleware
export {ButtonRenderer} from './components/actions/Button.js'
export {FABRenderer} from './components/actions/FAB.js'
export {feedback} from './state/middleware/feedback.js'

// Step 10: Internal navigation patterns + Renderer wrapper
export {NoNav} from './nav/NoNav.js'
export {StackNav} from './nav/StackNav.js'
export {TabsNav} from './nav/TabsNav.js'
export {ModalOverlayNav} from './nav/ModalOverlayNav.js'
export {Renderer} from './Renderer.js'
export type {RendererProps} from './Renderer.js'
